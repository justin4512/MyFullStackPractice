#!/usr/bin/env python3
"""
冰島追極光之旅: 行程資料產生器

輸入
  - Google Apps Script 住宿 API（?action=read）：每晚飯店、入住退房、座標、連結
  - tools/base_catalog.json：景點目錄與地圖分類（由舊版行程萃取）
  - 本檔 PLAN：每日要走的景點順序（以飯店為每日終點）

輸出
  - js/data.js：window.DATA = { meta, categories, hotels, days, locations, routes }

計算
  - 里程／行車時間：OSRM 路網（router.project-osrm.org），冬季係數 ×1.20
  - 路線幾何：OSRM simplified geometry
  - 日照／天文黑暗：NOAA 太陽位置近似式，以當晚住宿座標計算（誤差約數分鐘）

用法
  python3 tools/build_itinerary.py            # 抓最新 API 再產生
  python3 tools/build_itinerary.py --offline  # 使用 tools/api_snapshot.json
"""
import json, math, re, subprocess, sys, time, unicodedata
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://script.google.com/macros/s/AKfycbwY-gk88Blyroy8T0xYjEBuRQ25kJEsIp_BAxgMZJ5E3xzq2Ym4bc01QAXxf8lSrnd4GA/exec"
OSRM = "https://router.project-osrm.org/route/v1/driving/"
WINTER = 1.20

# ---------------------------------------------------------------------------
# 飯店所在區域（API 只有飯店名稱，區域依座標判讀）與光害推估
# ---------------------------------------------------------------------------
HOTEL_AREA = {
    1:  ("桑德蓋爾濟", "Sandgerði", 4),
    2:  ("塞爾福斯北郊", "Grímsnes", 3),
    3:  ("赫沃爾斯沃勒", "Hvolsvöllur", 4),
    4:  ("維克西郊", "Reynishverfi", 3),
    5:  ("教堂鎮西南", "Kirkjubæjarklaustur", 2),
    6:  ("赫本", "Höfn", 4),
    7:  ("埃斯基菲厄澤", "Eskifjörður", 4),
    8:  ("胡薩維克南郊", "Aðaldalur", 2),
    9:  ("阿克雷里東岸", "Vaðlaheiði", 5),
    10: ("瓦爾馬希利德", "Varmahlíð", 3),
    11: ("米拉爾", "Mýrar", 2),
    12: ("莫斯費德斯拜爾近郊", "Mosfellsbær", 6),
    13: ("哈夫尼爾", "Hafnir", 3),
}

