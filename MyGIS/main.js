/* ============================================================
   SENTINEL GEOINT DASHBOARD — sample/demo data + logic
   ============================================================ */

/* ---------- SAMPLE DATA ---------- */
const ASSETS = [
  {id:'A-114', name:'Coastal Patrol Vessel', type:'Maritime', lat:35.10, lng:35.30, status:'online',   speed:'14 kt',  cls:'cyan',  icon:'⚓'},
  {id:'A-118', name:'Recon UAV-2',           type:'Air',      lat:34.60, lng:35.60, status:'online',   speed:'120 kt', cls:'cyan',  icon:'✈'},
  {id:'A-121', name:'Forward Ops Team',      type:'Ground',   lat:34.30, lng:35.10, status:'online',   speed:'0 kt',   cls:'cyan',  icon:'▣'},
  {id:'A-127', name:'Supply Convoy',         type:'Ground',   lat:34.85, lng:35.45, status:'degraded', speed:'38 kt',  cls:'amber', icon:'▣'},
  {id:'A-130', name:'Signal Relay',          type:'Comms',    lat:35.15, lng:34.90, status:'online',   speed:'—',      cls:'cyan',  icon:'◉'},
  {id:'A-133', name:'Maritime Escort',       type:'Maritime', lat:35.40, lng:35.75, status:'offline',  speed:'0 kt',   cls:'red',   icon:'⚓'},
];

const THREATS = [
  {id:'T-201', name:'Suspicious Vessel', lat:35.10, lng:35.55, sev:'high', type:'Maritime', time:'02:14'},
  {id:'T-204', name:'UAV Incursion',     lat:34.45, lng:35.20, sev:'high', type:'Air',      time:'01:47'},
  {id:'T-207', name:'Signal Burst',      lat:34.70, lng:35.35, sev:'med',  type:'SIGINT',   time:'01:02'},
  {id:'T-210', name:'Convoy Movement',   lat:34.95, lng:35.05, sev:'med',  type:'Ground',   time:'00:38'},
  {id:'T-213', name:'Radar Contact',     lat:35.30, lng:35.90, sev:'low',  type:'Maritime', time:'00:11'},
];

const ZONES = [
  {name:'AOI-1 // Patrol Zone',    lat:35.05, lng:35.20, r:0.35, color:'#34d399'},
  {name:'EXCL-2 // Restricted',    lat:34.55, lng:35.50, r:0.25, color:'#f87171'},
  {name:'WATCH-3 // Monitoring',   lat:35.25, lng:35.60, r:0.30, color:'#fbbf24'},
];

const ROUTES = [
  {name:'Convoy Route 7', pts:[[34.30,35.10],[34.55,35.25],[34.85,35.45],[35.05,35.55]], color:'#fbbf24'},
  {name:'Patrol Track',   pts:[[35.02,35.30],[35.10,35.50],[35.20,35.40],[35.15,35.20],[35.02,35.30]], color:'#22d3ee'},
  {name:'Air Corridor',   pts:[[34.60,35.60],[34.70,35.40],[34.80,35.20]], color:'#a78bfa'},
];

const FEED = [
  {icon:'red',   iconT:'⚠', title:'HIGH // UAV Incursion',   desc:'Unidentified UAV tracked entering AOI-2 at 35.45°N, 35.20°E. Correlated with SIGINT burst.', sev:'high', time:'02:14', src:'SIGINT'},
  {icon:'amber', iconT:'◈', title:'Convoy Deviation',         desc:'A-127 convoy deviated 2.4 km from planned route near checkpoint 4. Speed reduced to 38 kt.',  sev:'med',  time:'01:47', src:'UAV-2'},
  {icon:'cyan',  iconT:'◉', title:'Signal Density Spike',     desc:'Radio traffic +12% above 7-day baseline in coastal sector. Possible coordination activity.',   sev:'med',  time:'01:02', src:'SIGINT'},
  {icon:'green', iconT:'✓', title:'Collection Complete',      desc:'SAT-7 pass complete. 14 new imagery products staged for analysis. Cloud cover 8%.',            sev:'low',  time:'00:38', src:'SAT-7'},
  {icon:'amber', iconT:'⚓', title:'Vessel Anomaly',           desc:'Unidentified contact holding position 12 nm offshore. No AIS transponder detected.',          sev:'med',  time:'00:11', src:'MARITIME'},
];

