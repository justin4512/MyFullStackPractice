/* ============================================================
   冰島追極光之旅: 前端應用邏輯
   資料：js/data.js（window.DATA）
   版面：桌機 = 面板 + 地圖；手機（< 900px）= 全螢幕地圖 + 底部抽屜
   ============================================================ */
(function () {
  'use strict';

  var DATA = window.DATA;
  var CATS = DATA.categories;
  var LOCS = DATA.locations;
  var DAYS = DATA.days;
  var ROUTES = DATA.routes;

  var CAT = {};
  CATS.forEach(function (c) { CAT[c.code] = c; });

  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtMin(m) {
    m = Math.round(m || 0);
    var h = Math.floor(m / 60), r = m % 60;
    return h + ':' + (r < 10 ? '0' : '') + r;
  }
  function fmtMinH(m) { return (Math.round((m || 0) / 6) / 10).toFixed(1); }
  function num(n, d) { return Number(n).toFixed(d == null ? 1 : d); }
  function icon(name, cls) { return '<i class="ph ph-' + name + (cls ? ' ' + cls : '') + '" aria-hidden="true"></i>'; }
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  function stars(score) {
    var s = '';
    for (var i = 1; i <= 3; i++) s += '<span class="' + (i <= score ? '' : 'off') + '">★</span>';
    return '<span class="stars" title="極光觀測適合度 ' + score + '/3">' + s + '</span>';
  }
  function bortleColor(b) {
    if (b <= 2) return '#1f6b65'; if (b <= 3) return '#4fa597'; if (b <= 4) return '#9fd5c8';
    if (b <= 5) return '#e2c49c'; if (b <= 6) return '#d59a52'; return '#c35a50';
  }
  /* 環形圖：segs = [{ v, color }]，total 為整圈數值 */
  function donutSvg(segs, total, trackColor) {
    var R = 15.9155, acc = 0, gap = segs.length > 1 ? 0.9 : 0;
    var arcs = segs.map(function (sg) {
      var pct = Math.max(0, sg.v / total * 100 - gap);
      var el = '<circle cx="21" cy="21" r="' + R + '" fill="none" stroke-width="5.2" style="stroke:' + sg.color + '"' +
        ' stroke-dasharray="' + pct.toFixed(2) + ' ' + (100 - pct).toFixed(2) + '" stroke-dashoffset="' + (-acc).toFixed(2) + '"></circle>';
      acc += sg.v / total * 100;
      return el;
    }).join('');
    return '<svg viewBox="0 0 42 42" aria-hidden="true">' +
      '<circle cx="21" cy="21" r="' + R + '" fill="none" stroke-width="5.2" style="stroke:' + trackColor + '"></circle>' + arcs + '</svg>';
  }
  function dayOf(n) { return DAYS.filter(function (x) { return x.day === n; })[0]; }
  function stayLabel(d) { return d.stay_town || '離境'; }

  /* ---------- marker shapes (categories.shape) ---------- */
  var SHAPES = {
    circle:    { size: 18, body: '<circle cx="12" cy="12" r="6.2"/>' },
    circle_lg: { size: 26, body: '<circle cx="12" cy="12" r="8.6"/>' },
    square:    { size: 20, body: '<rect x="5.6" y="5.6" width="12.8" height="12.8" rx="2.4"/>' },
    triangle:  { size: 22, body: '<path d="M12 3.4 21.4 20.6H2.6z"/>' },
    diamond:   { size: 22, body: '<path d="M12 2.6 21.4 12 12 21.4 2.6 12z"/>' },
    hexagon:   { size: 24, body: '<path d="M12 2.4 20.3 7.2v9.6L12 21.6 3.7 16.8V7.2z"/>' },
    star:      { size: 20, body: '<path d="M12 3.1l2.7 6 6.5.6-4.9 4.4 1.4 6.4L12 17.2l-5.7 3.3 1.4-6.4-4.9-4.4 6.5-.6z"/>' },
    star_lg:   { size: 30, body: '<path d="M12 1.6l3.2 7.2 7.8.7-5.9 5.2 1.7 7.7L12 18.5l-6.8 3.9 1.7-7.7L1 9.5l7.8-.7z"/>' },
    drop:      { size: 22, body: '<path d="M12 2.2c3.7 4.7 6.6 8.2 6.6 11.7A6.6 6.6 0 0 1 12 20.5a6.6 6.6 0 0 1-6.6-6.6C5.4 10.4 8.3 6.9 12 2.2z"/>' },
    ring:      { size: 20, body: '<circle cx="12" cy="12" r="7.3"/>' },
    ellipse:   { size: 24, body: '<ellipse cx="12" cy="12" rx="9.5" ry="6.2"/>' },
    cross:     { size: 20, body: '<path d="M9.5 2.6h5v6.9h6.9v5h-6.9v6.9h-5v-6.9H2.6v-5h6.9z"/>' }
  };
  function shapeSize(cat) { return SHAPES[cat.shape] ? SHAPES[cat.shape].size : 20; }
  function shapeSvg(cat, px) {
    var s = SHAPES[cat.shape] || SHAPES.circle;
    var size = px || s.size;
    var isRing = cat.shape === 'ring';
    var fill = isRing ? 'none' : cat.color_hex;
    var stroke = isRing ? cat.color_hex : 'rgba(255,255,255,.85)';
    var sw = isRing ? 3.2 : 1.3;
    var glow = cat.code === 'AURORA_SPOT'
      ? 'filter:drop-shadow(0 0 7px ' + cat.color_hex + ');'
      : 'filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));';
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" aria-hidden="true" style="' + glow + 'display:block">' +
      s.body.replace('/>', ' fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>') + '</svg>';
  }

  /* ---------- layer model (categories.layer) ---------- */
  var LAYER_ORDER = ['住宿', '極光', '自然景觀', '人文與活動', '交通與補給', '補給與餐飲', '服務設施', '警示'];
  var LAYERS = {};
  LAYER_ORDER.forEach(function (name) { LAYERS[name] = { name: name, cats: [], on: false, count: 0 }; });
  CATS.forEach(function (c) {
    if (!LAYERS[c.layer]) { LAYERS[c.layer] = { name: c.layer, cats: [], on: false, count: 0 }; LAYER_ORDER.push(c.layer); }
    LAYERS[c.layer].cats.push(c);
    if (c.show_by_default) LAYERS[c.layer].on = true;
  });
  LOCS.forEach(function (l) { if (LAYERS[CAT[l.category].layer]) LAYERS[CAT[l.category].layer].count++; });

  var NON_CLUSTER = { AURORA_SPOT: 1, CITY: 1, TOWN: 1, STAY: 1 };
  var WARN_DAYS = { 3: 1, 4: 1, 5: 1, 9: 1 };

  /* ---------- state ---------- */
  var state = { day: 0, sel: null, view: 'days', wide: false, side: false, layerOn: {} };
  LAYER_ORDER.forEach(function (n) { state.layerOn[n] = LAYERS[n].on; });
  var DNUMS = DAYS.map(function (d) { return d.day; });
  var lastFit = null;

  /* ---------- a11y / motion ---------- */
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function announce(msg) { var el = $('sr-status'); if (el) el.textContent = msg; }
  function announceDay() {
    var d = dayOf(state.day);
    if (!d) return;
    announce('Day ' + d.day + '：' + d.title_zh + '。住宿 ' + stayLabel(d) + '，' +
      d.route_km + ' 公里、' + fmtMin(d.drive_min) + ' 行車，' + dayLocs(state.day).length + ' 個站點。');
  }

  /* ==========================================================
     Bottom sheet（僅手機版面）
     ========================================================== */
  var mqSheet = window.matchMedia('(max-width: 899px)');
  var panel = $('panel'), grip = $('sheet-grip'), head = $('panel-head'), scroller = $('panel-scroll');
  var sheet = { state: 'peek', y: 0, h: 0 };

  function isSheet() { return mqSheet.matches; }
  function sheetSnaps() {
    var h = panel.offsetHeight;
    var peek = grip.offsetHeight + head.offsetHeight + 6;
    var half = Math.round(window.innerHeight * 0.5);
    return { h: h, full: 0, half: Math.max(0, h - Math.max(half, peek)), peek: Math.max(0, h - peek) };
  }
  function applySheetY(y) {
    sheet.y = y;
    sheet.h = panel.offsetHeight;
    panel.style.setProperty('--sheet-y', y + 'px');
    root.style.setProperty('--sheet-visible', Math.max(0, sheet.h - y) + 'px');
  }
  function setSheet(name) {
    if (!isSheet()) return;
    var s = sheetSnaps();
    sheet.state = name;
    applySheetY(s[name]);
    panel.dataset.sheet = name;
    root.setAttribute('data-sheet', name);
    /* 讓面板內容在任何停靠高度都能捲到底 */
    root.style.setProperty('--sheet-rest', s[name] + 'px');
    grip.setAttribute('aria-expanded', String(name !== 'peek'));
    grip.setAttribute('aria-label', name === 'peek' ? '展開行程面板' : '收合行程面板');
  }
  function sheetVisible() { return isSheet() ? Math.max(0, sheet.h - sheet.y) : 0; }

  function initSheet() {
    var drag = null, suppressClick = false;

    function onDown(e) {
      if (!isSheet() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, y0: sheet.y, t: performance.now(), active: false, lastY: e.clientY, lastT: performance.now(), v: 0 };
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.active) {
        if (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(dx)) return;
        drag.active = true;
        panel.classList.add('dragging');
        root.classList.add('sheet-dragging');
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
      }
      var s = sheetSnaps();
      var y = drag.y0 + dy;
      if (y < 0) y = y / 4;                         /* 頂端阻尼 */
      if (y > s.peek) y = s.peek + (y - s.peek) / 4; /* 底端阻尼 */
      var now = performance.now();
      drag.v = (e.clientY - drag.lastY) / Math.max(1, now - drag.lastT);
      drag.lastY = e.clientY; drag.lastT = now;
      applySheetY(y);
      e.preventDefault();
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      if (!d.active) return;
      panel.classList.remove('dragging');
      root.classList.remove('sheet-dragging');
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 0);
      var s = sheetSnaps();
      var order = ['full', 'half', 'peek'];
      var target;
      if (d.v < -0.45) target = order[Math.max(0, order.indexOf(nearest(s)) - 1)];
      else if (d.v > 0.45) target = order[Math.min(2, order.indexOf(nearest(s)) + 1)];
      else target = nearest(s);
      setSheet(target);
    }
    function nearest(s) {
      var best = 'peek', dist = Infinity;
      ['full', 'half', 'peek'].forEach(function (k) {
        var dd = Math.abs(s[k] - sheet.y);
        if (dd < dist) { dist = dd; best = k; }
      });
      return best;
    }

    [grip, head].forEach(function (el) {
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('click', function (e) {
        if (suppressClick) { e.stopPropagation(); e.preventDefault(); }
      }, true);
    });
    grip.addEventListener('click', function () {
      setSheet(sheet.state === 'peek' ? 'half' : 'peek');
    });
    /* 在抽屜收合時點選分頁，順勢展開 */
    head.addEventListener('click', function (e) {
      if (isSheet() && sheet.state === 'peek' && e.target.closest('.seg button')) setSheet('half');
    });

    var raf = 0;
    window.addEventListener('resize', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { if (isSheet()) setSheet(sheet.state); });
    });
    var onMq = function () {
      if (isSheet()) { setSheet('peek'); setWide(false); }
      else {
        panel.style.removeProperty('--sheet-y');
        root.style.removeProperty('--sheet-visible');
        root.style.removeProperty('--sheet-rest');
        root.removeAttribute('data-sheet');
      }
    };
    if (mqSheet.addEventListener) mqSheet.addEventListener('change', onMq); else mqSheet.addListener(onMq);
    if (isSheet()) setSheet('peek');
  }

  /* ==========================================================
     Theme
     ========================================================== */
  function currentTheme() { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function syncThemeUi() {
    var t = currentTheme();
    var b = $('btn-theme');
    b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
    b.setAttribute('aria-label', t === 'dark' ? '切換為淺色主題' : '切換為深色主題');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', cssVar('--bg'));
  }
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('iceland-theme', t); } catch (e) {}
    syncThemeUi();
    if (map) {
      if (BASEMAPS[baseIdx].id === 'canvas') setBasemap(baseIdx);
      restyleRoutes();
    }
    announce(t === 'dark' ? '已切換為深色主題。' : '已切換為淺色主題。');
  }

  /* ==========================================================
     Overview / KPIs
     ========================================================== */
  /* ---------- 每日行車節奏：分層波形圖 ---------- */
  var WAVE = { max: 1, n: DAYS.length };
  function smoothPath(pts) {
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
  }
  function wavePts(key) {
    var W = 1000, H = 200;
    return DAYS.map(function (d, i) {
      return [i / (WAVE.n - 1) * W, H - d[key] / WAVE.max * (H - 8)];
    });
  }
  function buildWave() {
    WAVE.max = Math.max.apply(null, DAYS.map(function (d) { return d.drive_min_winter; })) * 1.08;
    var area = function (key, cls, grad) {
      var line = smoothPath(wavePts(key));
      return '<path class="wave-area ' + cls + '" d="' + line + ' L1000,200 L0,200 Z" style="fill:url(#' + grad + ')"></path>' +
        '<path class="wave-area ' + cls + '" d="' + line + '" fill="none" stroke-width="2" vector-effect="non-scaling-stroke" style="stroke:var(--chart-' + (cls === 'b' ? 'b' : 'a') + ')"></path>';
    };
    var longest = DAYS.slice().sort(function (a, b) { return b.drive_min - a.drive_min; })[0];
    $('wave').setAttribute('role', 'img');
    $('wave').setAttribute('aria-label', '每日行車時間波形圖：最長為 Day ' + longest.day + '，' + fmtMin(longest.drive_min) + '（冬季 ' + fmtMin(longest.drive_min_winter) + '）。點選可切換日期。');
    $('wave').innerHTML =
      '<div class="wave-plot">' +
        '<svg viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true"><defs>' +
          '<linearGradient id="wg-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--chart-a);stop-opacity:.85"/><stop offset="1" style="stop-color:var(--chart-a);stop-opacity:.25"/></linearGradient>' +
          '<linearGradient id="wg-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--chart-b);stop-opacity:.9"/><stop offset="1" style="stop-color:var(--chart-b);stop-opacity:.3"/></linearGradient>' +
        '</defs>' + area('drive_min_winter', 'b', 'wg-b') + area('drive_min', 'a', 'wg-a') + '</svg>' +
        '<div class="wave-mark" aria-hidden="true"></div><div class="wave-dot" aria-hidden="true"></div><div class="wave-tip" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="wave-axis" aria-hidden="true">' + DAYS.map(function (d) { return '<span data-day="' + d.day + '">' + d.day + '</span>'; }).join('') + '</div>';
    $('wave').addEventListener('click', function (e) {
      var r = $('wave').querySelector('.wave-plot').getBoundingClientRect();
      var i = Math.round((e.clientX - r.left) / r.width * (WAVE.n - 1));
      i = Math.max(0, Math.min(WAVE.n - 1, i));
      setDay(DAYS[i].day, false, false);
    });
    updateWave();
  }
  function updateWave() {
    var el = $('wave');
    if (!el || !el.firstChild) return;
    var i = DNUMS.indexOf(state.day), d = DAYS[i];
    var x = i / (WAVE.n - 1) * 100;
    var y = (200 - d.drive_min / WAVE.max * 192) / 200 * 100;
    el.querySelector('.wave-mark').style.left = x + '%';
    var dot = el.querySelector('.wave-dot'), tip = el.querySelector('.wave-tip');
    dot.style.left = x + '%'; dot.style.top = y + '%';
    tip.style.left = Math.min(92, Math.max(8, x)) + '%'; tip.style.top = y + '%';
    tip.textContent = 'Day ' + d.day + '  ' + fmtMin(d.drive_min);
    Array.prototype.forEach.call(el.querySelectorAll('.wave-axis span'), function (s) {
      s.classList.toggle('on', Number(s.dataset.day) === state.day);
    });
  }

  function buildOverview() {
    var totalKm = DAYS.reduce(function (a, d) { return a + d.route_km; }, 0);
    var totalMin = DAYS.reduce(function (a, d) { return a + d.drive_min; }, 0);
    var totalWin = DAYS.reduce(function (a, d) { return a + d.drive_min_winter; }, 0);
    var auroraNights = LOCS.filter(function (l) { return l.bortle <= 4 && /住宿/.test(l.name_zh); }).length;
    var kmTxt = totalKm.toLocaleString('en-US');

    $('ov-title').innerHTML = '環島 <em>' + kmTxt + ' km</em>，' + DAYS.length + ' 天、9 個極光夜';
    $('top-km').insertAdjacentHTML('beforeend', kmTxt + ' km');
    $('top-nights').insertAdjacentHTML('beforeend', LOCS.length + ' 個站點');

    var items = [
      { k: '總里程', v: kmTxt, s: 'km' },
      { k: '總行車', v: num(totalMin / 60), s: 'h' },
      { k: '冬季預估', v: num(totalWin / 60), s: 'h' },
      { k: '行程天數', v: String(DAYS.length), s: '天' },
      { k: '地圖站點', v: String(LOCS.length), s: '個' },
      { k: '暗空住宿', v: String(auroraNights), s: '晚 B≤4' }
    ];
    $('kpis').innerHTML = items.map(function (i) {
      return '<div><dt>' + esc(i.k) + '</dt><dd class="disc"><span class="v">' + esc(i.v) + '</span><span class="u">' + esc(i.s) + '</span></dd></div>';
    }).join('');
    buildWave();
  }

  /* ==========================================================
     Map
     ========================================================== */
  var map = null, clusterGroup = null, plainGroup = null, routeByDay = {};
  var markers = [];
  var baseLayer = null, baseIdx = 0;

  var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  var BASEMAPS = [
    { id: 'canvas', name: '簡約', max: 16,
      url: function () { return ESRI + (currentTheme() === 'dark' ? 'Canvas/World_Dark_Gray_Base' : 'Canvas/World_Light_Gray_Base') + '/MapServer/tile/{z}/{y}/{x}'; },
      attr: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>, DeLorme, HERE' },
    { id: 'sat', name: '衛星', max: 19,
      url: function () { return ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}'; },
      attr: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics' },
    { id: 'topo', name: '地形', max: 19,
      url: function () { return ESRI + 'World_Topo_Map/MapServer/tile/{z}/{y}/{x}'; },
      attr: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, USGS' }
  ];

  function setBasemap(i) {
    if (!map) return;
    baseIdx = ((i % BASEMAPS.length) + BASEMAPS.length) % BASEMAPS.length;
    var b = BASEMAPS[baseIdx];
    if (baseLayer) map.removeLayer(baseLayer);
    baseLayer = L.tileLayer(b.url(), { maxZoom: 19, maxNativeZoom: b.max, attribution: b.attr, detectRetina: false });
    baseLayer.addTo(map);
    if (baseLayer.bringToBack) baseLayer.bringToBack();
    $('base-lbl').textContent = b.name;
    $('btn-base').setAttribute('aria-label', '切換底圖，目前：' + b.name);
  }

  /* 地圖可視範圍需扣掉浮動工具列與手機抽屜 */
  function mapPad() {
    if (isSheet()) {
      var tb = document.querySelector('.topbar').getBoundingClientRect().bottom;
      return { tl: [20, tb + 16], br: [64, sheetVisible() + 20] };
    }
    return { tl: [56, 76], br: [56, 56] };
  }

  function initMap() {
    if (typeof L === 'undefined') {
      $('map').innerHTML =
        '<div style="padding:96px 24px 24px;color:var(--text-2);font-size:14px;line-height:1.7;max-width:420px">' +
        '<b style="color:var(--text)">地圖元件未能載入</b><br>地圖使用 Leaflet 與 Esri 底圖（CDN）。' +
        '請確認網路連線後重新整理；每日行程、極光指南與行前提醒不受影響。</div>';
      return false;
    }
    map = L.map('map', {
      center: [64.9, -18.6], zoom: 6, zoomControl: false,
      worldCopyJump: false, minZoom: 5, maxZoom: 16, attributionControl: true,
      tap: true
    });
    L.control.zoom({ position: 'bottomright', zoomInTitle: '放大', zoomOutTitle: '縮小' }).addTo(map);
    setBasemap(0);

    clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 46, spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 11,
      iconCreateFunction: function (c) {
        var n = c.getChildCount();
        var d = n >= 8 ? 44 : 36;
        return L.divIcon({ html: '<div><span>' + n + '</span></div>', className: n >= 8 ? 'mc lg' : 'mc', iconSize: L.point(d, d) });
      }
    });
    plainGroup = L.layerGroup();

    L.geoJSON(ROUTES, {
      style: function (f) { return routeStyle(f.properties.day, false); },
      onEachFeature: function (f, lyr) { routeByDay[f.properties.day] = lyr; }
    }).addTo(map);

    LOCS.forEach(function (loc) {
      var cat = CAT[loc.category];
      var sz = shapeSize(cat);
      var m = L.marker([loc.lat, loc.lon], {
        icon: L.divIcon({ html: shapeSvg(cat), className: 'mkr', iconSize: L.point(sz, sz), iconAnchor: L.point(sz / 2, sz / 2) }),
        title: loc.name_zh + '（' + loc.name_local + '）',
        alt: loc.name_zh + '（' + loc.name_local + '）｜' + cat.name_zh + '｜Day ' + loc.day + ' 第 ' + loc.order + ' 站',
        keyboard: true, riseOnHover: true,
        zIndexOffset: cat.code === 'AURORA_SPOT' ? 900 : (NON_CLUSTER[cat.code] ? 500 : 0)
      });
      m.bindPopup(popupHtml(loc), { maxWidth: 300, autoPan: true });
      m.on('click', function () { selectNode(loc.id, false); });
      markers.push({ loc: loc, cat: cat, marker: m, cluster: !NON_CLUSTER[cat.code] });
    });

    map.on('zoomend', refreshMarkers);
    refreshMarkers();

    /* 面板收合、抽屜或視窗尺寸改變時，自動重算地圖尺寸 */
    if (window.ResizeObserver) {
      var lastW = 0, lastH = 0;
      new ResizeObserver(function (entries) {
        var r = entries[0].contentRect;
        if (Math.round(r.width) === lastW && Math.round(r.height) === lastH) return;
        var first = !lastW;
        lastW = Math.round(r.width); lastH = Math.round(r.height);
        if (!first) map.invalidateSize({ pan: false });
      }).observe($('map'));
    }
    return true;
  }

  function routeStyle(day, active) {
    return {
      color: active ? cssVar('--route-active') : cssVar('--route'),
      weight: active ? 5 : 2.4, opacity: active ? 0.95 : 0.8,
      lineJoin: 'round', lineCap: 'round',
      dashArray: active ? null : '4,7'
    };
  }
  function restyleRoutes() {
    Object.keys(routeByDay).forEach(function (k) {
      routeByDay[k].setStyle(routeStyle(Number(k), lastFit !== null && Number(k) === state.day));
    });
    if (lastFit !== null && routeByDay[state.day]) routeByDay[state.day].bringToFront();
  }

  function refreshMarkers() {
    if (!map) return;
    var z = map.getZoom();
    markers.forEach(function (o) {
      var visible = state.layerOn[o.cat.layer] && z >= o.cat.min_zoom;
      var inCluster = clusterGroup.hasLayer(o.marker);
      var inPlain = plainGroup.hasLayer(o.marker);
      if (visible) {
        if (o.cluster) { if (!inCluster) clusterGroup.addLayer(o.marker); if (inPlain) plainGroup.removeLayer(o.marker); }
        else { if (!inPlain) plainGroup.addLayer(o.marker); if (inCluster) clusterGroup.removeLayer(o.marker); }
      } else {
        if (inCluster) clusterGroup.removeLayer(o.marker);
        if (inPlain) plainGroup.removeLayer(o.marker);
      }
    });
    if (!map.hasLayer(clusterGroup)) map.addLayer(clusterGroup);
    if (!map.hasLayer(plainGroup)) map.addLayer(plainGroup);
    var zh = $('legend-hint');
    if (zh) zh.textContent = '目前 z' + z;
    renderLegend();
  }

  function popupHtml(loc) {
    var cat = CAT[loc.category];
    var rows = [
      ['順序', 'Day ' + loc.day + '，第 ' + loc.order + ' 站'],
      ['分類', cat.name_zh],
      ['本段里程', num(loc.leg_km, 1) + ' km' + (loc.out_and_back ? '（折返）' : '')],
      ['本段行車', loc.leg_min + ' 分（冬 ' + loc.leg_min_winter + ' 分）'],
      ['建議停留', loc.visit_min ? loc.visit_min + ' 分' : '無'],
      ['道路', loc.road || '無'],
      ['Bortle', loc.bortle + ' / 9'],
      ['極光適合度', loc.aurora_score + ' / 3']
    ];
    var wa = loc.winter_access === 'CAUTION'
      ? '<span class="badge caution">須確認路況</span>'
      : '<span class="badge">可通行</span>';
    return '<div class="pop-h">' + shapeSvg(cat, 22) + '<b>' + esc(loc.name_zh) + '</b></div>' +
      '<div class="pop-loc">' + esc(loc.name_local) + '</div>' +
      '<dl class="pop-grid">' +
      rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') +
      '<dt>冬季通行</dt><dd>' + wa + '</dd></dl>' +
      (loc.notes ? '<div class="pop-note">' + esc(loc.notes) + '</div>' : '');
  }

  function openPopupFor(o) {
    var p = o.marker.getPopup();
    if (!p) return;
    var pad = mapPad();
    p.options.autoPanPaddingTopLeft = L.point(pad.tl[0], pad.tl[1]);
    p.options.autoPanPaddingBottomRight = L.point(pad.br[0], pad.br[1]);
    p.options.maxWidth = isSheet() ? 264 : 300;
    o.marker.openPopup();
  }

  /* 定位到標記並開啟資訊卡：處理圖層關閉、min_zoom 未達、被聚合等情況 */
  function afterMove(fn) {
    var done = false;
    var run = function () { if (!done) { done = true; fn(); } };
    map.once('moveend', run);
    setTimeout(run, reduceMotion() ? 50 : 900);
  }
  function revealMarker(o) {
    if (!state.layerOn[o.cat.layer]) {
      announce('「' + o.cat.layer + '」圖層目前隱藏，已定位但未顯示標記。');
      return;
    }
    var ll = L.latLng(o.loc.lat, o.loc.lon);
    var anim = !reduceMotion();
    var tryOpen = function (retry) {
      if (o.marker._icon) openPopupFor(o);
      else if (retry) setTimeout(function () { tryOpen(false); }, 260);
    };
    /* 第二步：若仍被聚合，直接拉到不聚合的縮放層級 */
    var uncluster = function () {
      if (o.cluster && clusterGroup.hasLayer(o.marker) && clusterGroup.getVisibleParent(o.marker) !== o.marker) {
        afterMove(function () { setTimeout(function () { tryOpen(true); }, 80); });
        map.setView(ll, Math.max(map.getZoom(), 11), { animate: anim });
      } else {
        tryOpen(true);
      }
    };
    /* 第一步：達到該分類的最低縮放並把標記帶進畫面 */
    var needZoom = map.getZoom() < o.cat.min_zoom;
    if (needZoom || !map.getBounds().contains(ll)) {
      afterMove(function () { setTimeout(uncluster, 80); });
      map.setView(ll, Math.max(map.getZoom(), o.cat.min_zoom), { animate: anim });
    } else {
      uncluster();
    }
  }

  /* ==========================================================
     Layers + legend
     ========================================================== */
  function buildLayers() {
    $('layers').innerHTML = LAYER_ORDER.map(function (n) {
      var L2 = LAYERS[n];
      return '<label class="lay"><input type="checkbox" data-layer="' + esc(n) + '"' +
        ' aria-label="圖層：' + esc(n) + '，' + L2.count + ' 個站點"' + (state.layerOn[n] ? ' checked' : '') + '>' +
        '<span class="nm2">' + esc(n) + '</span><span class="ct">' + L2.count + '</span></label>';
    }).join('');
    $('layers').addEventListener('change', function (e) {
      var t = e.target;
      if (!t.dataset || !t.dataset.layer) return;
      state.layerOn[t.dataset.layer] = t.checked;
      refreshMarkers();
      announce((t.checked ? '已顯示' : '已隱藏') + '「' + t.dataset.layer + '」圖層。');
    });

    $('legend').innerHTML = CATS.map(function (c) {
      return '<div class="lg" data-cat="' + esc(c.code) + '" title="' + esc(c.name_zh + '（' + c.name_en + '），縮放 z' + c.min_zoom + ' 以上顯示') + '">' +
        shapeSvg(c, 16) + '<span>' + esc(c.name_zh) + '</span><span class="z" aria-hidden="true">z' + c.min_zoom + '</span></div>';
    }).join('');

    $('map-hint').innerHTML =
      '標記會隨縮放逐步出現（圖例右側為最低縮放層級）。<b>極光觀測點</b>與<b>住宿</b>永遠單獨顯示，其他分類在遠景時聚合為數字圓圈。';
  }

  function renderLegend() {
    var z = map ? map.getZoom() : 6;
    var nodes = document.querySelectorAll('#legend .lg');
    for (var i = 0; i < nodes.length; i++) {
      var c = CAT[nodes[i].dataset.cat];
      nodes[i].classList.toggle('off', !(state.layerOn[c.layer] && z >= c.min_zoom));
    }
  }

  function toggleSide(force) {
    state.side = typeof force === 'boolean' ? force : !state.side;
    $('map-side').hidden = !state.side;
    $('btn-side').setAttribute('aria-expanded', String(state.side));
    if (state.side) {
      if (isSheet() && sheet.state !== 'peek') setSheet('peek');
      var first = $('map-side').querySelector('#side-close');
      if (first) first.focus({ preventScroll: true });
    }
  }

  /* ==========================================================
     Day tabs + day content
     ========================================================== */
  function buildDayTabs() {
    var box = $('daytabs');
    box.innerHTML = DAYS.map(function (d) {
      var warn = !!WARN_DAYS[d.day];
      var on = d.day === state.day;
      return '<button class="dtab" role="tab" id="dt-' + d.day + '" aria-controls="daybody"' +
        ' tabindex="' + (on ? '0' : '-1') + '"' +
        ' aria-label="Day ' + d.day + '，' + esc(d.date) + '，' + esc(d.title_zh) + '，住宿 ' + esc(stayLabel(d)) +
          (warn ? '（此日有行前提醒）' : '') + '"' +
        ' data-day="' + d.day + '" aria-selected="' + on + '">' +
        '<span class="n" aria-hidden="true">' + d.day + '</span>' +
        '<span class="dt" aria-hidden="true">' + esc(d.date.slice(5).replace('-', '/')) + '</span>' +
        (warn ? '<span class="flag" aria-hidden="true">' + icon('warning', 'ph-fill') + '</span>' : '') +
        '</button>';
    }).join('');

    /* delegated listeners bound ONCE: renderDay() 會替換 #daybody 內容 */
    var body = $('daybody');
    body.addEventListener('click', function (e) {
      var n = e.target.closest('.node');
      if (n) selectNode(n.dataset.id, true);
    });
    body.addEventListener('keydown', function (e) {
      var n = e.target.closest('.node');
      if (!n) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        selectNode(n.dataset.id, true);
      }
    });

    box.addEventListener('click', function (e) {
      var b = e.target.closest('.dtab');
      if (b) setDay(Number(b.dataset.day), false, true);
    });
    /* ARIA tabs keyboard model */
    box.addEventListener('keydown', function (e) {
      var b = e.target.closest('.dtab');
      if (!b) return;
      var k = e.key, n = DNUMS.length, j = null;
      var i = DNUMS.indexOf(Number(b.dataset.day));
      if (k === 'ArrowRight') j = (i + 1) % n;
      else if (k === 'ArrowLeft') j = (i - 1 + n) % n;
      else if (k === 'Home') j = 0;
      else if (k === 'End') j = n - 1;
      if (j === null) return;
      e.preventDefault();
      var nb = box.querySelector('.dtab[data-day="' + DNUMS[j] + '"]');
      if (nb) { nb.focus(); setDay(DNUMS[j], false, true); }
    });
  }

  function dayLocs(day) {
    return LOCS.filter(function (l) { return l.day === day; }).sort(function (a, b) { return a.order - b.order; });
  }

  function setDay(day, skipMap, fromUser) {
    var changed = state.day !== day;
    state.day = day;
    state.sel = null;
    var tabs = document.querySelectorAll('.dtab');
    for (var i = 0; i < tabs.length; i++) {
      var on = Number(tabs[i].dataset.day) === day;
      tabs[i].setAttribute('aria-selected', String(on));
      tabs[i].setAttribute('tabindex', on ? '0' : '-1');
      if (on) tabs[i].scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
    if (changed || !$('daybody').firstChild) renderDay();
    updateWave();
    if (fromUser) {
      /* 已往下捲到站點清單時，換日後回到當日標題 */
      var top = $('daybody').offsetTop;
      if (isSheet()) scroller.scrollTop = 0;
      else if (scroller.scrollTop > top) scroller.scrollTop = top;
      if (isSheet() && sheet.state === 'peek') setSheet('half');
    }
    if (!skipMap) focusDay(day);
    announceDay();
  }

  function setDayIndicator(txt) {
    var s = $('map-day-ind').querySelector('span');
    if (s) s.textContent = txt;
  }

  function focusDay(day, force, instant) {
    if (!map) return;
    var ls = dayLocs(day);
    if (!ls.length) return;
    var b = L.latLngBounds(ls.map(function (l) { return [l.lat, l.lon]; }));
    /* 同一天內點站點只平移，不重設使用者自行調整的縮放 */
    var refit = force || lastFit !== day;
    lastFit = day;
    var pad = mapPad();
    if (refit) {
      map.fitBounds(b, { paddingTopLeft: pad.tl, paddingBottomRight: pad.br, animate: !instant && !reduceMotion(), maxZoom: 11 });
    }
    restyleRoutes();
    var dd = dayOf(day);
    setDayIndicator('Day ' + day + (dd ? '，' + stayLabel(dd) : ''));
  }

  function renderDay() {
    var d = dayOf(state.day);
    var ls = dayLocs(state.day);
    var warnMap = {
      3: '本日負荷偏高：行車加遊覽超出「日照 + 1 h」可用視窗約 1.2-1.6 h，<b>務必 08:00 前出發</b>，或啟用 §2.6 的捨棄順序。',
      4: '冬季行車 <b>7.3 h 已達規劃上限</b>，且同屬負荷偏高日；天候不佳請直接改用 §1.4 替代方案。',
      5: '全行程最長的一日：行車加遊覽超出可用視窗約 1.2-1.6 h，<b>務必 08:00 前出發</b>。',
      9: '本日住宿為 <b>Reykjavík（Bortle 8）</b>，末夜光害最高。若仍要追極光，建議改住市郊（如 Seltjarnarnes）或延後還車，夜間再赴 Grótta。'
    };
    var twilight = Math.max(0, 24 - d.daylight_h - d.astro_dark_h);
    var tiles = [
      { k: '當日里程', v: d.route_km, s: 'km', c: '' },
      { k: '行車', v: fmtMin(d.drive_min), s: '', c: '' },
      { k: '冬季行車', v: fmtMin(d.drive_min_winter), s: '', c: WARN_DAYS[d.day] ? 'w' : '' },
      { k: '遊覽', v: d.visit_min ? fmtMinH(d.visit_min) : '0', s: 'h', c: '' }
    ];
    var html =
      '<article class="card card-ink day-hero" aria-labelledby="day-title">' +
        '<div class="day-kicker"><span class="dn">Day ' + d.day + '</span><span>' + esc(d.date.replace(/-/g, '/')) + '</span></div>' +
        '<h3 class="day-title" id="day-title">' + esc(d.title_zh) + '</h3>' +
        '<div class="day-route">' + esc(d.start_town) + icon('arrow-right') + '<b>' + esc(stayLabel(d)) + '</b>' +
          (d.stay_town_local ? '<span>' + esc(d.stay_town_local) + '</span>' : '') + '</div>' +
        '<div class="chips"><span class="chip">' + icon('compass') + esc(d.region) + '</span>' +
          '<span class="chip">' + icon('map-pin-simple') + ls.length + ' 個站點</span></div>' +
        '<div class="hero-viz">' +
          '<div class="donut" role="img" aria-label="24 小時光照：日照 ' + num(d.daylight_h) + ' 小時、暮光 ' + num(twilight) + ' 小時、天文黑暗 ' + num(d.astro_dark_h) + ' 小時">' +
            donutSvg([
              { v: d.daylight_h, color: 'var(--day-light)' },
              { v: twilight, color: 'var(--day-twilight)' },
              { v: d.astro_dark_h, color: 'var(--day-dark)' }
            ], 24, 'rgba(255,255,255,.08)') +
            '<div class="c" aria-hidden="true"><b>' + num(d.astro_dark_h) + '<small>h</small></b><span>天文黑暗</span></div>' +
          '</div>' +
          '<div class="hero-tiles">' + tiles.map(function (t) {
            return '<div class="tile ' + t.c + '"><div class="k">' + esc(t.k) + '</div><div class="v">' + esc(t.v) +
              (t.s ? '<small>' + esc(t.s) + '</small>' : '') + '</div></div>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="light-legend">' +
          '<span class="key"><span class="swatch" style="background:var(--day-light)"></span>日照 <b>' + num(d.daylight_h) + ' h</b></span>' +
          '<span class="key"><span class="swatch" style="background:var(--day-twilight)"></span>暮光 <b>' + num(twilight) + ' h</b></span>' +
          '<span class="key"><span class="swatch" style="background:var(--day-dark)"></span>天文黑暗 <b>' + num(d.astro_dark_h) + ' h</b></span>' +
          '<span class="sun"><span>' + icon('sun-horizon') + '<b>' + esc(d.sunrise_utc) + '</b></span><span>' + icon('moon') + '<b>' + esc(d.sunset_utc) + '</b> UTC</span></span>' +
        '</div>' +
      '</article>' +
      (d.notes ? '<div class="callout">' + icon('info') + '<div>' + esc(d.notes) + '</div></div>' : '') +
      (warnMap[d.day] ? '<div class="callout warn">' + icon('warning', 'ph-fill') + '<div><b>行前提醒</b>　' + warnMap[d.day] + '</div></div>' : '') +
      '<article class="card timeline-card">' +
        '<div class="card-h"><h3>當日站點</h3><span class="aside">' + ls.length + ' 站，' + d.route_km + ' km</span></div>' +
        '<div class="timeline" aria-label="Day ' + d.day + ' 站點">' +
          ls.map(function (l, i) { return nodeHtml(l, i); }).join('') +
        '</div>' +
      '</article>';
    $('daybody').innerHTML = html;
  }

  function nodeHtml(loc, i) {
    var cat = CAT[loc.category];
    var isStay = /住宿/.test(loc.name_zh);
    var tags = '<span class="tag">' + esc(cat.name_zh) + '</span>';
    if (loc.road) tags += '<span class="tag">' + icon('path') + esc(loc.road) + ' 號</span>';
    tags += '<span class="tag">Bortle ' + loc.bortle + '</span>';
    if (loc.aurora_score > 0) tags += '<span class="tag">極光 ' + stars(loc.aurora_score) + '</span>';
    if (loc.winter_access === 'CAUTION') tags += '<span class="tag caution">' + icon('snowflake') + '冬季須確認</span>';
    if (loc.out_and_back) tags += '<span class="tag">原路折返</span>';
    if (isStay) tags += '<span class="tag stay">' + icon('bed') + '當日住宿</span>';

    var legs = '<span>' + icon('path') + num(loc.leg_km, 1) + ' km</span>' +
      '<span>' + icon('clock') + loc.leg_min + ' 分</span>' +
      '<span>' + icon('snowflake') + '冬 ' + loc.leg_min_winter + ' 分</span>' +
      (loc.visit_min ? '<span>' + icon('hourglass-medium') + '停留 ' + loc.visit_min + ' 分</span>' : '');

    return '<div class="node' + (isStay ? ' stay' : '') + (state.sel === loc.id ? ' sel' : '') + '" style="--i:' + (i + 1) + '"' +
      ' data-id="' + esc(loc.id) + '" tabindex="0" role="button" aria-label="' +
      esc('第 ' + loc.order + ' 站 ' + loc.name_zh + '，' + cat.name_zh + '，Bortle ' + loc.bortle +
        '，本段 ' + num(loc.leg_km, 1) + ' 公里 ' + loc.leg_min + ' 分。在地圖上定位') + '">' +
      '<div class="ord" aria-hidden="true">' + loc.order + '</div>' +
      '<div>' +
        '<div class="nm">' + shapeSvg(cat, 16) + '<b>' + esc(loc.name_zh) + '</b><span class="loc">' + esc(loc.name_local) + '</span></div>' +
        '<div class="legs">' + legs + '</div>' +
        '<div class="tags">' + tags + '</div>' +
        (loc.notes ? '<div class="nt">' + esc(loc.notes) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  function selectNode(id, fromList) {
    var o = markers.filter(function (m) { return m.loc.id === id; })[0];
    if (!o) return;
    /* 點地圖上別天的標記：日期頁籤與清單一起切換，並確保在每日行程頁 */
    if (!fromList) {
      if (o.loc.day !== state.day) setDay(o.loc.day, true);
      if (state.view !== 'days') showView('days', true);
    }
    state.sel = id;
    var nodes = document.querySelectorAll('.node');
    for (var i = 0; i < nodes.length; i++) {
      var isSel = nodes[i].dataset.id === id;
      nodes[i].classList.toggle('sel', isSel);
      if (isSel) nodes[i].setAttribute('aria-current', 'true');
      else nodes[i].removeAttribute('aria-current');
    }
    if (!map) return;
    if (fromList) {
      /* 手機：收合抽屜讓出地圖，再飛到標記 */
      if (isSheet()) setSheet('peek');
      var needFit = lastFit !== o.loc.day;
      focusDay(o.loc.day);
      if (needFit) afterMove(function () { revealMarker(o); });
      else revealMarker(o);
    } else {
      if (lastFit !== o.loc.day) {
        lastFit = o.loc.day;
        restyleRoutes();
        var dd = dayOf(o.loc.day);
        setDayIndicator('Day ' + o.loc.day + (dd ? '，' + stayLabel(dd) : ''));
      }
      openPopupFor(o);
      revealNode(id);
    }
    announce(o.loc.name_zh + '：Day ' + o.loc.day + ' 第 ' + o.loc.order + ' 站，地圖與清單已同步。');
  }

  /* 讓地圖選取的站點在清單中可見（只捲面板，不捲整頁） */
  function revealNode(id) {
    var el = document.querySelector('.node[data-id="' + id + '"]');
    if (!el) return;
    var sr = scroller.getBoundingClientRect(), r = el.getBoundingClientRect();
    var visBottom = isSheet() ? Math.min(sr.bottom, window.innerHeight) : sr.bottom;
    if (r.top < sr.top + 8 || r.bottom > visBottom - 8) {
      var target = scroller.scrollTop + (r.top - sr.top) - 16;
      scroller.scrollTo({ top: target, behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  }

  /* ==========================================================
     Guide (§2)
     ========================================================== */
  function gcard(ic, title, ref, inner, cls) {
    return '<article class="card gcard' + (cls ? ' ' + cls : '') + '"><div class="gcard-h"><span class="ic" aria-hidden="true">' + icon(ic) + '</span>' +
      '<h3>' + title + '</h3><span class="ref">' + ref + '</span></div>' + inner + '</article>';
  }
  function table(headers, rows) {
    return '<div class="tscroll"><table class="t"><thead><tr>' +
      headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function buildGuide() {
    var bortleDist = [
      { b: 2, n: 14, ex: 'Þingvellir、Skaftafell、Vestrahorn、Stuðlagil、Mývatn、Hvítserkur' },
      { b: 3, n: 23, ex: '冰河湖、Reynisfjara、Djúpalónssandur、Kirkjufell、Stykkishólmur' },
      { b: 4, n: 9, ex: '藍湖、Vík、Höfn、Egilsstaðir、Húsavík、Sauðárkrókur、Hvammstangi' },
      { b: 5, n: 3, ex: 'Selfoss、Borgarnes、Akranes' },
      { b: 6, n: 4, ex: '機場、Grótta、藍湖、阿克雷里' },
      { b: 8, n: 2, ex: '雷克雅維克市中心' }
    ];
    var totalN = bortleDist.reduce(function (a, b) { return a + b.n; }, 0);
    var season = [
      { p: '8 月下 - 9 月', n: '縮短中', v: '中至高', d: '季節開端；秋分（9 月下）有地磁活動高峰，氣溫尚可、道路未大量結冰' },
      { p: '10 月 - 11 月', n: '長', v: '高', d: '黑暗充足；天氣較不穩定，雲量是主要變數。本規劃採 10 月上旬（日照 10.0-11.0 h、天文黑暗 7.6-8.8 h）', hl: 1 },
      { p: '12 月 - 1 月', n: '最長（日照僅 4-5 h）', v: '高', d: '理論最佳，但暴風雪與封路風險最高；日照短削弱白天觀光價值' },
      { p: '2 月 - 3 月', n: '中', v: '最高性價比', d: '夜仍長、天氣漸穩、春分（3 月）帶來另一波地磁高峰' },
      { p: '4 月上 - 中', n: '快速縮短', v: '遞減', d: '極光季尾聲' },
      { p: '5 月 - 8 月中', n: '極短／無', v: '幾乎不可見', d: '永晝效應，天空不夠暗' }
    ];
    var weather = [
      ['雲量', 'en.vedur.is/weather/forecasts/aurora', '綠色＝有雲、白色＝晴。Kp 再高，雲層覆蓋就看不到。<b>這是第一順位判準</b>'],
      ['地磁活動', '同頁右上 Kp 值（0-9）', '2-3 為常見且足夠；4-6 為大爆發；7-9 極罕見'],
      ['太陽風', 'Bz 值（南向＝活躍）、風速、密度', 'Bz 轉南是短時爆發的關鍵訊號'],
      ['風速', 'vedur.is 色碼警示', '11-17 m/s 行車已有難度；18 m/s 以上不建議上路；車門須雙手握持'],
      ['警示色', '黃／橘／紅', '黃色即應調整行程；橘、紅色延後出發，勿強行通過'],
      ['路況', 'umferdin.is / road.is', '綠＝通行、藍＝濕滑、紅＝不可通行；另標示飛石與積雪']
    ];
    var photo = [
      ['光圈', 'f/1.4 - f/2.8', '越大越好；f/4 需提高 ISO 或延長曝光'],
      ['快門', '5 - 15 s', '微弱極光用 10-15 s；強爆發用 2-5 s 保留結構'],
      ['ISO', '1600 - 3200', '視機身可用高感度調整'],
      ['對焦', '手動，對無限遠', '自動對焦在低光下失效'],
      ['必備', '穩固三腳架、備用電池', '低溫耗電快，建議 2 顆以上'],
      ['構圖', '前景（教會山、冰河湖、瀑布）加極光', '月光可補前景光；新月對比最強'],
      ['手機', '夜間模式 1-4 s、ISO 800-3200', '需固定機身']
    ];
    var tips = [
      '每天保留夜間額度：行程於日落前收束，晚間 21:00 起可外出，不安排夜間長途移動。',
      '連住策略：Mývatn 連住 2 晚（可 +1 晚），是提升成功率最有效的單一手段。',
      '不要因 Kp 低而放棄：冰島在橢圓帶內，Kp 2-3 已足夠；以雲量為判斷。',
      '準備「捨棄順序」：天氣不好時依序犧牲 ① Stuðlagil（Day 4）、② Seyðisfjörður（Day 4）、③ Ásbyrgi（Day 5）、④ Fjaðrárgljúfur（Day 3）；冰河湖、米湖、教會山優先保留。',
      'Night 1 不要排滿：抵達日有時差與疲勞，安排 Grótta 這類短程、可隨時撤退的觀測點。',
      '住宿選址：優先「城鎮邊緣、可步行離開路燈」的旅館；訂房時確認夜間出入口不鎖。',
      '行前 72 小時才定案：以 vedur.is 一週預報微調 Day 3-9 的順序，而非更動住宿。',
      '車輛：11/1-4/15 法定須裝冬季胎（最低胎紋 3 mm），建議加訂四輪驅動與含飛石的加值保險（SAAP）。',
      '冬季日照：10 月約 10 小時日照足以完成本規劃；12 月僅 4-5 小時，須延長 2-3 天或刪減景點。',
      '極光外備案：連續多雲時，可安排地熱泳池（Húsavík、Mývatn Nature Baths）、賞鯨（Húsavík）或藍湖。'
    ];

    $('guide').innerHTML =
      gcard('globe-hemisphere-west', '極光橢圓帶：為什麼是冰島', '§2.1',
        '<p class="lead">極光沿著環繞<b>地磁極</b>的「極光橢圓帶（auroral oval）」發生，而不是在極點正上方。</p>' +
        '<p>冰島地磁緯度約 64-66°N，<b>幾乎整個島都在橢圓帶內部</b>，因此：</p>' +
        '<ul><li><b>不需要高 Kp 值</b>。Kp 3-4 時冰島常已有明顯極光；Kp 5-6 為大爆發。Kp 是活動度指標，<b>不是可見性門檻</b>，看到 Kp 2 也別放棄當晚。</li>' +
        '<li><b>Kp 的意義因地而異</b>。Kp 5 在中歐是「必須出門」，在冰島是「額外驚喜」。出發判斷請以雲量為第一判準。</li></ul>', 'card-ink') +
      gcard('calendar-dots', '最佳月份', '§2.2',
        table(['期間', '夜長', '可見度', '說明'], season.map(function (s) {
          return '<tr' + (s.hl ? ' class="hl"' : '') + '><td class="num">' + esc(s.p) + '</td><td>' + esc(s.n) + '</td><td><b>' + esc(s.v) + '</b></td><td>' + esc(s.d) + '</td></tr>';
        })) +
        '<p class="sub"><b>建議窗口排序</b></p>' +
        '<div class="rank"><span>3 月</span><span>9 月下</span><span class="gt">&gt;</span><span>2 月</span><span class="gt">&gt;</span><span>10 月</span><span class="gt">&gt;</span><span>11 月</span><span class="gt">&gt;</span><span>12-1 月</span></div>' +
        '<p class="sub"><b>太陽活動週期</b>：第 25 太陽週期極大期約在 2024-2026 年，2026 年仍屬高活動期。</p>', 'span-2') +
      gcard('moon-stars', '觀測時段', '§2.3',
        '<ul><li><b>主要視窗</b>：約 21:00 - 02:00（冰島全年 UTC+0）。</li>' +
        '<li><b>最佳時段</b>：22:30 - 01:00，極光常在午夜前後達到高峰。</li>' +
        '<li>10 月天文黑暗始於日落後約 1.5 小時；本規劃每夜約 <b>7.6 - 8.8 小時</b>。</li></ul>' +
        table(['Day', '日期', '日照', '天文黑暗', '住宿'], DAYS.map(function (d) {
          return '<tr><td class="num">' + d.day + '</td><td class="num">' + esc(d.date.slice(5).replace('-', '/')) + '</td><td class="num">' + num(d.daylight_h) + ' h</td><td class="num"><b>' + num(d.astro_dark_h) + ' h</b></td><td>' + esc(stayLabel(d)) + '</td></tr>';
        }))) +
      gcard('lightbulb-filament', '光害：Bortle 暗空分類', '§2.4',
        '<p class="lead">1 = 最暗、9 = 市中心。本規劃 ' + totalN + ' 個站點的分布：</p>' +
        '<div class="bortle-viz">' +
          '<div class="donut" role="img" aria-label="Bortle 分布：' + bortleDist.map(function (b) { return 'Bortle ' + b.b + ' 有 ' + b.n + ' 個'; }).join('、') + '">' +
            donutSvg(bortleDist.map(function (b) { return { v: b.n, color: bortleColor(b.b) }; }), totalN, 'var(--surface-2)') +
            '<div class="c" aria-hidden="true"><b>' + (bortleDist[0].n + bortleDist[1].n) + '</b><span>Bortle 3 以下</span></div>' +
          '</div>' +
          '<div class="bortle-keys" aria-hidden="true">' + bortleDist.map(function (b) {
            return '<span class="key"><span class="swatch" style="background:' + bortleColor(b.b) + '"></span><b>' + b.b + '</b>' + b.n + ' 個' + (b.b === 2 ? '，極暗' : b.b === 8 ? '，市區' : '') + '</span>';
          }).join('') + '</div>' +
        '</div>' +
        table(['Bortle', '站點', '代表地點'], bortleDist.map(function (b) {
          return '<tr><td class="num"><span class="key"><span class="swatch" style="background:' + bortleColor(b.b) + '"></span><b>' + b.b + '</b></span></td><td class="num">' + b.n + '</td><td>' + esc(b.ex) + '</td></tr>';
        })) +
        '<p class="sub"><b>行程應用</b>：除起訖點雷克雅維克（Bortle 8）外，住宿城鎮皆在 Bortle 5 以下，Mývatn 為 Bortle 2。首都圈另安排 Grótta（Bortle 6）作為不必離開市區的追光點。</p>') +
      gcard('cloud', '天氣與雲量：真正的成敗關鍵', '§2.5',
        table(['因子', '工具／指標', '判讀方式'], weather.map(function (w) {
          return '<tr><td><b>' + esc(w[0]) + '</b></td><td>' + esc(w[1]) + '</td><td>' + w[2] + '</td></tr>';
        })) +
        '<p class="sub"><b>找晴空的策略</b>：北部（Mývatn／Akureyri）與東北部通常雲量最少，南岸（Vík 至 Höfn）最多。因此行程在米湖連住，並允許以雲圖決定當日景點順序。</p>', 'span-2') +
      gcard('list-checks', '行程安排建議', '§2.6',
        '<ol>' + tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>') +
      gcard('camera', '攝影設定建議', '§2.7',
        table(['項目', '建議值', '說明'], photo.map(function (p) {
          return '<tr><td><b>' + esc(p[0]) + '</b></td><td class="num">' + esc(p[1]) + '</td><td>' + esc(p[2]) + '</td></tr>';
        })));
  }

  /* ==========================================================
     Warnings (§6)
     ========================================================== */
  function buildWarnings() {
    var warns = [
      {
        cls: 'card-sand', ic: 'warning', label: '負荷',
        h: 'Day 3、4、5 負荷偏高',
        body: '<p>行車加遊覽時間比「日照 + 1 h」的可用視窗多出約 <b>1.2-1.6 小時</b>，這三天<b>必須 08:00 前出發</b>，或啟用 §2.6 的捨棄順序。</p>' +
          table(['Day', '里程', '行車', '冬季', '遊覽', '日照', '超出'], [3, 4, 5].map(function (n) {
            var d = dayOf(n);
            var over = ((d.drive_min + d.visit_min) / 60) - (d.daylight_h + 1);
            return '<tr><td class="num">' + n + '</td><td class="num">' + d.route_km + ' km</td><td class="num">' + fmtMin(d.drive_min) + '</td><td class="num">' + fmtMin(d.drive_min_winter) + '</td><td class="num">' + fmtMinH(d.visit_min) + ' h</td><td class="num">' + num(d.daylight_h) + ' h</td><td class="num over">+' + num(over) + ' h</td></tr>';
          })) +
          '<p class="sub">偏好輕鬆節奏的話，可將 Day 4 拆為兩日（Höfn 至 Egilsstaðir 分兩段），或 Day 5 取消 Ásbyrgi。</p>',
        act: '08:00 前出發；或依序捨棄 ① Stuðlagil ② Seyðisfjörður（Day 4）③ Ásbyrgi（Day 5）。'
      },
      {
        cls: 'card-ink', ic: 'moon-stars', label: '光害',
        h: 'Day 9 回到雷克雅維克（Bortle 8）',
        body: '<p>還車與離境動線使末夜光害最高：Day 9 住宿 <b>Reykjavík</b> 的 Bortle 值為 <b>8 / 9</b>，其餘住宿城鎮皆在 Bortle 5 以下。</p>' +
          '<p>若最後一晚仍想追極光，建議改住市郊（如 Seltjarnarnes）或延後還車，晚間再赴 Grótta（Bortle 6，首都圈最佳極光點，停車後步行約 10 分）。</p>',
        act: '改住市郊，或延後還車，夜間赴 Grótta。'
      },
      {
        cls: 'danger', ic: 'steering-wheel', label: '行車上限',
        h: 'Day 4 冬季行車 7.3 小時，已達上限',
        body: '<p>Day 4（Höfn 至 Egilsstaðir）冬季預估行車 <b>7.3 小時</b>（OSRM 理論 6:07 × 1.20 冬季係數），已達「單日冬季行車不超過 7 小時」的上限。</p>' +
          '<p>東峽灣多彎道與單線橋；若 93 號或 Öxi（939）封閉，改走 1 號公路繞行 Breiðdalsheiði。</p>',
        act: '天候不佳直接改用 §1.4 替代方案；或將 Day 4 拆為兩日。'
      }
    ];
    $('warns').innerHTML = warns.map(function (w) {
      return '<article class="card wcard ' + w.cls + '">' +
        '<div class="wcard-h"><span class="ic" aria-hidden="true">' + icon(w.ic, 'ph-fill') + '</span>' +
        '<div><div class="wl">' + esc(w.label) + '</div><h3>' + esc(w.h) + '</h3></div></div>' +
        w.body + '<div class="act">' + icon('arrow-bend-down-right') + '<div><b>行動</b>　' + esc(w.act) + '</div></div></article>';
    }).join('');

    var cont = [
      ['南岸封路（Vík 至 Höfn）', 'road.is 顯示紅色／路面封閉', '退回 Vík 或 Selfoss，改走金環加碼（Silfra、Kerið），在首都圈等天氣好轉'],
      ['東峽灣 93 號封閉', '塞濟斯菲厄澤山口結冰', '取消 Seyðisfjörður 支線，直接在 Egilsstaðir 住宿'],
      ['Öxi（939）封閉', '冬季常態封閉', '沿 1 號公路繞行 Breiðdalsheiði（已為本規劃主線）'],
      ['Day 4、5 負荷過重', '大風警示或起步延誤', '依 §2.6 捨棄順序：先砍 Stuðlagil 與 Seyðisfjörður（Day 4），再砍 Ásbyrgi（Day 5）'],
      ['Day 9 山路不佳', '574 號結冰', '縮短為 Ólafsvík、Akranes、Reykjavík（省下 Djúpalónssandur、Arnarstapi）'],
      ['全島惡劣天候', '橘色／紅色警示', '留在 Mývatn 或 Reykjavík，不強行移動']
    ];
    $('contingency').innerHTML = table(['情境', '觸發條件', '替代方案'], cont.map(function (c) {
      return '<tr><td><b>' + esc(c[0]) + '</b></td><td>' + esc(c[1]) + '</td><td>' + esc(c[2]) + '</td></tr>';
    }));
  }

  /* ==========================================================
     Views + map controls
     ========================================================== */
  function setWide(on) {
    state.wide = !!on && !isSheet();
    $('app').classList.toggle('panel-hidden', state.wide);
    var b = $('btn-wide');
    b.setAttribute('aria-pressed', String(state.wide));
    b.setAttribute('aria-label', state.wide ? '還原版面' : '放大地圖');
    b.innerHTML = icon(state.wide ? 'arrows-in-simple' : 'arrows-out-simple') + '<span class="lbl">' + (state.wide ? '還原' : '放大') + '</span>';
  }

  function showView(name, quiet) {
    /* 放大地圖時面板被隱藏，切換分頁先自動還原 */
    if (state.wide) setWide(false);
    state.view = name;
    $('app').setAttribute('data-view', name);
    Array.prototype.forEach.call(document.querySelectorAll('.seg button'), function (x) {
      var on = x.dataset.view === name;
      x.setAttribute('aria-selected', String(on));
      x.setAttribute('tabindex', on ? '0' : '-1');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) { v.classList.remove('active'); });
    var v = $('view-' + name);
    if (v) v.classList.add('active');
    scroller.scrollTop = 0;
    /* 手機閱讀指南／提醒時直接展開成全高 */
    if (isSheet() && !quiet) setSheet(name === 'days' ? (sheet.state === 'full' ? 'full' : 'half') : 'full');
    var names = { days: '每日行程', guide: '極光指南', warn: '行前提醒' };
    if (!quiet) announce('已切換至「' + (names[name] || name) + '」。');
  }

  function initViewTabs() {
    var arr = Array.prototype.slice.call(document.querySelectorAll('.seg button'));
    arr.forEach(function (b, i) {
      b.addEventListener('click', function () { showView(b.dataset.view); });
      b.addEventListener('keydown', function (e) {
        var k = e.key, n = arr.length, j = -1;
        if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + n) % n;
        else if (k === 'Home') j = 0;
        else if (k === 'End') j = n - 1;
        if (j < 0) return;
        e.preventDefault();
        arr[j].focus();
        showView(arr[j].dataset.view);
      });
    });
    showView('days', true);
  }

  function initControls() {
    $('btn-theme').addEventListener('click', function () { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); });
    $('btn-fit').addEventListener('click', function () {
      if (!map) return;
      var pad = mapPad();
      map.fitBounds(L.latLngBounds(LOCS.map(function (l) { return [l.lat, l.lon]; })),
        { paddingTopLeft: pad.tl, paddingBottomRight: pad.br, maxZoom: 8, animate: !reduceMotion() });
      lastFit = null;
      restyleRoutes();
      setDayIndicator('全島視野');
      announce('已切換為全島視野。');
    });
    $('btn-day').addEventListener('click', function () { focusDay(state.day, true); });
    $('btn-base').addEventListener('click', function () {
      setBasemap(baseIdx + 1);
      announce('底圖已切換為' + BASEMAPS[baseIdx].name + '。');
    });
    $('btn-side').addEventListener('click', function () { toggleSide(); });
    $('side-close').addEventListener('click', function () { toggleSide(false); $('btn-side').focus(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.side) { toggleSide(false); $('btn-side').focus(); }
    });
    $('btn-wide').addEventListener('click', function () { setWide(!state.wide); });
    $('lay-all').addEventListener('click', function () { setAllLayers(true); announce('已開啟全部圖層。'); });
    $('lay-none').addEventListener('click', function () { setAllLayers(false); announce('已關閉全部圖層。'); });
    $('lay-def').addEventListener('click', function () {
      LAYER_ORDER.forEach(function (n) { state.layerOn[n] = LAYERS[n].on; });
      syncLayerInputs(); refreshMarkers();
      announce('已回復預設圖層。');
    });
  }
  function setAllLayers(v) {
    LAYER_ORDER.forEach(function (n) { state.layerOn[n] = v; });
    syncLayerInputs(); refreshMarkers();
  }
  function syncLayerInputs() {
    var ins = document.querySelectorAll('#layers input');
    for (var i = 0; i < ins.length; i++) ins[i].checked = !!state.layerOn[ins[i].dataset.layer];
  }

  /* ---------- boot ---------- */
  function boot() {
    syncThemeUi();
    buildOverview();
    buildLayers();
    buildDayTabs();
    buildGuide();
    buildWarnings();
    initSheet();
    initViewTabs();
    initControls();
    var ok = initMap();
    renderDay();
    if (ok) { map.invalidateSize(false); focusDay(0, true, true); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
