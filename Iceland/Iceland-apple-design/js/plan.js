/* ============================================================
   冰島追極光之旅: 行程調整（景點增減）
   - 原始行程：js/data.js（window.DATA，由 tools/build_itinerary.py 產生）
   - 調整內容：存在 NAS 的 api/plan（tools/plan_api.py），所有裝置共用
   - 本檔先讀取調整內容並套用到 DATA，再載入 app.js；
     純函式（applyPlan、recalc、mergeRoads…）也供 tests/plan.test.cjs 測試
   ============================================================ */
(function () {
  'use strict';

  var SCHEMA = 1;
  var DAY_FIELDS = ['day', 'order', 'stay_town', 'leg_km', 'leg_min', 'leg_min_winter', 'cum_km_day', 'leg_roads', 'same_as', 'optional'];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function baseOf(loc) { return loc.same_as || loc.id; }
  function r1(n) { return Math.round(n * 10) / 10; }

  /* 地點目錄：每個地點（不分哪一天）一筆，供「新增景點」挑選，也用來重建行程 */
  function catalog(DATA, plan) {
    var cat = {};
    DATA.locations.forEach(function (l) {
      var b = baseOf(l);
      if (cat[b] && !cat[b].same_as) return;
      var c = clone(l);
      DAY_FIELDS.forEach(function (k) { delete c[k]; });
      c.id = b;
      if (b !== l.id && /^返回 /.test(c.name_zh || '')) c.name_zh = c.name_zh.replace(/^返回 /, '');
      cat[b] = c;
    });
    /* 沒排進行程的地點（build_itinerary.py 匯出的 places） */
    (DATA.places || []).forEach(function (p) { if (!cat[p.id]) cat[p.id] = clone(p); });
    /* 先前存檔裡的自訂地點也收進來 */
    if (plan && plan.days) Object.keys(plan.days).forEach(function (d) {
      (plan.days[d].stops || []).forEach(function (s) { if (s.custom && !cat[s.custom.id]) cat[s.custom.id] = customLoc(s.custom); });
    });
    return cat;
  }

  function customLoc(c) {
    return {
      id: String(c.id), category: c.category || 'ATTRACTION',
      lat: Number(c.lat), lon: Number(c.lon),
      name_zh: String(c.name_zh || c.name_local || '自訂地點'), name_local: String(c.name_local || ''),
      visit_min: Math.max(0, Math.round(Number(c.visit_min) || 0)),
      bortle: Number(c.bortle) || 3, aurora_score: Number(c.aurora_score) || 1,
      winter_access: c.winter_access || 'CHECK', road: c.road || '',
      notes: String(c.notes || ''), source: c.source || '自行新增（OSM Nominatim）', custom: 1, out_and_back: 0
    };
  }

  /* 某一天目前的站點（不含備選），依順序 */
  function dayStops(DATA, day) {
    return DATA.locations.filter(function (l) { return l.day === day && !l.optional; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  /* 出發點 = 前一天的最後一站（通常是住宿）；Day 1 沒有 */
  function dayAnchor(DATA, day) {
    var prev = DATA.days.filter(function (d) { return d.day < day; }).map(function (d) { return d.day; });
    if (!prev.length) return null;
    var ls = dayStops(DATA, Math.max.apply(null, prev));
    return ls.length ? ls[ls.length - 1] : null;
  }

  /* 道路清單：先去掉 1 km 以下的短路段，再合併相鄰的同一條路（與 build_itinerary.py 相同） */
  function mergeRoads(rs) {
    var main = rs.filter(function (r) { return r[1] >= 1; });
    if (!main.length) main = rs.slice(0, 3);
    var out = [];
    main.forEach(function (r) {
      if (out.length && out[out.length - 1][0] === r[0]) out[out.length - 1][1] += r[1];
      else out.push([r[0], r[1]]);
    });
    return out.map(function (r) { return [r[0], r1(r[1])]; });
  }

  /* Douglas-Peucker（度為單位，約 25 m） */
  function simplify(pts, tol) {
    tol = tol || 0.00025;
    if (pts.length < 3) return pts.map(function (p) { return [+p[0].toFixed(5), +p[1].toFixed(5)]; });
    var keep = new Array(pts.length), stack = [[0, pts.length - 1]];
    keep[0] = keep[pts.length - 1] = true;
    while (stack.length) {
      var ab = stack.pop(), a = ab[0], b = ab[1];
      var ax = pts[a][0], ay = pts[a][1], dx = pts[b][0] - ax, dy = pts[b][1] - ay, nn = dx * dx + dy * dy;
      var best = 0, bi = -1;
      for (var i = a + 1; i < b; i++) {
        var px = pts[i][0], py = pts[i][1], d;
        if (nn === 0) d = Math.hypot(px - ax, py - ay);
        else {
          var t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / nn));
          d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
        }
        if (d > best) { best = d; bi = i; }
      }
      if (bi > 0 && best > tol) { keep[bi] = true; stack.push([a, bi], [bi, b]); }
    }
    return pts.filter(function (p, i) { return keep[i]; }).map(function (p) { return [+p[0].toFixed(5), +p[1].toFixed(5)]; });
  }

  /* OSRM 回應 → 一段路（km、分鐘、道路、線形） */
  function legFromOsrm(json) {
    if (!json || json.code !== 'Ok' || !json.routes || !json.routes.length) throw new Error('OSRM: ' + (json && (json.message || json.code)));
    var rt = json.routes[0], line = [], roads = [];
    rt.legs.forEach(function (l) {
      l.steps.forEach(function (st) {
        var c = st.geometry.coordinates;
        line = line.length ? line.concat(c.slice(1)) : c.slice();
        var lab = String(st.ref || '').split(';')[0].trim() || String(st.name || '').trim(), km = st.distance / 1000;
        if (!lab || km < 0.05) return;
        if (roads.length && roads[roads.length - 1][0] === lab) roads[roads.length - 1][1] += km;
        else roads.push([lab, km]);
      });
    });
    return { km: rt.distance / 1000, min: rt.duration / 60, roads: mergeRoads(roads), coords: simplify(line) };
  }

  /* 冬季封閉或高風險道路：939（Öxi）與所有 F 路 */
  function closedRoads(roads) {
    return (roads || []).map(function (r) { return r[0]; }).filter(function (n, i, a) {
      return (/^939$/.test(n) || /^F\d+/.test(n)) && a.indexOf(n) === i;
    });
  }

  /* 當日彙總：里程、行車、冬季、遊覽 */
  function summarize(stops, legs, winter) {
    var km = 0, min = 0, visit = 0;
    legs.forEach(function (l) { if (l) { km += l.km; min += l.min; } });
    stops.forEach(function (s) { if (s.category !== 'STAY') visit += s.visit_min || 0; });
    return { route_km: r1(km), drive_min: Math.round(min), drive_min_winter: Math.round(min * winter), visit_min: visit };
  }

  /* ----------------------------------------------------------
     套用調整到 DATA（會修改傳入的 DATA；呼叫端請先 clone）
     plan.days[day] = { stops: [{ref, visit_min?} | {custom:{…}}], legs: [{km, min, roads, coords, via?}] }
     legs[i] = 「出發點或上一站」到 stops[i] 的路段；Day 1 第一站沒有路段（null）
     ---------------------------------------------------------- */
  function applyPlan(DATA, plan) {
    if (!plan || !plan.days) return DATA;
    var W = (DATA.meta && DATA.meta.winter_factor) || 1.2;
    var cat = catalog(DATA, plan);
    var edited = Object.keys(plan.days).map(Number).filter(function (d) {
      return DATA.days.some(function (x) { return x.day === d; }) && plan.days[d] && Array.isArray(plan.days[d].stops) && plan.days[d].stops.length;
    }).sort(function (a, b) { return a - b; });
    if (!edited.length) return DATA;
    var isEdited = {};
    edited.forEach(function (d) { isEdited[d] = 1; });

    /* 1. 各天的站點清單：未調整的沿用原物件；調整過的依存檔重建 */
    var perDay = {}, optByDay = {};
    DATA.days.forEach(function (d) {
      optByDay[d.day] = DATA.locations.filter(function (l) { return l.day === d.day && l.optional; });
      if (!isEdited[d.day]) { perDay[d.day] = dayStops(DATA, d.day); return; }
      perDay[d.day] = plan.days[d.day].stops.map(function (s) {
        var tpl = s.custom ? customLoc(s.custom) : cat[s.ref];
        if (!tpl) return null;                         /* 原始資料已沒有這個地點：略過 */
        var l = clone(tpl);
        l._base = tpl.id; l._new = 1;
        if (s.visit_min != null && isFinite(s.visit_min)) l.visit_min = Math.max(0, Math.round(s.visit_min));
        if (s.name_zh) l.name_zh = String(s.name_zh);
        return l;
      }).filter(Boolean);
    });

    /* 2. 重新編 id：同一地點第一次出現用原 id，之後的用「id__dN」並以 same_as 共用地圖標記 */
    var seen = {}, idMap = {}, used = {};
    DATA.days.forEach(function (d) {
      perDay[d.day].forEach(function (l) {
        var b = l._new ? l._base : baseOf(l), old = l._new ? null : l.id, id;
        if (!seen[b]) { id = b; delete l.same_as; seen[b] = 1; }
        else if (!l._new && l.same_as === b) id = l.id;
        else {
          id = b + '__d' + (d.day - 1);
          for (var k = 2; used[id]; k++) id = b + '__d' + (d.day - 1) + '_' + k;
          l.same_as = b;
        }
        used[id] = 1;
        if (old && old !== id) idMap[old] = id;
        l.id = id;
      });
    });

    /* 備選景點：同一天已改成正式站點的就拿掉；id 與正式站點衝突時改用共用標記 */
    DATA.days.forEach(function (d) {
      var inDay = {};
      perDay[d.day].forEach(function (l) { inDay[baseOf(l)] = 1; });
      optByDay[d.day] = optByDay[d.day].filter(function (o) { return !(isEdited[d.day] && inDay[baseOf(o)]); });
      optByDay[d.day].forEach(function (o) {
        if (used[o.id]) { o.same_as = baseOf(o); o.id = baseOf(o) + '__opt' + d.day; }
        used[o.id] = 1;
      });
    });

    /* 3. 調整過的天：重算每站的路段欄位與路線 */
    var feats = DATA.routes.features.filter(function (f) { return !isEdited[f.properties.day]; });
    feats.forEach(function (f) {
      var p = f.properties;
      if (idMap[p.from]) p.from = idMap[p.from];
      if (idMap[p.to]) p.to = idMap[p.to];
    });
    var prevLast = null;
    DATA.days.forEach(function (d) {
      var ls = perDay[d.day];
      if (isEdited[d.day]) {
        var legs = plan.days[d.day].legs || [];
        var stay = (DATA.locations.filter(function (l) { return l.day === d.day && !l.optional; })[0] || {}).stay_town || '';
        var cum = 0, used2 = [];
        ls.forEach(function (l, i) {
          var leg = (i === 0 && !prevLast) ? null : legs[i] || null;
          var km = leg ? leg.km : 0, min = leg ? leg.min : 0;
          cum += km;
          l.day = d.day; l.order = i + 1; l.optional = 0; l.out_and_back = l.out_and_back || 0;
          l.stay_town = stay;
          l.leg_km = r1(km); l.leg_min = Math.round(min); l.leg_min_winter = Math.round(min * W);
          l.cum_km_day = r1(cum);
          l.leg_roads = leg ? leg.roads || [] : [];
          if (!l.leg_roads.length) delete l.leg_roads;
          var from = i ? ls[i - 1] : prevLast;
          if (leg && from && leg.coords && leg.coords.length > 1) {
            var props = { day: d.day, seq: i + 1, from: from.id, to: l.id, km: r1(km), min: Math.round(min), min_winter: Math.round(min * W), roads: leg.roads || [] };
            if (leg.via && leg.via.length) props.via = leg.via;
            if (leg.estimate) props.estimate = 1;
            feats.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: leg.coords } });
          }
          used2.push(leg);
          delete l._base; delete l._new;
        });
        var sum = summarize(ls, used2, W);
        Object.keys(sum).forEach(function (k) { d[k] = sum[k]; });
        d.edited = 1;
        if (plan.days[d.day].updated_at) d.edited_at = plan.days[d.day].updated_at;
        optByDay[d.day].forEach(function (o, k) { o.order = ls.length + k + 1; });
      }
      if (ls.length) prevLast = ls[ls.length - 1];
    });

    /* 4. 寫回 DATA */
    var locs = [];
    DATA.days.forEach(function (d) { locs = locs.concat(perDay[d.day], optByDay[d.day]); });
    DATA.locations = locs;
    DATA.routes.features = feats.sort(function (a, b) { return a.properties.day - b.properties.day || a.properties.seq - b.properties.seq; });
    return DATA;
  }

  /* 從目前 DATA 取出某天的存檔格式（給編輯器起始用） */
  function dayToPlan(DATA, day) {
    var ls = dayStops(DATA, day), anchor = dayAnchor(DATA, day);
    var byTo = {};
    DATA.routes.features.forEach(function (f) { if (f.properties.day === day) byTo[f.properties.to] = f; });
    return {
      stops: ls.map(function (l) {
        return l.custom ? { custom: { id: baseOf(l), name_zh: l.name_zh, name_local: l.name_local, lat: l.lat, lon: l.lon, category: l.category, visit_min: l.visit_min, notes: l.notes } }
          : { ref: baseOf(l), visit_min: l.visit_min };
      }),
      legs: ls.map(function (l, i) {
        if (i === 0 && !anchor) return null;
        var f = byTo[l.id];
        if (!f) return null;
        var p = f.properties, leg = { km: p.km, min: p.min, roads: p.roads || [], coords: f.geometry.coordinates };
        if (p.via) leg.via = p.via;
        return leg;
      })
    };
  }

  var api = {
    SCHEMA: SCHEMA, clone: clone, baseOf: baseOf, catalog: catalog, customLoc: customLoc,
    dayStops: dayStops, dayAnchor: dayAnchor, mergeRoads: mergeRoads, simplify: simplify,
    legFromOsrm: legFromOsrm, closedRoads: closedRoads, summarize: summarize,
    applyPlan: applyPlan, dayToPlan: dayToPlan
  };
  (typeof window !== 'undefined' ? window : this).IcelandPlan = api;

  /* ----------------------------------------------------------
     瀏覽器：讀取 NAS 存檔 → 套用 → 載入 app.js
     ---------------------------------------------------------- */
  if (typeof document === 'undefined' || !document.currentScript) return;
  var me = document.currentScript;
  var appSrc = me.getAttribute('data-app');
  var BASE = clone({ days: window.DATA.days, locations: window.DATA.locations, routes: window.DATA.routes, places: window.DATA.places || [] });
  window.PLAN_STATE = { ok: false, plan: { schema: SCHEMA, rev: 0, days: {} }, base: BASE, error: null };

  function start() {
    var s = document.createElement('script');
    s.src = appSrc; s.async = false;
    document.body.appendChild(s);
  }
  var done = false;
  function finish() { if (!done) { done = true; start(); } }
  var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctl) ctl.abort(); window.PLAN_STATE.error = 'timeout'; finish(); }, 3000);
  fetch('api/plan', { cache: 'no-store', signal: ctl ? ctl.signal : undefined, headers: { Accept: 'application/json' } })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('json') < 0) throw new Error('not json');
      return r.json();
    })
    .then(function (plan) {
      clearTimeout(timer);
      if (!plan || plan.schema !== SCHEMA) plan = { schema: SCHEMA, rev: (plan && plan.rev) || 0, days: {} };
      window.PLAN_STATE.ok = true;
      window.PLAN_STATE.plan = plan;
      try {
        var next = clone(window.DATA);
        applyPlan(next, plan);
        window.DATA = next;
      } catch (e) {
        window.PLAN_STATE.error = 'apply';
        console.warn('[行程調整] 套用存檔失敗，改用原始行程：', e);
      }
      finish();
    })
    .catch(function (e) {
      clearTimeout(timer);
      if (!done) { window.PLAN_STATE.error = window.PLAN_STATE.error || String(e.message || e); console.warn('[行程調整] 無法讀取 NAS 存檔（api/plan），使用原始行程。'); }
      finish();
    });
})();
