#!/usr/bin/env python3
"""冰島追極光之旅：行程調整存檔 API（只用 Python 標準函式庫）

  GET  /api/plan   讀取目前的行程調整（沒有存檔時回傳空白調整）
  PUT  /api/plan   寫入行程調整；body 的 rev 必須等於伺服器目前的 rev（避免兩台裝置互相覆蓋）
  GET  /api/health 健康檢查

存檔：<data>/plan.json；每次寫入前把舊檔備份到 <data>/backups/（保留最近 30 份）。
設定環境變數 EDIT_TOKEN 後，寫入需在標頭帶 X-Edit-Token（未設定則任何能開網站的人都能修改）。

NAS：docker-compose.yml 的 api 服務，nginx 把 /api/ 轉給它。
本機預覽：python3 tools/plan_api.py --port 8767 --static . --data data
"""
import argparse
import hmac
import json
import math
import os
import re
import shutil
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SCHEMA = 1
MAX_BODY = 2 * 1024 * 1024
MAX_DAYS = 60
MAX_STOPS = 60
KEEP_BACKUPS = 30
LOCK = threading.Lock()


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def empty_plan():
    return {"schema": SCHEMA, "rev": 0, "updated_at": None, "days": {}}


class Invalid(ValueError):
    pass


def _num(v, lo, hi, what):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not lo <= v <= hi:
        raise Invalid("%s 數值不正確" % what)
    return v


def _str(v, n, what):
    if not isinstance(v, str) or len(v) > n:
        raise Invalid("%s 文字不正確" % what)
    return v


def validate(body):
    """只接受預期的結構與大小；不信任前端送來的任何內容"""
    if not isinstance(body, dict) or body.get("schema") != SCHEMA:
        raise Invalid("schema 不符")
    days = body.get("days")
    if not isinstance(days, dict) or len(days) > MAX_DAYS:
        raise Invalid("days 格式不正確")
    out = {}
    for k, d in days.items():
        if not re.fullmatch(r"[1-9]\d?", str(k)) or not isinstance(d, dict):
            raise Invalid("day 編號不正確")
        stops, legs = d.get("stops"), d.get("legs")
        if not isinstance(stops, list) or not 1 <= len(stops) <= MAX_STOPS:
            raise Invalid("Day %s 站點數量不正確" % k)
        if not isinstance(legs, list) or len(legs) != len(stops):
            raise Invalid("Day %s 路段數量與站點不符" % k)
        clean_stops = []
        for s in stops:
            if not isinstance(s, dict):
                raise Invalid("站點格式不正確")
            c = {}
            if "ref" in s:
                c["ref"] = _str(s["ref"], 80, "ref")
                if not re.fullmatch(r"[A-Za-z0-9_\-]+", c["ref"]):
                    raise Invalid("ref 不正確")
            elif isinstance(s.get("custom"), dict):
                cu = s["custom"]
                cid = _str(cu.get("id"), 40, "custom.id")
                if not re.fullmatch(r"c_[A-Za-z0-9_]+", cid):
                    raise Invalid("custom.id 不正確")
                c["custom"] = {
                    "id": cid,
                    "name_zh": _str(cu.get("name_zh", ""), 120, "名稱"),
                    "name_local": _str(cu.get("name_local", ""), 120, "當地名稱"),
                    "lat": _num(cu.get("lat"), -90, 90, "緯度"),
                    "lon": _num(cu.get("lon"), -180, 180, "經度"),
                    "category": _str(cu.get("category", "ATTRACTION"), 30, "分類"),
                    "visit_min": _num(cu.get("visit_min", 0), 0, 1440, "停留"),
                    "notes": _str(cu.get("notes", ""), 500, "備註"),
                }
            else:
                raise Invalid("站點缺少 ref 或 custom")
            if "visit_min" in s and s["visit_min"] is not None:
                c["visit_min"] = _num(s["visit_min"], 0, 1440, "停留")
            clean_stops.append(c)
        clean_legs = []
        for lg in legs:
            if lg is None:
                clean_legs.append(None)
                continue
            if not isinstance(lg, dict):
                raise Invalid("路段格式不正確")
            coords = lg.get("coords")
            if not isinstance(coords, list) or not 2 <= len(coords) <= 20000:
                raise Invalid("路線座標不正確")
            for p in coords:
                if not isinstance(p, list) or len(p) != 2:
                    raise Invalid("路線座標不正確")
                _num(p[0], -180, 180, "經度"); _num(p[1], -90, 90, "緯度")
            roads = lg.get("roads", [])
            if not isinstance(roads, list) or len(roads) > 200:
                raise Invalid("道路清單不正確")
            for r in roads:
                if not isinstance(r, list) or len(r) != 2:
                    raise Invalid("道路清單不正確")
                _str(r[0], 80, "道路"); _num(r[1], 0, 5000, "道路長度")
            c = {"km": _num(lg.get("km"), 0, 5000, "里程"), "min": _num(lg.get("min"), 0, 6000, "時間"),
                 "roads": roads, "coords": coords}
            via = lg.get("via")
            if via is not None:
                if not isinstance(via, list) or len(via) > 20:
                    raise Invalid("繞行點不正確")
                for p in via:
                    if not isinstance(p, list) or len(p) != 2:
                        raise Invalid("繞行點不正確")
                    _num(p[0], -90, 90, "緯度"); _num(p[1], -180, 180, "經度")
                c["via"] = via
            if lg.get("estimate"):
                c["estimate"] = 1
            clean_legs.append(c)
        out[str(int(k))] = {"stops": clean_stops, "legs": clean_legs, "updated_at": now_iso()}
    base = body.get("base_version")
    return {"days": out, "base_version": _str(base, 40, "base_version") if base is not None else None}