# ---------------------------------------------------------------------------
# 每日規劃。nodes 依行進順序；("via", lat, lon) 只用於導航（強制走冬季可通行道路）
# 景點後綴 "*" = 原路折返；optional = 時間允許才去的備選景點（不計入當日里程）
# ---------------------------------------------------------------------------
PLAN = [
    dict(title="抵達日｜雷克雅內斯半島", region="雷克雅內斯", start="凱夫拉維克機場",
         nodes=["kef_airport", "blue_lagoon", "hotel:1"],
         notes="取車後先確認冬季胎與除冰工具；藍湖建議預約午後場次。住宿就在機場北側的海邊小鎮，夜裡往海岸走幾分鐘即可避開路燈。"),
    dict(title="金環｜Þingvellir → Geysir → Gullfoss", region="金環",
         nodes=["thingvellir", "geysir", "gullfoss", "kerid_crater", "hotel:2"],
         notes="金環三點為主要觀光日；3 月步道仍常結冰，Gullfoss 與 Kerið 建議穿冰爪。今晚住宿在鄉間，光害低。"),
    dict(title="南部｜Selfoss 補給與塞里雅蘭瀑布", region="南部",
         nodes=["selfoss", "seljalandsfoss*", "hotel:3"],
         notes="本日車程短：上午在 Selfoss 補給，下午看 Seljalandsfoss 後折返 Hvolsvöllur 入住，保留體力給夜間極光。"),
    dict(title="南岸｜瀑布、冰川與黑沙灘", region="南岸",
         nodes=["skogafoss", "solheimajokull", "dyrholaey", "reynisfjara", "hotel:4"],
         notes="南岸是全島雲量最多的路段，當日以 vedur.is 雲圖決定景點順序；雷尼斯黑沙灘務必保持浪距。"),
    dict(title="東南｜維克 → 羽毛河峽谷 → 教堂鎮", region="東南",
         nodes=["vik", "fjadrargljufur", "kirkjubaejarklaustur", "hotel:5*"],
         notes="車程短的一天：羽毛河峽谷冬季步道可能封閉，以現場告示為準；住宿在教堂鎮西南，逛完需回頭約 25 km。"),
    dict(title="冰河湖｜Skaftafell → Jökulsárlón", region="東南／瓦特納",
         nodes=["skaftafell", "svartifoss", "jokulsarlon", "diamond_beach", "hotel:6"],
         notes="里程長、景點多；Skaftafell 與冰河湖各留 1.5 小時以上，建議 08:00 前出發。"),
    dict(title="東峽灣｜Vestrahorn → Djúpivogur → Eskifjörður", region="東部峽灣",
         nodes=["vestrahorn*", "djupivogur", ("via", 64.7876, -14.0106), ("via", 64.9290, -14.0180), "hotel:7"],
         notes="東峽灣多彎道與單線橋；Öxi(939) 冬季封閉，本日沿 1 號公路走峽灣線，經 Breiðdalsvík 與 Fáskrúðsfjörður 隧道。"),
    dict(title="東北｜Egilsstaðir → Stuðlagil → Dettifoss", region="東北",
         nodes=["egilsstadir", "studlagil*", "dettifoss*", ("via", 65.6416, -16.9100), "hotel:8"],
         optional=["seydisfjordur"],
         notes="全行程最長的一日；Stuðlagil 冬季走東岸觀景台，Dettifoss 走 862 西岸支線。出發前在 umferdin.is 確認路況，任一封閉就直接略過。"),
    dict(title="北冰島｜Húsavík → Ásbyrgi → Goðafoss", region="北部",
         nodes=["husavik", "asbyrgi*", ("via", 66.0433, -17.3410), "godafoss", "hotel:9"],
         notes="Ásbyrgi 冬季只到峽谷口停車場；Húsavík 賞鯨冬季班次少，需事先預約。今晚起在阿克雷里東岸連住 2 晚。"),
    dict(title="米湖｜Dimmuborgir → Hverir → 米湖", region="米湖",
         nodes=["dimmuborgir", "namaskard_hverir", "myvatn", "hotel:9:back"],
         notes="連住日：往返米湖全程約 180 km，行程彈性最大。米湖一帶 Bortle 2，是全行程最好的觀測地，可待到深夜再回住宿。"),
    dict(title="北冰島｜Akureyri → Skagafjörður", region="北部",
         nodes=["akureyri", "hotel:10"],
         optional=["dalvik", "saudarkrokur"],
         notes="阿克雷里為北冰島補給核心；本日車程短，Dalvík 與 Sauðárkrókur 為備選，時間與天氣允許再去。"),
    dict(title="西北｜Blönduós → Hvítserkur → Borgarnes", region="西北",
         nodes=["blonduos", "hvitserkur", "hvammstangi", "borgarnes", "hotel:11"],
         optional=["hraunfossar", "barnafoss", "deildartunguhver"],
         notes="西北補給稀疏，在 Blönduós 加滿油；Hvítserkur 走 711 碎石路，冬季需確認。Borgarfjörður 三個景點為備選，時間不夠就略過。"),
    dict(title="斯奈山半島環線｜Arnarstapi → 教會山", region="斯奈山半島",
         nodes=["arnarstapi", "djupalonssandur", "olafsvik", "kirkjufell", "grundarfjordur", "stykkisholmur", "hotel:12"],
         optional=["bjarnarhofn", "akranes"],
         notes="全行程里程最長的一日之一；574 號西段冬季可能結冰。天氣不佳時只走南岸 Arnarstapi，再原路返回首都圈。"),
    dict(title="首都｜雷克雅維克 → Grótta → Hafnir", region="首都圈",
         nodes=["reykjavik", "grotta_lighthouse", "hotel:13"],
         notes="白天逛雷克雅維克市區，傍晚到 Grótta 燈塔守極光（首都圈最佳觀測點），再開約 60 km 回雷克雅內斯半島入住。"),
    dict(title="離境日", region="雷克雅內斯",
         nodes=["kef_airport_out"],
         notes="Hafnir 距機場約 20 分鐘；仍建議預留除冰、加油與還車時間。"),
]