/* ---------- TIME SERIES DATA ---------- */
const HOURS        = ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'];
const SIGNAL       = [22,18,25,30,28,35,42,38,45,52,48,40];
const THREAT_INDEX = [8,6,9,12,10,15,18,16,22,25,20,17];
const MOVEMENT = {
  maritime: [12,10,14,16,15,18,20,22,19,17,15,13],
  convoy:   [4,3,5,6,8,9,11,12,10,9,7,6],
  air:      [2,3,2,4,5,6,7,8,7,6,5,4],
};

/* ---------- MAP INIT ---------- */
const map = L.map('map', {
  center: [35.05, 35.20],
  zoom: 8,
  zoomControl: true,
  attributionControl: true,
  minZoom: 3,
  maxZoom: 18,
});

/* Base layers */
const darkLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  subdomains: 'abc', maxZoom: 19, className: 'dark-tiles',
});
const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
  maxZoom: 19,
});
const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Style &copy; OpenTopoMap',
  maxZoom: 17,
});
const heatLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  subdomains: 'abc', maxZoom: 19, opacity: 0.4, className: 'dark-tiles',
});

const baseLayers = { dark: darkLayer, sat: satLayer, terrain: terrainLayer, heat: heatLayer };
darkLayer.addTo(map);

/* ---------- OVERLAY GROUPS ---------- */
const assetLayer  = L.layerGroup().addTo(map);
const threatLayer = L.layerGroup().addTo(map);
const zoneLayer   = L.layerGroup().addTo(map);
const routeLayer  = L.layerGroup().addTo(map);
const gridLayer   = L.layerGroup();

