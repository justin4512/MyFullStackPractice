// Run: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/profile-site.test.mjs
// Serve the project on http://127.0.0.1:8765 first; override with PROFILE_TEST_URL.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PROFILE_TEST_URL || 'http://127.0.0.1:8765';
const browser = await chromium.launch({ headless: true, ...(process.env.PROFILE_CHROME ? { executablePath: process.env.PROFILE_CHROME } : {}) });
const output = new URL('../artifacts/profile/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(base + '/', { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, 'The resume homepage must be available');
  assert.equal(await page.locator('body.profile-site').count(), 1, 'The resume must render, not a directory listing');
  await page.screenshot({ path: `${output}home-desktop-fold.png`, fullPage: false });
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('[data-slide]:visible').count(), 1);
  const first = await page.locator('[data-slide]:visible').getAttribute('id');
  await page.getByRole('button', { name: '下一個故事', exact: true }).click();
  assert.notEqual(await page.locator('[data-slide]:visible').getAttribute('id'), first);
  await page.getByRole('button', { name: '上一個故事', exact: true }).click();
  assert.equal(await page.locator('[data-slide]:visible').getAttribute('id'), first);
  await page.getByRole('button', { name: '上一個故事', exact: true }).click();
  assert.equal(await page.locator('[data-slide]:visible').getAttribute('id'), 'story-automation');
  await page.getByRole('button', { name: '內網 AI 故事', exact: true }).click();
  const storyLink = page.locator('[data-slide]:visible a').first();
  await storyLink.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-slide]:visible').getAttribute('id'), 'story-ai', 'Arrow keys on the story link do not hide the focused link');
  assert.equal(await storyLink.evaluate(el => el === document.activeElement), true);
  await page.locator('[data-slider]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-slide]:visible').getAttribute('id'), 'story-geo');
  for (const width of [375, 768, 992, 1200, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `No horizontal overflow at ${width}`);
    const coverRatio = await page.locator('.pf-project-media img').first().evaluate(el => el.clientWidth / el.clientHeight);
    assert.ok(Math.abs(coverRatio - 1.6) < .02, `Project covers retain their 16:10 ratio at ${width}`);
    if ([375, 768, 1440].includes(width)) {
      await page.locator('body').click({ position: { x: width - 3, y: 2 } });
      await page.screenshot({ path: `${output}home-${width}.png`, fullPage: true });
      await page.screenshot({ path: `${output}home-${width}-fold.png`, fullPage: false });
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  const menu = page.getByRole('button', { name: '開啟導覽選單', exact: true });
  await menu.click();
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(await menu.evaluate(el => el === document.activeElement), true);
  const routes = ['/projects/', '/projects/clinic-scheduling/', '/projects/iceland-map/', '/cases/private-ai/', '/cases/geospatial-platform/', '/cases/workflow-automation/', '/notes/', '/notes/equivalent-work-hours/'];
  for (const route of routes) {
    const res = await page.goto(base + route, { waitUntil: 'networkidle' });
    assert.equal(res.status(), 200, route);
    assert.equal(await page.locator('h1').count(), 1, route + ' has one heading');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), route + ' fits mobile');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/projects/clinic-scheduling/');
  await page.screenshot({ path: `${output}case-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}case-mobile.png`, fullPage: true });
  await page.goto(base + '/projects/');
  await page.getByRole('button', { name: '營運工具', exact: true }).click();
  assert.equal(await page.locator('[data-project]:visible').count(), 1);
  assert.match(await page.locator('[data-project]:visible').innerText(), /宏甫/);
  await page.getByRole('button', { name: '全部作品', exact: true }).click();
  assert.equal(await page.locator('[data-project]:visible').count(), 2);
  for (const href of await page.locator('a[target="_blank"]').evaluateAll(links => links.map(a => ({ href: a.href, rel: a.rel })))) assert.match(href.rel, /noopener/);
  const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const plain = await nojs.newPage();
  await plain.goto(base + '/');
  assert.equal(await plain.locator('[data-slide]:visible').count(), 3, 'All stories remain readable without JavaScript');
  assert.equal(await plain.locator('#profile-navigation').isVisible(), true, 'Navigation remains usable without JavaScript');
  await nojs.close();
  const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const quiet = await reduced.newPage();
  await quiet.goto(base + '/');
  const bounds = await quiet.locator('[data-slider]').boundingBox();
  const touch = await reduced.newCDPSession(quiet);
  const startX = bounds.x + bounds.width * .8;
  const endX = bounds.x + bounds.width * .2;
  const y = bounds.y + 130;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: endX, y }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await quiet.locator('[data-slide]:visible').getAttribute('id'), 'story-geo', 'Horizontal touch swipe advances the story');
  await quiet.goto(base + '/projects/');
  assert.equal(await quiet.locator('.pf-project-overlay').first().evaluate(el => getComputedStyle(el).transform), 'none');
  await reduced.close();
  await page.goto(new URL('../index.html', import.meta.url).href);
  assert.equal(await page.locator('[data-slide]:visible').count(), 1, 'The static site also works directly from file://');
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('PASS: carousel, keyboard, mobile navigation, responsive layout, routes, filtering, no-JS, reduced motion.');
} finally { await browser.close(); }