class Store:
    def __init__(self, data_dir):
        self.dir = Path(data_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        (self.dir / "backups").mkdir(exist_ok=True)
        self.file = self.dir / "plan.json"

    def read(self):
        try:
            p = json.loads(self.file.read_text("utf-8"))
            return p if isinstance(p, dict) and p.get("schema") == SCHEMA else empty_plan()
        except FileNotFoundError:
            return empty_plan()
        except (OSError, ValueError):
            return empty_plan()

    def write(self, clean, expect_rev):
        with LOCK:
            cur = self.read()
            if expect_rev != cur.get("rev", 0):
                return None, cur
            old_days = cur.get("days", {})
            for k, d in clean["days"].items():          # 沒變的天保留原本的更新時間
                o = old_days.get(k)
                if o and o.get("stops") == d["stops"] and o.get("legs") == d["legs"]:
                    d["updated_at"] = o.get("updated_at") or d["updated_at"]
            nxt = {"schema": SCHEMA, "rev": cur.get("rev", 0) + 1, "updated_at": now_iso(),
                   "base_version": clean["base_version"], "days": clean["days"]}
            if self.file.exists():
                stamp = time.strftime("%Y%m%dT%H%M%S")
                shutil.copy2(self.file, self.dir / "backups" / ("plan-%s-r%d.json" % (stamp, cur.get("rev", 0))))
                olds = sorted((self.dir / "backups").glob("plan-*.json"))
                for f in olds[:-KEEP_BACKUPS]:
                    f.unlink(missing_ok=True)
            tmp = self.file.with_suffix(".tmp")
            tmp.write_text(json.dumps(nxt, ensure_ascii=False, separators=(",", ":")), "utf-8")
            os.replace(tmp, self.file)
            return nxt, None


def make_handler(store, token, static_dir):
    class Handler(SimpleHTTPRequestHandler):
        server_version = "IcelandPlan/1"
        sys_version = ""

        def __init__(self, *a, **kw):
            super().__init__(*a, directory=static_dir or os.devnull, **kw)

        def log_message(self, fmt, *args):
            sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))

        def _api(self):
            path = self.path.split("?", 1)[0]
            if path.endswith("/api/plan"):
                return "plan"
            if path.endswith("/api/health"):
                return "health"
            return None

        def _json(self, code, obj):
            raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            api = self._api()
            if api == "plan":
                return self._json(200, store.read())
            if api == "health":
                return self._json(200, {"ok": True, "token_required": bool(token)})
            if not static_dir:
                return self._json(404, {"error": "not found"})
            return super().do_GET()

        def do_HEAD(self):
            if self._api() or not static_dir:
                return self._json(405, {"error": "method not allowed"})
            return super().do_HEAD()

        def do_PUT(self):
            if self._api() != "plan":
                return self._json(404, {"error": "not found"})
            if token and not hmac.compare_digest(self.headers.get("X-Edit-Token", ""), token):
                return self._json(401, {"error": "需要編輯密碼"})
            if "json" not in (self.headers.get("Content-Type") or ""):
                return self._json(415, {"error": "需為 JSON"})
            try:
                n = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                n = -1
            if not 0 < n <= MAX_BODY:
                return self._json(413, {"error": "資料過大"})
            try:
                body = json.loads(self.rfile.read(n).decode("utf-8"))
                clean = validate(body)
                rev = body.get("rev")
                if isinstance(rev, bool) or not isinstance(rev, int):
                    raise Invalid("缺少 rev")
            except Invalid as e:
                return self._json(400, {"error": str(e)})
            except (ValueError, UnicodeDecodeError):
                return self._json(400, {"error": "JSON 格式不正確"})
            saved, cur = store.write(clean, rev)
            if saved is None:
                return self._json(409, {"error": "行程已被其他裝置更新", "rev": cur.get("rev", 0), "updated_at": cur.get("updated_at")})
            return self._json(200, {"ok": True, "rev": saved["rev"], "updated_at": saved["updated_at"]})

        def do_POST(self):
            return self._json(405, {"error": "method not allowed"})

        do_DELETE = do_POST

    return Handler


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--bind", default="0.0.0.0")
    ap.add_argument("--data", default="data", help="存檔資料夾")
    ap.add_argument("--static", default=None, help="本機預覽時一併提供網站靜態檔（NAS 上由 nginx 提供，不用設）")
    a = ap.parse_args()
    token = os.environ.get("EDIT_TOKEN", "").strip()
    store = Store(a.data)
    static_dir = str(Path(a.static).resolve()) if a.static else None
    srv = ThreadingHTTPServer((a.bind, a.port), make_handler(store, token, static_dir))
    print("行程調整 API：http://%s:%d/api/plan  存檔：%s  編輯密碼：%s" % (
        a.bind, a.port, store.file, "已設定" if token else "未設定"), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