/* ---------- ICONS ---------- */
function makeIcon(color, glyph) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="width:26px;height:26px;border-radius:50%;background:rgba(10,14,20,0.9);border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:12px;color:${color};box-shadow:0 0 10px ${color}66;">${glyph}</div>`,
    iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -14],
  });
}

const iconFriendly   = makeIcon('#22d3ee', '▣');
const iconThreatHigh = makeIcon('#f87171', '⚠');
const iconThreatMed  = makeIcon('#fbbf24', '◈');
const iconThreatLow  = makeIcon('#34d399', '◉');

/* ---------- POPUP HELPER ---------- */
function popupHTML(title, rows) {
  let h = `<div class="p-title">${title}</div>`;
  rows.forEach(r => { h += `<div class="p-row"><span class="k">${r.k}</span><span class="v">${r.v}</span></div>`; });
  return h;
}

/* ---------- RENDER ASSETS ---------- */
function renderAssets() {
  assetLayer.clearLayers();
  ASSETS.forEach(a => {
    const color = a.status === 'online' ? '#22d3ee' : a.status === 'degraded' ? '#fbbf24' : '#f87171';
    const m = L.marker([a.lat, a.lng], { icon: makeIcon(color, a.icon) });
    m.bindPopup(popupHTML(a.name, [
      {k:'ID',     v:a.id},
      {k:'Type',   v:a.type},
      {k:'Status', v:a.status.toUpperCase()},
      {k:'Speed',  v:a.speed},
      {k:'Lat',    v:a.lat.toFixed(3)+'°'},
      {k:'Lng',    v:a.lng.toFixed(3)+'°'},
    ]));
    assetLayer.addLayer(m);
  });
  document.getElementById('stat-assets').textContent = ASSETS.length;
  document.getElementById('cnt-assets').textContent  = ASSETS.length;
}

/* ---------- RENDER THREATS ---------- */
function renderThreats() {
  threatLayer.clearLayers();
  THREATS.forEach(t => {
    const icon = t.sev === 'high' ? iconThreatHigh : t.sev === 'med' ? iconThreatMed : iconThreatLow;
    const m = L.marker([t.lat, t.lng], { icon });
    m.bindPopup(popupHTML(t.name, [
      {k:'ID',       v:t.id},
      {k:'Severity', v:t.sev.toUpperCase()},
      {k:'Type',     v:t.type},
      {k:'Detected', v:t.time},
      {k:'Lat',      v:t.lat.toFixed(3)+'°'},
      {k:'Lng',      v:t.lng.toFixed(3)+'°'},
    ]));
    threatLayer.addLayer(m);
  });
  document.getElementById('stat-threats').textContent = THREATS.length;
  document.getElementById('cnt-threats').textContent  = THREATS.length;
}

/* ---------- RENDER ZONES ---------- */
function renderZones() {
  zoneLayer.clearLayers();
  ZONES.forEach(z => {
    const c = L.circle([z.lat, z.lng], {
      radius: z.r * 111000, color: z.color, weight: 1.5,
      fillColor: z.color, fillOpacity: 0.08, dashArray: '6 4',
    });
    c.bindPopup(popupHTML(z.name, [{k:'Radius', v:(z.r*111).toFixed(1)+' km'}, {k:'Status', v:'ACTIVE'}]));
    zoneLayer.addLayer(c);

    const lbl = L.marker([z.lat, z.lng], {
      icon: L.divIcon({
        className: 'zone-label',
        html: `<div style="font-family:var(--mono);font-size:9px;color:${z.color};letter-spacing:1px;text-shadow:0 0 4px #000;">${z.name}</div>`,
        iconSize: [0, 0],
      }),
    });
    zoneLayer.addLayer(lbl);
  });
  document.getElementById('cnt-zones').textContent = ZONES.length;
}

/* ---------- RENDER ROUTES ---------- */
function renderRoutes() {
  routeLayer.clearLayers();
  ROUTES.forEach(r => {
    const line = L.polyline(r.pts, { color: r.color, weight: 2, opacity: 0.7, dashArray: '8 6' });
    line.bindPopup(popupHTML(r.name, [{k:'Length', v:(r.pts.length*8).toFixed(0)+' km'}, {k:'Status', v:'ACTIVE'}]));
    routeLayer.addLayer(line);
  });
  document.getElementById('cnt-routes').textContent = ROUTES.length;
}

/* ---------- MGRS GRID (simulated) ---------- */
function renderGrid() {
  gridLayer.clearLayers();
  for (let i = 0; i <= 4; i++) {
    const lat = 34.0 + i * 0.5;
    const lng = 34.5 + i * 0.5;
    gridLayer.addLayer(L.polyline([[lat, 34.5], [lat, 36.0]], {color:'#1c2a3a', weight:1, opacity:0.6}));
    gridLayer.addLayer(L.polyline([[34.0, lng], [36.0, lng]], {color:'#1c2a3a', weight:1, opacity:0.6}));
  }
}

/* ---------- LAYER SWITCHING ---------- */
const layerState = { base: 'dark', overlays: { assets:true, threats:true, zones:true, routes:true, grid:false } };

function setBaseLayer(name) {
  Object.values(baseLayers).forEach(l => map.removeLayer(l));
  if (name === 'heat') {
    heatLayer.addTo(map);
    darkLayer.addTo(map);
  } else {
    baseLayers[name].addTo(map);
  }
  layerState.base = name;
  document.querySelectorAll('.layer-item[data-layer]').forEach(el => {
    el.classList.toggle('active', el.dataset.layer === name);
  });
}

document.querySelectorAll('.layer-item[data-layer]').forEach(el => {
  el.addEventListener('click', () => setBaseLayer(el.dataset.layer));
});

/* ---------- OVERLAY TOGGLES ---------- */
const overlayGroups = {
  assets: assetLayer, threats: threatLayer,
  zones:  zoneLayer,  routes:  routeLayer,
  grid:   gridLayer,
};

document.querySelectorAll('.overlay-item[data-overlay]').forEach(el => {
  el.addEventListener('click', () => {
    const key = el.dataset.overlay;
    const on  = !el.classList.contains('on');
    el.classList.toggle('on', on);
    layerState.overlays[key] = on;
    if (on) { overlayGroups[key].addTo(map); } else { map.removeLayer(overlayGroups[key]); }
  });
});

/* ---------- MAP HUD ---------- */
map.on('mousemove', e => {
  document.getElementById('coord-lat').textContent = e.latlng.lat.toFixed(3) + '°N';
  document.getElementById('coord-lng').textContent = e.latlng.lng.toFixed(3) + '°E';
});

map.on('zoomend', () => {
  document.getElementById('hud-zoom').textContent  = map.getZoom();
  document.getElementById('hud-scale').textContent =
    map.getZoom() >= 8 ? '1:50K' : map.getZoom() >= 6 ? '1:250K' : '1:1M';
});

/* ---------- TOOLBAR ACTIONS ---------- */
let measuring = false;

document.getElementById('btn-measure').addEventListener('click', () => {
  measuring = !measuring;
  const btn = document.getElementById('btn-measure');
  btn.classList.toggle('primary', measuring);
  btn.textContent = measuring ? '⤢ Measuring…' : '⤢ Measure';
  if (measuring) alert('Measure mode: click two points on the map to draw a line. (Demo)');
});

document.getElementById('btn-export').addEventListener('click', () => {
  alert('Exporting current view as GEOINT report (demo).');
});

document.getElementById('btn-reset').addEventListener('click', () => {
  map.setView([35.05, 35.20], 8);
  setBaseLayer('dark');
  document.querySelectorAll('.overlay-item').forEach(el => {
    const key = el.dataset.overlay;
    if (key === 'grid') {
      el.classList.remove('on');
      map.removeLayer(gridLayer);
      layerState.overlays.grid = false;
    } else {
      el.classList.add('on');
      overlayGroups[key].addTo(map);
      layerState.overlays[key] = true;
    }
  });
});

/* ---------- CHARTS ---------- */
Chart.defaults.color       = '#5d7f94';
Chart.defaults.font.family = "'JetBrains Mono','Consolas',monospace";
Chart.defaults.font.size   = 10;

const signalChart = new Chart(document.getElementById('chart-signal'), {
  type: 'line',
  data: {
    labels: HOURS,
    datasets: [
      {label:'Signal Activity', data:SIGNAL,       borderColor:'#22d3ee', backgroundColor:'rgba(34,211,238,0.08)',  fill:true, tension:0.35, pointRadius:0, borderWidth:2},
      {label:'Threat Index',    data:THREAT_INDEX, borderColor:'#f87171', backgroundColor:'rgba(248,113,113,0.06)', fill:true, tension:0.35, pointRadius:0, borderWidth:2},
    ],
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor:'#0e141d', borderColor:'#24364a', borderWidth:1, titleColor:'#e6f1f8', bodyColor:'#c7d6e3' },
    },
    scales: {
      x: { grid: {color:'rgba(28,42,58,0.4)'}, ticks: {maxTicksLimit:6} },
      y: { grid: {color:'rgba(28,42,58,0.4)'}, beginAtZero: true },
    },
  },
});

const movementChart = new Chart(document.getElementById('chart-movement'), {
  type: 'bar',
  data: {
    labels: HOURS,
    datasets: [
      {label:'Maritime', data:MOVEMENT.maritime, backgroundColor:'rgba(52,211,153,0.6)',  borderColor:'#34d399', borderWidth:1, borderRadius:2},
      {label:'Convoy',   data:MOVEMENT.convoy,   backgroundColor:'rgba(251,191,36,0.6)',  borderColor:'#fbbf24', borderWidth:1, borderRadius:2},
      {label:'Air',      data:MOVEMENT.air,      backgroundColor:'rgba(167,139,250,0.6)', borderColor:'#a78bfa', borderWidth:1, borderRadius:2},
    ],
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend:  { display: false },
      tooltip: { backgroundColor:'#0e141d', borderColor:'#24364a', borderWidth:1 },
    },
    scales: {
      x: { stacked: true, grid: {color:'rgba(28,42,58,0.4)'}, ticks: {maxTicksLimit:6} },
      y: { stacked: true, grid: {color:'rgba(28,42,58,0.4)'}, beginAtZero: true },
    },
  },
});

/* ---------- INTEL FEED ---------- */
function renderFeed() {
  const feed = document.getElementById('intel-feed');
  feed.innerHTML = FEED.map(f => `
    <div class="feed-item">
      <div class="f-icon ${f.icon}">${f.iconT}</div>
      <div class="f-body">
        <div class="f-title">${f.title}</div>
        <div class="f-desc">${f.desc}</div>
        <div class="f-meta"><span class="sev ${f.sev}">${f.sev.toUpperCase()}</span><span>${f.time} UTC</span><span>${f.src}</span></div>
      </div>
    </div>`).join('');
}

/* ---------- ASSET TABLE ---------- */
function renderAssetTable() {
  const tbody = document.getElementById('asset-tbody');
  tbody.innerHTML = ASSETS.map(a => `
    <tr>
      <td class="id">${a.id}</td>
      <td>${a.type}</td>
      <td><span class="status"><span class="dot ${a.status}"></span>${a.status}</span></td>
      <td>${a.speed}</td>
    </tr>`).join('');
}

/* ---------- CLOCKS ---------- */
function tick() {
  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  document.getElementById('clock').textContent     = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
  document.getElementById('utc-clock').textContent = `${p(now.getUTCHours())}:${p(now.getUTCMinutes())}:${p(now.getUTCSeconds())}`;
}
setInterval(tick, 1000);
tick();

/* ---------- INIT ---------- */
renderAssets();
renderThreats();
renderZones();
renderRoutes();
renderGrid();
renderFeed();
renderAssetTable();
document.getElementById('stat-sig').textContent = SIGNAL.reduce((a, b) => a + b, 0);
