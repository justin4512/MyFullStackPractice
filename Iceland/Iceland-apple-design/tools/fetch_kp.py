#!/usr/bin/env python3
"""
GFZ 地磁擾動指數 Kp 快照：寫入 js/kp.js（window.KP）

資料來源（德國地球科學研究中心 GFZ Potsdam，CC BY 4.0）
  - Kp 觀測值（nowcast／definitive）：https://kp.gfz.de/app/json/
  - Kp 3 天機率預報：https://spaceweather.gfz.de/  （kp_product_file_FORECAST_PAGER_SWIFT_LAST.csv）

GFZ 的服務不提供 CORS，網頁無法直接讀取，所以由本腳本抓取後存成靜態檔。
旅途中需要最新資料時重跑即可：
  python3 tools/fetch_kp.py
"""
import csv, io, json, subprocess, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KP_API = "https://kp.gfz.de/app/json/?start={start}&end={end}&index=Kp"
FORECAST_CSV = "https://spaceweather.gfz.de/fileadmin/Kp-Forecast/CSV/kp_product_file_FORECAST_PAGER_SWIFT_LAST.csv"
HISTORY_HOURS = 72


def fetch(url):
    """用 curl 抓取：macOS 內建 Python 的 LibreSSL 與部分 TLS 伺服器握手失敗。"""
    r = subprocess.run(["curl", "-sSL", "-m", "40", "-A", "iceland-itinerary-kp", url], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("fetch failed: %s\n%s" % (url, r.stderr))
    return r.stdout


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def main():
    now = datetime.now(timezone.utc)
    start = (now - timedelta(hours=HISTORY_HOURS)).replace(minute=0, second=0, microsecond=0)

    raw = json.loads(fetch(KP_API.format(start=iso(start), end=iso(now))))
    history = [dict(t=t, kp=round(float(k), 3), status=s)
               for t, k, s in zip(raw.get("datetime", []), raw.get("Kp", []), raw.get("status", []))]
    if not history:
        raise SystemExit("GFZ 沒有回傳 Kp 觀測值：%s" % raw)

    forecast, issued = [], None
    try:
        text = fetch(FORECAST_CSV)
        rows = list(csv.DictReader(io.StringIO(text)))
        for r in rows:
            t = datetime.strptime(r["Time (UTC)"].strip(), "%d-%m-%Y %H:%M").replace(tzinfo=timezone.utc)
            p = lambda k: float(r.get(k) or 0)
            forecast.append(dict(
                t=iso(t), median=round(p("median"), 3), q25=round(p("0.25-quantile"), 3), q75=round(p("0.75-quantile"), 3),
                min=round(p("minimum"), 3), max=round(p("maximum"), 3),
                p5=round(p("prob 5-6") + p("prob 6-7") + p("prob 7-8") + p("prob >= 8"), 3),
                p7=round(p("prob 7-8") + p("prob >= 8"), 3)))
        if forecast:
            issued = forecast[0]["t"]
    except (SystemExit, KeyError, ValueError) as e:
        print("（預報略過：%s）" % e, file=sys.stderr)

    last_obs = history[-1]["t"]
    forecast = [f for f in forecast if f["t"] > last_obs]   # 只留觀測值之後的時段

    data = dict(fetched_at=iso(now), source="GFZ Potsdam", license="CC BY 4.0",
                source_url="https://kp.gfz.de/", forecast_url="https://spaceweather.gfz.de/",
                forecast_issued=issued, history=history, forecast=forecast)
    out = ("/* GFZ Kp 地磁擾動指數快照（由 tools/fetch_kp.py 產生，請勿手動修改）\n"
           "   資料：GFZ Potsdam，CC BY 4.0 */\nwindow.KP = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    (ROOT / "js" / "kp.js").write_text(out)
    print("wrote js/kp.js：觀測 %d 筆（最新 %s Kp %.2f %s），預報 %d 筆" % (
        len(history), last_obs, history[-1]["kp"], history[-1]["status"], len(forecast)))


if __name__ == "__main__":
    main()
