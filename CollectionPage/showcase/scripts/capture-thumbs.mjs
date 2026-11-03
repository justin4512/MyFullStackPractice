// 擷取作品截圖 → public/thumbs/<id>.jpg，尺寸寫入 src/data/thumbs.json
// 每件作品的「其他版本」也一併擷取，檔名為 <id>__<n>.jpg（開場的多版本比較會用到）
// 用法：先啟動 repo 根目錄的靜態伺服器（launch.json 的 repo-root，預設 8330），再執行 npm run thumbs
// 可用環境變數：WORKS_BASE（作品網址前綴）、CHROME_PATH（headless Chromium 路徑）
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const WORKS_BASE = process.env.WORKS_BASE ?? 'http://127.0.0.1:8330/';
const CHROME_PATH = process.env.CHROME_PATH
  ?? `${homedir()}/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-x64/chrome-headless-shell`;
const PORT = 9333;
const VIEWPORT = { width: 1280, height: 800 };
const MAX_HEIGHT = 3200;   // 超長頁面只取前段，預覽捲動距離才不會失控
const SCALE = 0.5;         // 輸出 640px 寬

const root = new URL('..', import.meta.url);
const works = JSON.parse(await readFile(new URL('src/data/works.json', root), 'utf8'));
await mkdir(new URL('public/thumbs/', root), { recursive: true });

/** 主版本用作品 id，其他版本用 id__1、id__2… */
const shots = works.flatMap((work) => {
  const rest = (work.versions ?? []).filter((version) => version.path !== work.path);
  return [
    { id: work.id, path: work.path },
    ...rest.map((version, index) => ({ id: `${work.id}__${index + 1}`, path: version.path })),
  ];
});

const chrome = spawn(CHROME_PATH, [
  `--remote-debugging-port=${PORT}`, '--headless', '--hide-scrollbars', '--no-first-run',
  '--mute-audio', 'about:blank',
], { stdio: 'ignore' });

try {
  const target = await waitForTarget();
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });

  const sizes = {};
  for (const shot of shots) {
    const url = new URL(shot.path, WORKS_BASE).href;
    const loaded = cdp.once('Page.loadEventFired', 20000);
    await cdp.send('Page.navigate', { url });
    await loaded.catch(() => console.warn(`⚠️  ${shot.id} 載入逾時，仍嘗試擷取`));
    await sleep(1500); // 等字型與進場動畫落定

    const { result } = await cdp.send('Runtime.evaluate', {
      expression: 'Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)',
      returnByValue: true,
    });
    const height = Math.min(Math.max(result.value ?? VIEWPORT.height, VIEWPORT.height), MAX_HEIGHT);
    const image = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg', quality: 72, captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: VIEWPORT.width, height, scale: SCALE },
    });
    await writeFile(new URL(`public/thumbs/${shot.id}.jpg`, root), Buffer.from(image.data, 'base64'));
    sizes[shot.id] = { width: Math.round(VIEWPORT.width * SCALE), height: Math.round(height * SCALE) };
    console.log(`✅ ${shot.id}  ${sizes[shot.id].width}×${sizes[shot.id].height}`);
  }

  await writeFile(new URL('src/data/thumbs.json', root), `${JSON.stringify(sizes, null, 2)}\n`);
  cdp.close();
} finally {
  chrome.kill();
}

async function waitForTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* Chromium 尚未就緒 */ }
    await sleep(200);
  }
  throw new Error('無法連上 headless Chromium 的除錯埠');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { ok, fail } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
      } else if (msg.method && listeners.has(msg.method)) {
        listeners.get(msg.method).forEach((fn) => fn(msg.params));
      }
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({
      send: (method, params = {}) => new Promise((ok, fail) => {
        const id = ++nextId;
        pending.set(id, { ok, fail });
        ws.send(JSON.stringify({ id, method, params }));
      }),
      once: (method, timeoutMs) => new Promise((ok, fail) => {
        const timer = setTimeout(() => fail(new Error(`${method} timeout`)), timeoutMs);
        const fn = (params) => {
          clearTimeout(timer);
          listeners.set(method, (listeners.get(method) ?? []).filter((f) => f !== fn));
          ok(params);
        };
        listeners.set(method, [...(listeners.get(method) ?? []), fn]);
      }),
      close: () => ws.close(),
    }));
  });
}