# ---------------------------------------------------------------------------
def fetch_json(url, tries=3):
    """用 curl 抓取：macOS 內建 Python 的 LibreSSL 與部分 TLS 伺服器握手失敗。"""
    for i in range(tries):
        r = subprocess.run(["curl", "-sSL", "-m", "40", "-A", "iceland-itinerary-builder", url],
                           capture_output=True, text=True)
        if r.returncode == 0:
            try:
                return json.loads(r.stdout)
            except ValueError:
                pass
        if i == tries - 1:
            raise SystemExit("fetch failed: %s\n%s" % (url[:120], r.stderr or r.stdout[:200]))
        time.sleep(2 + i * 2)


def local_date(iso):
    """試算表存的是當地午夜（例如 +08:00），轉 UTC 後加 12 小時再取日期即可還原。"""
    t = datetime.fromisoformat(iso.replace("Z", "+00:00")) + timedelta(hours=12)
    return t.date().isoformat()


def split_name(raw):
    parts = [p.strip() for p in re.split(r"／| / ", raw) if p.strip()]
    cjk = [p for p in parts if re.search(r"[一-鿿]", p)]
    latin = [p for p in parts if p not in cjk]
    if cjk and latin:
        return cjk[0], latin[0]
    return parts[0], ""


def norm_url(u):
    u = (u or "").strip()
    if not u:
        return ""
    if not re.match(r"^https?://", u):
        u = "https://" + u.lstrip("/")
    return u


def norm_img(u):
    """圖片可用完整網址，或專案內的相對路徑 images/xxx.jpg（保留原樣，由前端編碼）。"""
    u = unicodedata.normalize("NFC", (u or "").strip())
    rel = re.sub(r"^\.?/", "", u)
    if re.match(r"^images/[^?#]+\.(jpe?g|png|webp|gif|avif)$", rel, re.I) and ".." not in rel:
        return rel
    return norm_url(u)


def load_hotels(offline):
    snap = ROOT / "tools" / "api_snapshot.json"
    if offline:
        raw = json.loads(snap.read_text())
    else:
        raw = fetch_json(API + "?action=read")
        if raw.get("status") != "success":
            raise SystemExit("API error: %s" % raw)
        snap.write_text(json.dumps(raw, ensure_ascii=False, indent=1))
    hotels = []
    for r in raw["data"]:
        zh, local = split_name(r["住宿名稱定位點"])
        hotels.append(dict(
            id=int(r["id"]), name=r["住宿名稱定位點"], name_zh=zh, name_local=local,
            checkin=local_date(r["入住日期"]), checkout=local_date(r["退房日期"]), nights=int(r["晚數"]),
            lat=float(r["latitude"]), lon=float(r["longitude"]),
            gmaps=norm_url(r.get("googlemaps")), booking=norm_url(r.get("bookinglink")),
            image=norm_img(r.get("imageurl")), source=norm_url(r.get("網站來源")),
        ))
    hotels.sort(key=lambda h: h["checkin"])
    return hotels


# ---------------------------------------------------------------------------
# NOAA 太陽高度角（度）
def solar_elevation(dt_utc, lat, lon):
    jd = dt_utc.timestamp() / 86400.0 + 2440587.5
    t = (jd - 2451545.0) / 36525.0
    l0 = (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360
    m = 357.52911 + t * (35999.05029 - 0.0001537 * t)
    e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
    mr = math.radians(m)
    c = (math.sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) + math.sin(2 * mr) * (0.019993 - 0.000101 * t)
         + math.sin(3 * mr) * 0.000289)
    true_long = l0 + c
    omega = 125.04 - 1934.136 * t
    lam = true_long - 0.00569 - 0.00478 * math.sin(math.radians(omega))
    eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    eps = eps0 + 0.00256 * math.cos(math.radians(omega))
    decl = math.degrees(math.asin(math.sin(math.radians(eps)) * math.sin(math.radians(lam))))
    y = math.tan(math.radians(eps / 2)) ** 2
    l0r = math.radians(l0)
    eqt = 4 * math.degrees(y * math.sin(2 * l0r) - 2 * e * math.sin(mr) + 4 * e * y * math.sin(mr) * math.cos(2 * l0r)
                           - 0.5 * y * y * math.sin(4 * l0r) - 1.25 * e * e * math.sin(2 * mr))
    minutes = dt_utc.hour * 60 + dt_utc.minute + dt_utc.second / 60
    tst = (minutes + eqt + 4 * lon) % 1440
    ha = tst / 4 - 180
    zen = math.degrees(math.acos(
        math.sin(math.radians(lat)) * math.sin(math.radians(decl))
        + math.cos(math.radians(lat)) * math.cos(math.radians(decl)) * math.cos(math.radians(ha))))
    return 90 - zen


