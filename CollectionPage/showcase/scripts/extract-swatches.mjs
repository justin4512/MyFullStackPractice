// 從每張作品截圖取樣代表色 → src/data/swatches.json
// 牆面沒有全站強調色，色票全部來自作品本身。
// 用法：先啟動 showcase 開發伺服器（launch.json 的 showcase，預設 5173），再執行 node scripts/extract-swatches.mjs
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME_PATH
  ?? `${homedir()}/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-x64/chrome-headless-shell`;
const PORT = 9335;

const root = new URL('..', import.meta.url);
const works = JSON.parse(await readFile(new URL('src/data/works.json', root), 'utf8'));
const ids = works.map((work) => work.id);

const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, '--headless', '--no-first-run', 'about:blank'], { stdio: 'ignore' });

try {
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    try {
      page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
    } catch { /* 尚未就緒 */ }
    if (!page) await sleep(200);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg.result ?? {});   // 回傳 CDP payload，Runtime.evaluate 為 { result, exceptionDetails }
    }
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    pending.set(++id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Page.navigate', { url: APP_URL });   // 與 /thumbs 同源，canvas 才讀得到像素
  await sleep(2500);

  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: `(${sampleAll.toString()})(${JSON.stringify(ids)})`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? '取樣失敗');

  const sampled = result?.value;
  if (!sampled || Object.keys(sampled).length === 0) {
    throw new Error('取樣結果是空的：確認 showcase 開發伺服器已啟動，且 public/thumbs 內有截圖');
  }
  await writeFile(new URL('src/data/swatches.json', root), `${JSON.stringify(sampled, null, 2)}\n`);
  console.log(Object.entries(sampled).map(([k, v]) => `${k.padEnd(22)} ${v}`).join('\n'));
  ws.close();
} finally {
  chrome.kill();
}

/** 在頁面內執行：取每張截圖佔面積大又有彩度的顏色，並把明度壓進可辨識區間 */
function sampleAll(ids) {
  const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

  function clampLightness(r, g, b) {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    const target = Math.min(Math.max(l, 0.22), 0.55);   // 太亮看不見、太暗全部變黑
    if (target === l || l === 0) return [r, g, b];
    const k = target / l;
    return [r, g, b].map((v) => Math.min(255, v * k));
  }

  return Promise.all(ids.map(async (id) => {
    const img = new Image();
    img.src = `/thumbs/${id}.jpg`;
    await img.decode();
    const width = 72;
    const height = Math.max(1, Math.round((width * img.naturalHeight) / img.naturalWidth));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (lum > 0.93 || lum < 0.05) continue;          // 純白背景與純黑不算
      const key = `${r >> 4}|${g >> 4}|${b >> 4}`;
      const entry = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, sat: 0 };
      entry.n += 1; entry.r += r; entry.g += g; entry.b += b; entry.sat += sat;
      buckets.set(key, entry);
    }

    // 先排除接近中性灰的色塊：截圖多半是白底灰字，純看面積會每張都選到灰色
    const total = width * height || 1;
    const colourful = [...buckets.values()].filter((e) => e.sat / e.n >= 0.22 && e.n / total >= 0.004);
    const pool = colourful.length > 0 ? colourful : [...buckets.values()];

    let best = null;
    let bestScore = -1;
    for (const entry of pool) {
      const sat = entry.sat / entry.n;
      const score = entry.n * sat ** 1.5;   // 彩度優先、面積其次
      if (score > bestScore) { bestScore = score; best = entry; }
    }
    if (!best) return [id, '#56607A'];
    const [r, g, b] = clampLightness(best.r / best.n, best.g / best.n, best.b / best.n);
    return [id, toHex(r, g, b)];
  })).then((pairs) => Object.fromEntries(pairs));
}
