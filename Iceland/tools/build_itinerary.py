#!/usr/bin/env python3
"""
冰島追極光之旅: 行程資料產生器

輸入
  - Google Apps Script 住宿 API（?action=read）：每晚飯店、入住退房、座標、連結
  - tools/base_catalog.json：地圖分類（categories）
  - 本檔 POINTS：所有站點的座標與屬性（停車場／入口座標，依「冰島冬季環島路線清單.md」）
  - 本檔 PLAN：每日要走的景點順序（以飯店為每日終點、隔天起點）

輸出
  - js/data.js：window.DATA = { meta, categories, hotels, days, locations, routes }

計算
  - 里程／行車時間：OSRM 路網（router.project-osrm.org），冬季係數 ×1.20
  - 路線幾何：OSRM 逐段（leg）道路幾何，Douglas-Peucker 簡化；並記錄每段經過的道路
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
    2:  ("格里姆斯內斯", "Grímsnes", 3),
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

# 試算表座標有誤時的修正（前端即時同步也不會覆蓋）；請同步更新住宿試算表
HOTEL_COORD_OVERRIDE = {
    2: (64.0382897, -20.7807394),   # Myrarkot：試算表 64.0152,-20.978 偏 14 km（2026-10-04 確認）
}

# ---------------------------------------------------------------------------
# 站點：id → (分類, lat, lon, 中文名, 當地名, 停留分, Bortle, 極光分, 冬季, 道路, 說明)
# 未列在這裡的 id 取自 base_catalog.json（舊景點目錄）
# ---------------------------------------------------------------------------
def _p(cat, lat, lon, zh, local, visit, bortle, aurora, winter, road, notes, **kw):
    d = dict(category=cat, lat=lat, lon=lon, name_zh=zh, name_local=local, visit_min=visit, bortle=bortle,
             aurora_score=aurora, winter_access=winter, road=road, notes=notes, source="OSM/Nominatim 2026-10")
    d.update(kw)
    return d

POINTS = {
    "kef_terminal":   _p("AIRPORT", 63.9901629, -22.5500845, "凱夫拉維克國際機場", "Keflavík Airport", 0, 6, 0, "OPEN", "41", "入境、取車（預約 4WD＋冬季胎）"),
    "sky_lagoon":     _p("GEOTHERMAL", 64.1164654, -21.9464351, "Sky Lagoon", "Kársnes, Kópavogur", 120, 7, 1, "OPEN", "", "海景無邊際溫泉，需預約時段"),
    "phallological":  _p("MUSEUM", 64.148464, -21.9383505, "陰莖博物館", "Hið Íslenzka Reðasafn", 60, 8, 0, "OPEN", "", "市中心港區"),
    "bonus_rvk":      _p("SUPERMARKET", 64.1388445, -21.9326496, "小豬超市", "Bónus", 30, 8, 0, "OPEN", "", "出城前補給"),
    "kerid":          _p("CRATER", 64.03981, -20.88481, "凱瑞斯火山口", "Kerið", 40, 3, 1, "CAUTION", "35", "湖面結冰時可環湖；邊坡濕滑"),
    "thingvellir":    _p("NATIONAL_PARK", 64.27861, -21.08194, "辛格韋德利國家公園（Silfra）", "Þingvellir", 120, 2, 3, "OPEN", "36", "板塊張裂谷；Silfra 浮潛在園區內，依預約時段"),
    "haukadalur":     _p("GEOTHERMAL", 64.3089, -20.30049, "赫伊卡達勒地熱谷", "Haukadalur（Geysir）", 75, 2, 1, "OPEN", "37", "Strokkur 每 6-10 分鐘噴發"),
    "gullfoss":       _p("WATERFALL", 64.31445, -20.14956, "黃金瀑布", "Gullfoss", 60, 2, 1, "CAUTION", "35", "冬季步道結冰；停車場風大"),
    "seljalandsfoss": _p("WATERFALL", 63.6152545, -19.9938969, "塞里雅蘭瀑布", "Seljalandsfoss（停車場）", 45, 3, 1, "CAUTION", "1→249", "冬季環瀑步道封閉；路面結冰"),
    "bru_base":       _p("ATTRACTION", 63.6545466, -19.9425606, "布魯基地", "Brú Base Camp", 0, 3, 1, "OPEN", "249", "行程集合點，停留時間依預約時段"),
    "skogafoss":      _p("WATERFALL", 63.5321, -19.51129, "斯科加瀑布（彩虹瀑布）", "Skógafoss", 60, 3, 1, "CAUTION", "1", "觀景樓梯結冰；水霧影響鏡頭"),
    "dyrholaey":      _p("VIEWPOINT", 63.39883, -19.12663, "迪霍拉里海岬", "Dyrhólaey", 60, 3, 2, "CAUTION", "218", "冬季上層區可能封閉；風極強"),
    "kronan_vik":     _p("SUPERMARKET", 63.4174522, -18.99909, "維克超市", "Krónan Vík", 30, 4, 1, "OPEN", "1", "南岸主要補給點"),
    "vik_church":     _p("ATTRACTION", 63.4205269, -19.0029349, "維克紅頂教堂", "Víkurkirkja", 25, 4, 2, "OPEN", "", "山坡上的紅頂教堂，可俯瞰黑沙灘"),
    "reynisfjara":    _p("BEACH", 63.40443, -19.0588, "雷尼斯黑沙灘", "Reynisfjara", 35, 3, 2, "CAUTION", "215", "【危險】瘋狗浪；嚴禁靠近水線，不要排到天黑後"),
    "solheimajokull": _p("GLACIER", 63.5300216, -19.3715365, "索爾黑馬冰川", "Sólheimajökull（停車場）", 60, 2, 1, "CAUTION", "221", "僅能隨嚮導上冰"),
    "katla_cave":     _p("ATTRACTION", 63.4175761, -19.0141372, "卡特拉黑冰洞", "Katla Ice Cave（集合點待確認）", 180, 4, 1, "CAUTION", "", "超級吉普車團；集合點待團主回覆，暫以維克 Katla Geopark 遊客中心定位", coord_pending=1),
    "kirkjubaejarklaustur": _p("TOWN", 63.79306, -18.04186, "教堂鎮", "Kirkjubæjarklaustur", 30, 3, 1, "OPEN", "1", "南岸最後補給點之一"),
    "fjadrargljufur": _p("ATTRACTION", 63.7726, -18.17372, "羽毛峽谷", "Fjaðrárgljúfur", 45, 2, 1, "CAUTION", "1→206", "冬季支線／步道常關閉，出發前查 road.is"),
    "diamond_beach":  _p("BEACH", 64.041758, -16.213967, "鑽石沙灘", "Breiðamerkurfjara（西側停車場）", 45, 3, 2, "CAUTION", "1", "【危險】勿踩浮冰、勿近浪區"),
    "jokulsarlon":    _p("GLACIER", 64.04801, -16.179689, "傑古沙龍冰河湖", "Jökulsárlón（停車場）", 90, 3, 3, "OPEN", "1", "南岸最佳極光前景之一"),
    "skaftafell":     _p("NATIONAL_PARK", 64.01645, -16.96646, "斯卡夫塔山", "Skaftafell", 150, 2, 1, "OPEN", "1", "瓦特納冰川國家公園遊客中心"),
    "stokksnes":      _p("VIEWPOINT", 64.2440415, -14.9672924, "天空之鏡", "Stokksnes", 15, 2, 3, "CAUTION", "1→Stokksnes", "西角山倒影黑沙灘；私人土地需購票"),
    "hvalnes":        _p("VIEWPOINT", 64.4022432, -14.5401157, "橘色燈塔", "Hvalnesviti", 50, 2, 2, "OPEN", "1", "黑沙礫灘上的橘色燈塔"),
    "djupivogur":     _p("TOWN", 64.65578, -14.2821, "迪尤皮沃格爾漁港", "Djúpivogur", 45, 3, 1, "OPEN", "1", "東峽灣入口小港"),
    "hallormsstadur": _p("ATTRACTION", 65.0932297, -14.7437562, "哈洛姆斯塔德森林", "Hallormsstaðaskógur", 100, 2, 1, "OPEN", "931", "冰島最大森林；先列入，時間不夠就刪"),
    "egilsstadir":    _p("TOWN", 65.2620412, -14.4035258, "埃伊爾斯塔濟", "Egilsstaðir", 30, 4, 2, "OPEN", "1", "東部最大城鎮：超市、加油站"),
    "viti":           _p("CRATER", 65.717677, -16.757552, "火山區（維提火山口）", "Víti, Krafla（停車場）", 45, 2, 2, "CAUTION", "863", "冬季通常有除雪，出發前確認路況"),
    "hverir":         _p("GEOTHERMAL", 65.642594, -16.803233, "地熱谷", "Hverir（停車場）", 45, 3, 1, "CAUTION", "1", "地熱蒸氣易侵蝕鏡頭；勿踏入泥漿區"),
    "grjotagja":      _p("ATTRACTION", 65.6264141, -16.8829708, "Grjótagjá 地裂縫山洞", "Grjótagjá", 30, 2, 1, "CAUTION", "860", "洞內溫泉禁止下水"),
    "myvatn":         _p("LAKE", 65.64156, -16.91001, "米湖（穿冰爪）", "Mývatn／Reykjahlíð", 60, 2, 3, "OPEN", "1", "冰島冬季雲量最少區之一；冰面安全以現場為準"),
    "dimmuborgir":    _p("ATTRACTION", 65.591616, -16.913105, "黑色城堡", "Dimmuborgir（停車場）", 60, 2, 1, "OPEN", "848", "熔岩柱地形；冬季步道積雪"),
    "pseudocraters":  _p("CRATER", 65.5686336, -17.0379227, "偽火山口", "Skútustaðagígar", 40, 2, 2, "OPEN", "848", "環湖步道約 30 分"),
    "godafoss":       _p("WATERFALL", 65.68282, -17.55062, "眾神瀑布", "Goðafoss", 45, 3, 1, "CAUTION", "1", "環形步道冬季結冰"),
    "vaglaskogur":    _p("ATTRACTION", 65.7157323, -17.8902749, "瓦拉森林", "Vaglaskógur", 45, 3, 1, "OPEN", "833", "冰島第二大森林"),
    "akureyri":       _p("CITY", 65.6798604, -18.0909423, "阿克雷里市區（雙塔大教堂）", "Akureyri", 90, 6, 1, "OPEN", "1", "北冰島首都；超市、加油站、裝備補齊"),
    "go_husky":       _p("ATTRACTION", 65.6839, -18.11218, "Go Husky 雪橇犬", "Go Husky（位置待確認）", 120, 5, 1, "OPEN", "", "座標未確認，暫以阿克雷里市區定位", coord_pending=1),
    "forest_lagoon":  _p("GEOTHERMAL", 65.6699183, -18.0417986, "Forest Lagoon 森林溫泉", "Skógarböðin", 120, 5, 2, "OPEN", "1", "需預約時段"),
    "polar_hestar":   _p("ATTRACTION", 65.9297845, -18.104077, "騎冰島馬", "Pólar Hestar", 120, 2, 2, "OPEN", "83", "Grýtubakki 農場，阿克雷里北方約 30 km"),
    "akureyri_museum": _p("MUSEUM", 65.6664658, -18.0862544, "阿克雷里博物館", "Minjasafnið á Akureyri", 60, 6, 0, "OPEN", "", "市區步行可達"),
    "botanical":      _p("ATTRACTION", 65.6751142, -18.0936681, "阿克雷里植物園", "Lystigarður Akureyrar", 45, 6, 0, "OPEN", "", "散步；附近有咖啡店與紀念品店"),
    "blonduos":       _p("TOWN", 65.66013, -20.281, "布倫迪歐斯", "Blönduós", 30, 4, 1, "OPEN", "1", "西北補給稀疏，在此加滿油"),
    "hraunfossar":    _p("WATERFALL", 64.7025647, -20.9806014, "赫倫瀑布群", "Hraunfossar", 45, 3, 1, "CAUTION", "50→518", "冬季停車場與步道易結冰"),
    "deildartunguhver": _p("GEOTHERMAL", 64.663626, -21.4105725, "溫泉眼", "Deildartunguhver", 30, 3, 0, "OPEN", "50", "歐洲流量最大的溫泉"),
    "borgarnes":      _p("FUEL", 64.53833, -21.92021, "博加內斯（加油）", "Borgarnes", 20, 5, 1, "OPEN", "1", "回首都圈前最好的補給點；隔天早上滿油直接往西"),
    "ytri_tunga":     _p("BEACH", 64.803966, -23.080407, "Ytri Tunga 海豹沙灘", "Ytri Tunga（停車場）", 45, 2, 2, "CAUTION", "54", "碎石支線；海豹多在退潮時出現"),
    "budakirkja":     _p("ATTRACTION", 64.821663, -23.3840222, "黑教堂", "Búðakirkja", 30, 2, 3, "OPEN", "574", "熔岩原上的黑色木教堂"),
    "arnarstapi":     _p("VIEWPOINT", 64.766689, -23.632953, "阿納斯塔皮", "Arnarstapi（停車場）", 60, 3, 2, "CAUTION", "574", "海蝕拱門步道結冰"),
    "londrangar":     _p("VIEWPOINT", 64.7324143, -23.7839013, "怪物海岸", "Lóndrangar（暫定）", 30, 2, 2, "CAUTION", "574", "暫以 Lóndrangar 玄武岩柱定位"),
    "djupalonssandur": _p("BEACH", 64.753555, -23.89499, "黑沙灘", "Djúpalónssandur（停車場）", 45, 2, 2, "CAUTION", "572", "碎石路；冬季強風浪"),
    "kirkjufell":     _p("VIEWPOINT", 64.927864, -23.313194, "教會山／教會山瀑布", "Kirkjufellsfoss（停車場）", 60, 3, 3, "CAUTION", "54", "冰島最經典極光構圖；停車場收費"),
    "hallgrimskirkja": _p("CITY", 64.1417951, -21.9267103, "首都（哈爾格林姆教堂）", "Reykjavík", 120, 8, 0, "OPEN", "", "市中心散步"),
    "blue_lagoon":    _p("GEOTHERMAL", 63.87917, -22.44432, "藍湖", "Bláa lónið", 50, 4, 1, "OPEN", "43", "需預約時段"),
    "hvammsvik":      _p("GEOTHERMAL", 64.3702092, -21.5733426, "豪姆斯維克溫泉", "Hvammsvík", 90, 3, 2, "OPEN", "47", "與藍湖二選一；在首都北邊，與 Hafnir 反方向"),
}

# Öxi（939）冬季封閉：東峽灣一律經 Breiðdalsvík 與 Fáskrúðsfjörður 隧道
VIA_BREIDDALSVIK = ("via", 64.7876, -14.0106)
VIA_FASKRUDSFJORDUR = ("via", 64.9290, -14.0180)
# 從峽灣進埃伊爾斯塔濟一律走 1 號公路 Fagridalur 段，避免導航走 F936（Þórdalsheiði，冬季封閉）
VIA_FAGRIDALUR = ("via", 65.160336, -14.339632)

# ---------------------------------------------------------------------------
# 每日規劃。nodes 依行進順序；("via", lat, lon) 只用於導航（強制走冬季可通行道路）
# 景點後綴 "*" = 原路折返；optional = 時間允許才去的備選景點（不計入當日里程）
# ---------------------------------------------------------------------------
PLAN = [
    dict(title="抵達日｜KEF → 桑德格迪", region="雷克雅內斯",
         nodes=["kef_terminal", "hotel:1"],
         notes="取車後先確認冬季胎與除冰工具。住宿就在機場北側的海邊小鎮，夜裡往海岸走幾分鐘即可避開路燈。"),
    dict(title="首都日｜Sky Lagoon、博物館、補給", region="首都圈",
         nodes=["sky_lagoon", "phallological", "bonus_rvk", "hotel:2"],
         notes="方案 A（最短）：先泡 Sky Lagoon，再進市區看博物館、在 Bónus 補給，最後往東約 75 km 到 Myrarkot。方案 B（最後泡湯）只多 1.4 km。"),
    dict(title="黃金圈｜Silfra 是主角", region="金環",
         nodes=["kerid", "thingvellir", "haukadalur", "gullfoss", "hotel:3"],
         notes="凱瑞斯離住宿最近，先看完再往北繞一圈，最後從黃金瀑布南下 Midgard，不走回頭路。Silfra 在辛格韋德利國家公園內。"),
    dict(title="雪地摩托與南岸瀑布", region="南岸",
         nodes=["seljalandsfoss", "bru_base", "skogafoss", "dyrholaey", "kronan_vik", "vik_church", "reynisfjara", "hotel:4"],
         notes="南岸是全島雲量最多的路段，以 vedur.is 雲圖微調順序；雷尼斯黑沙灘有瘋狗浪，不要排到天黑後。"),
    dict(title="Katla 冰洞、Vík 海岸、教堂鎮", region="南岸／東南",
         nodes=["skogafoss", "seljalandsfoss", "solheimajokull", "katla_cave", "kirkjubaejarklaustur", "fjadrargljufur", "hotel:5"],
         notes="暫定 6 點全排，現場依狀況排優先序，來不及的刪除；彩虹瀑布與塞里雅蘭 3/4 已去過，可優先捨棄。卡特拉冰洞團的集合點待團主回覆。"),
    dict(title="冰河湖與藍冰洞：東進前決策日", region="東南／瓦特納",
         nodes=["diamond_beach", "jokulsarlon", "hotel:6"],
         optional=["skaftafell"],
         notes="從西邊開過來先到鑽石沙灘西側停車場，再開 2.3 km 到冰河湖。Skaftafell 為備選（只多 7.6 km），時間寬裕可去。"),
    dict(title="東峽灣：住宿地址決定路線", region="東部峽灣",
         nodes=["stokksnes", "hvalnes", "djupivogur", VIA_BREIDDALSVIK, VIA_FASKRUDSFJORDUR, VIA_FAGRIDALUR, "hallormsstadur", "egilsstadir", "hotel:7"],
         notes="Öxi（939）與 F936 冬季封閉，經 Breiðdalsvík、Fáskrúðsfjörður 隧道與 1 號公路 Fagridalur 段。哈洛姆斯塔德森林先列入，冬季行車會超過 7 小時，來不及就刪。"),
    dict(title="東部到米湖：把跨區移動當主行程", region="東北／米湖",
         nodes=["egilsstadir", "viti", "hverir", "grjotagja", "myvatn", "dimmuborgir", "pseudocraters", "hotel:8"],
         notes="08:00 到埃伊爾斯塔濟，07:00 前從 Mjóeyri 出發。火山區走 863 號路到 Krafla，冬季通常有除雪，出發前確認。"),
    dict(title="眾神瀑布與阿克雷里：向西走、不折返", region="北部",
         nodes=["grjotagja", "godafoss", "vaglaskogur", "akureyri", "hotel:9"],
         notes="Grjótagjá 3/8 已排過，若不再去可省往返米湖約 55 km（待確認）。今晚起在阿克雷里東岸連住 2 晚。"),
    dict(title="北境體驗：雪橇犬優先、騎馬次之", region="阿克雷里",
         nodes=["akureyri", "go_husky", "forest_lagoon", "polar_hestar", "hotel:9:back"],
         notes="四個點都在阿克雷里附近，順序影響不大；Go Husky 位置待確認。"),
    dict(title="北部緩衝與向西換宿", region="北部",
         nodes=["akureyri", "akureyri_museum", "botanical", "hotel:10"],
         notes="市區景點（雙塔大教堂、博物館、咖啡店、紀念品店、植物園）彼此步行 5-15 分鐘，停好車用走的即可。"),
    dict(title="Varmahlíð 出發、瀑布與 Hítarneskot 入住", region="西部",
         nodes=["blonduos", "hraunfossar", "deildartunguhver", "borgarnes", "hotel:11"],
         notes="博加內斯加油放在最後（只多 3.9 km），隔天早上滿油直接往西進斯奈山半島。"),
    dict(title="斯奈山半島：有條件執行", region="斯奈山半島",
         nodes=["ytri_tunga", "budakirkja", "arnarstapi", "londrangar", "djupalonssandur", "kirkjufell", "hotel:12"],
         notes="冬季行車約 7 小時，加上 6 個景點會超過日照；建議從怪物海岸、黑教堂、海豹沙灘挑 1-2 個改備選。天氣不佳只走南岸後原路返回。"),
    dict(title="首都散步、最後一晚提早收隊", region="首都圈",
         nodes=["hallgrimskirkja", "blue_lagoon", "hotel:13"],
         optional=["hvammsvik"],
         notes="先逛首都，再去藍湖，泡完 25 分鐘就到 Hafnir。豪姆斯維克溫泉為二選一的備選（每天多約 60 km）。"),
    dict(title="返程", region="雷克雅內斯",
         nodes=["kef_terminal"],
         notes="03:00 起床，04:30 從 Hafnir 出發，05:00 抵達 KEF；預留加油、除冰與還車時間。"),
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
def _simplify(pts, tol=0.00025):
    """Douglas-Peucker（度為單位，約 25 m）"""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        nn = dx * dx + dy * dy
        best, bi = 0.0, None
        for i in range(a + 1, b):
            px, py = pts[i]
            if nn == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / nn))
                d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if d > best:
                best, bi = d, i
        if bi is not None and best > tol:
            keep[bi] = True
            stack += [(a, bi), (bi, b)]
    return [[round(x, 5), round(y, 5)] for x, y in (p for p, k in zip(pts, keep) if k)]


def _road_label(step):
    ref = (step.get("ref") or "").split(";")[0].strip()
    name = (step.get("name") or "").strip()
    return ref or name


def osrm(points):
    """回傳每個 leg 的 (km, min, coords, roads)；roads = [(道路, km), ...] 依行駛順序合併"""
    coords = ";".join("%.5f,%.5f" % (lon, lat) for lat, lon in points)
    url = OSRM + coords + "?overview=false&geometries=geojson&steps=true"
    d = fetch_json(url)
    if d.get("code") != "Ok":
        raise SystemExit("OSRM error: %s" % d)
    time.sleep(1.1)                       # 公用伺服器：每秒最多 1 次
    legs = []
    for l in d["routes"][0]["legs"]:
        line, roads = [], []
        for st in l["steps"]:
            c = st["geometry"]["coordinates"]
            line += c if not line else c[1:]
            lab, km = _road_label(st), st["distance"] / 1000
            if not lab or km < 0.05:
                continue
            if roads and roads[-1][0] == lab:
                roads[-1][1] += km
            else:
                roads.append([lab, km])
        legs.append((l["distance"] / 1000, l["duration"] / 60, line, roads))
    return legs


def _merge_roads(rs):
    """依行駛順序列出主要道路：先去掉 1 km 以下的短路段，再把相鄰的同一條路合併"""
    main = [[lab, km] for lab, km in rs if km >= 1.0] or [[lab, km] for lab, km in rs[:3]]
    out = []
    for lab, km in main:
        if out and out[-1][0] == lab:
            out[-1][1] += km
        else:
            out.append([lab, km])
    return [[lab, round(km, 1)] for lab, km in out]


def main():
    offline = "--offline" in sys.argv
    base = json.loads((ROOT / "tools" / "base_catalog.json").read_text())
    cats = base["categories"]
    catalog = {l["id"]: l for l in base["locations"]}
    hotels = load_hotels(offline)
    for h in hotels:
        if h["id"] in HOTEL_COORD_OVERRIDE:
            h["lat"], h["lon"] = HOTEL_COORD_OVERRIDE[h["id"]]
            h["coord_locked"] = 1
    hotel_by_id = {h["id"]: h for h in hotels}
    trip_start = date.fromisoformat(hotels[0]["checkin"])
    trip_end = date.fromisoformat(hotels[-1]["checkout"])
    if len(PLAN) != (trip_end - trip_start).days + 1:
        raise SystemExit("PLAN 天數 (%d) 與住宿日期 (%s ~ %s) 不符" % (len(PLAN), trip_start, trip_end))

    def point(pid):
        if pid in POINTS:
            return dict(POINTS[pid], id=pid)
        return dict(catalog[pid])

    def hotel_loc(hid, back=False):
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

    used = set()
    days, locations, features = [], [], []
    prev_stay, prev_stay_loc = None, None
    for di, p in enumerate(PLAN):
        d_iso = (trip_start + timedelta(days=di)).isoformat()
        tonight = next((h for h in hotels if h["checkin"] <= d_iso < h["checkout"]), None)
        stops, points = [], []
        if prev_stay:
            points.append((prev_stay["lat"], prev_stay["lon"]))
        for n in p["nodes"]:
            if isinstance(n, tuple):
                points.append((n[1], n[2]))
                continue
            key = n
            if key.startswith("hotel:"):
                parts = key.split(":")
                loc = hotel_loc(int(parts[1]), back=len(parts) > 2)
            else:
                loc = point(key)
                if key in used:                 # 同一地點第二次出現：共用同一個地圖標記
                    loc["same_as"] = key
                    loc["id"] = "%s__d%d" % (key, di)
            used.add(loc["id"])
            loc["out_and_back"] = 0
            points.append((loc["lat"], loc["lon"]))
            stops.append((loc, len(points) - 1))

        legs = osrm(points) if len(points) >= 2 else []
        cum = 0.0
        prev_id = prev_stay_loc["id"] if prev_stay_loc else None
        for order, (loc, pi) in enumerate(stops, 1):
            # 這個站點的里程 = 從上一個「站點」到它之間所有 leg（含 via）
            prev_pi = stops[order - 2][1] if order > 1 else (0 if prev_stay else pi)
            seg = [legs[k] for k in range(prev_pi, pi)] if pi > prev_pi else []
            km = sum(x[0] for x in seg)
            mins = sum(x[1] for x in seg)
            cum += km
            loc.update(day=di, order=order, stay_town=HOTEL_AREA.get(tonight["id"], ("",))[0] if tonight else "",
                       leg_km=round(km, 1), leg_min=round(mins), leg_min_winter=round(mins * WINTER),
                       cum_km_day=round(cum, 1), optional=0)
            loc.setdefault("same_as", None)
            if seg and prev_id:
                line = []
                for x in seg:
                    line += x[2] if not line else x[2][1:]
                roads = _merge_roads([r for x in seg for r in x[3]])
                loc["leg_roads"] = roads
                features.append(dict(type="Feature", properties=dict(
                    day=di, seq=order, **{"from": prev_id, "to": loc["id"]},
                    km=round(km, 1), min=round(mins), min_winter=round(mins * WINTER), roads=roads),
                    geometry=dict(type="LineString", coordinates=_simplify(line))))
            prev_id = loc["id"]
            locations.append(loc)
        for k, key in enumerate(p.get("optional", []), 1):
            loc = point(key)
            loc.update(day=di, order=len(stops) + k, stay_town="", leg_km=0, leg_min=0, leg_min_winter=0,
                       cum_km_day=0, out_and_back=0, optional=1, same_as=None)
            locations.append(loc)

        stay = hotel_by_id[tonight["id"]] if tonight else None
        area = HOTEL_AREA.get(tonight["id"]) if tonight else None
        sun_lat, sun_lon = (stay["lat"], stay["lon"]) if stay else (stops[-1][0]["lat"], stops[-1][0]["lon"])
        visit = sum(s_[0]["visit_min"] or 0 for s_ in stops if s_[0]["category"] != "STAY")
        start_area = p.get("start") or (HOTEL_AREA[prev_stay["id"]][0] if prev_stay else "凱夫拉維克機場")
        days.append(dict(
            day=di, date=d_iso, title_zh=p["title"], region=p["region"],
            start_town=start_area, stay_town=area[0] if area else "", stay_town_local=area[1] if area else "",
            hotel_id=tonight["id"] if tonight else None,
            route_km=round(sum(l[0] for l in legs), 1), drive_min=round(sum(l[1] for l in legs)),
            drive_min_winter=round(sum(l[1] for l in legs) * WINTER), visit_min=visit,
            stay_lat=round(sun_lat, 4), notes=p["notes"], **sun_facts(d_iso, sun_lat, sun_lon)))
        prev_stay = stay or prev_stay
        prev_stay_loc = stops[-1][0] if stops else prev_stay_loc
        print("Day %2d %s %-26s %6.1f km %4d min (冬 %3d)" % (di, d_iso, p["title"][:13], days[-1]["route_km"],
                                                            days[-1]["drive_min"], days[-1]["drive_min_winter"]))

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
        if key == "routes":
            out.append('  "routes": {"type": "FeatureCollection", "features": [')
            out.append(",\n".join("    " + json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in v["features"]))
            out.append("  ]}" + tail)
        elif isinstance(v, list):
            out.append('  "%s": [' % key)
            out.append(",\n".join("    " + json.dumps(r, ensure_ascii=False, separators=(", ", ": ")) for r in v))
            out.append("  ]" + tail)
        else:
            out.append('  "%s": %s%s' % (key, json.dumps(v, ensure_ascii=False, separators=(",", ":")), tail))
    out.append("};")
    (ROOT / "js" / "data.js").write_text("\n".join(out) + "\n")
    print("wrote js/data.js: %d days, %d locations, %d hotels, %d route legs" % (
        len(days), len(locations), len(hotels), len(features)))


if __name__ == "__main__":
    main()