def sun_facts(day_iso, lat, lon):
    d = date.fromisoformat(day_iso)
    base = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    elev = [solar_elevation(base + timedelta(minutes=i), lat, lon) for i in range(0, 1440 * 2)]
    day = elev[:1440]
    up = [i for i in range(1, 1440) if day[i - 1] < -0.833 <= day[i]]
    down = [i for i in range(1, 1440) if day[i - 1] >= -0.833 > day[i]]
    daylight = sum(1 for v in day if v > -0.833) / 60
    night = elev[720:720 + 1440]          # 當天中午到隔天中午 = 「當晚」
    astro = sum(1 for v in night if v < -18) / 60
    hm = lambda m: "%02d:%02d" % (m // 60, m % 60)
    return dict(daylight_h=round(daylight, 1), astro_dark_h=round(astro, 1),
                sunrise_utc=hm(up[0]) if up else "", sunset_utc=hm(down[0]) if down else "")


# ---------------------------------------------------------------------------
def osrm(points):
    coords = ";".join("%.5f,%.5f" % (lon, lat) for lat, lon in points)
    url = OSRM + coords + "?overview=simplified&geometries=geojson&steps=false"
    d = fetch_json(url)
    if d.get("code") != "Ok":
        raise SystemExit("OSRM error: %s" % d)
    time.sleep(1.1)                       # 公用伺服器：每秒最多 1 次
    r = d["routes"][0]
    return [(l["distance"] / 1000, l["duration"] / 60) for l in r["legs"]], r["geometry"]


def main():
    offline = "--offline" in sys.argv
    base = json.loads((ROOT / "tools" / "base_catalog.json").read_text())
    cats = base["categories"]
    catalog = {l["id"]: l for l in base["locations"]}
    hotels = load_hotels(offline)
    hotel_by_id = {h["id"]: h for h in hotels}
    trip_start = date.fromisoformat(hotels[0]["checkin"])
    trip_end = date.fromisoformat(hotels[-1]["checkout"])
    if len(PLAN) != (trip_end - trip_start).days + 1:
        raise SystemExit("PLAN 天數 (%d) 與住宿日期 (%s ~ %s) 不符" % (len(PLAN), trip_start, trip_end))

    def hotel_loc(hid, day, order, back=False):
        h = hotel_by_id[hid]
        zh_area, local_area, bortle = HOTEL_AREA.get(hid, ("", "", 3))
        return dict(
            id="hotel_%d%s" % (hid, "_back" if back else ""), same_as="hotel_%d" % hid if back else None,
            hotel_id=hid, name_zh=("返回 " if back else "") + h["name_zh"], name_local=h["name_local"] or local_area,
            category="STAY", lat=h["lat"], lon=h["lon"], visit_min=0, road="", winter_access="OPEN",
            bortle=bortle, aurora_score=3 if bortle <= 3 else 2 if bortle == 4 else 1,
            source="Google Sheets 住宿 API", notes="%s（%s）住宿，%s 入住、%s 退房，共 %d 晚。" % (
                zh_area, local_area, h["checkin"][5:].replace("-", "/"), h["checkout"][5:].replace("-", "/"), h["nights"]),
        )

    days, locations, features = [], [], []
    prev_stay = None
    for di, p in enumerate(PLAN):
        d_iso = (trip_start + timedelta(days=di)).isoformat()
        tonight = next((h for h in hotels if h["checkin"] <= d_iso < h["checkout"]), None)
        stops, points, pending_via = [], [], []
        if prev_stay:
            points.append((prev_stay["lat"], prev_stay["lon"]))
        for n in p["nodes"]:
            if isinstance(n, tuple):
                points.append((n[1], n[2]))
                pending_via.append(len(points) - 1)
                continue
            oab = n.endswith("*")
            key = n.rstrip("*")
            if key.startswith("hotel:"):
                parts = key.split(":")
                loc = hotel_loc(int(parts[1]), di, 0, back=len(parts) > 2)
            elif key == "kef_airport_out":
                loc = dict(catalog["kef_airport"], id="kef_airport_out", same_as="kef_airport",
                           name_zh="凱夫拉維克國際機場（離境）", visit_min=0)
            else:
                loc = dict(catalog[key])
            loc["out_and_back"] = 1 if oab else 0
            points.append((loc["lat"], loc["lon"]))
            stops.append((loc, len(points) - 1))

        if len(points) >= 2:
            legs, geom = osrm(points)
        else:
            legs, geom = [], None
        cum = 0.0
        tot_min = 0.0
        for order, (loc, pi) in enumerate(stops, 1):
            # 這個站點的里程 = 從上一個「站點」到它之間所有 leg（含 via）
            prev_pi = stops[order - 2][1] if order > 1 else (0 if prev_stay else pi)
            km = sum(legs[k][0] for k in range(prev_pi, pi)) if pi > prev_pi else 0.0
            mins = sum(legs[k][1] for k in range(prev_pi, pi)) if pi > prev_pi else 0.0
            cum += km
            tot_min += mins
            loc.update(day=di, order=order, stay_town=HOTEL_AREA.get(tonight["id"], ("",))[0] if tonight else "",
                       leg_km=round(km, 1), leg_min=round(mins), leg_min_winter=round(mins * WINTER),
                       cum_km_day=round(cum, 1), optional=0)
            loc.setdefault("same_as", None)
            locations.append(loc)
        for k, key in enumerate(p.get("optional", []), 1):
            loc = dict(catalog[key])
            loc.update(day=di, order=len(stops) + k, stay_town="", leg_km=0, leg_min=0, leg_min_winter=0,
                       cum_km_day=0, out_and_back=0, optional=1, same_as=None)
            locations.append(loc)

        stay = hotel_by_id[tonight["id"]] if tonight else None
        area = HOTEL_AREA.get(tonight["id"]) if tonight else None
        sun_lat, sun_lon = (stay["lat"], stay["lon"]) if stay else (stops[-1][0]["lat"], stops[-1][0]["lon"])
        visit = sum(s[0]["visit_min"] or 0 for s in stops if s[0]["category"] != "STAY")
        start_area = p.get("start") or (HOTEL_AREA[prev_stay["id"]][0] if prev_stay else "")
        days.append(dict(
            day=di, date=d_iso, title_zh=p["title"], region=p["region"],
            start_town=start_area, stay_town=area[0] if area else "", stay_town_local=area[1] if area else "",
            hotel_id=tonight["id"] if tonight else None,
            route_km=round(sum(l[0] for l in legs)), drive_min=round(sum(l[1] for l in legs)),
            drive_min_winter=round(sum(l[1] for l in legs) * WINTER), visit_min=visit,
            stay_lat=round(sun_lat, 4), notes=p["notes"], **sun_facts(d_iso, sun_lat, sun_lon)))
        if geom:
            features.append(dict(type="Feature", properties=dict(day=di, stay_town=days[-1]["stay_town"]), geometry=geom))
        prev_stay = stay or prev_stay
        print("Day %2d %s %-28s %4d km %5d min" % (di, d_iso, p["title"][:14], days[-1]["route_km"], days[-1]["drive_min"]))

    for l in locations:
        if not l.get("same_as"):
            l.pop("same_as", None)

    data = dict(
        meta=dict(version=date.today().isoformat(), trip_start=trip_start.isoformat(), trip_end=trip_end.isoformat(),
                  nights=sum(h["nights"] for h in hotels), winter_factor=WINTER, hotel_api=API),
        categories=cats, hotels=hotels, days=days, locations=locations,
        routes=dict(type="FeatureCollection", features=features))

    out = ["/* 冰島追極光之旅: 行程資料（由 tools/build_itinerary.py 產生，請勿手動修改）",
           "   住宿：Google Sheets 住宿 API 快照；里程與路線：OSRM；日照：NOAA 近似式 */",
           "window.DATA = {"]
    for i, key in enumerate(["meta", "categories", "hotels", "days", "locations", "routes"]):
        v = data[key]
        tail = "," if i < 5 else ""
        if isinstance(v, list):
            out.append('  "%s": [' % key)
            out.append(",\n".join("    " + json.dumps(r, ensure_ascii=False, separators=(", ", ": ")) for r in v))
            out.append("  ]" + tail)
        else:
            out.append('  "%s": %s%s' % (key, json.dumps(v, ensure_ascii=False, separators=(",", ":")), tail))
    out.append("};")
    (ROOT / "js" / "data.js").write_text("\n".join(out) + "\n")
    print("wrote js/data.js: %d days, %d locations, %d hotels" % (len(days), len(locations), len(hotels)))


if __name__ == "__main__":
    main()
