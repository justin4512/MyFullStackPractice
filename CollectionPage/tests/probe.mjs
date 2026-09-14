/** 瀏覽器端手動探針：供開發期在 console 驗證 deck 行為，不參與自動化測試。 */
export async function probe() {
  const $ = (s) => document.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const st = () => ({
    計數: $('[data-deck-counter]').textContent,
    url: location.search,
    當前點: [...document.querySelectorAll('.dot')].findIndex((d) => d.getAttribute('aria-current') === 'true') + 1,
    掛載: [...document.querySelectorAll('[data-embed-frame]')].map((f) => f.dataset.embedState),
    live: $('[data-deck-live]').textContent.slice(0, 20),
  });
  const out = { 初始: st() };

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await wait(800); out.按下箭頭 = st();

  document.querySelectorAll('.dot')[2].click();
  await wait(1000); out.跳至嵌入頁 = st();

  const f = $('[data-embed-frame] iframe');
  out.iframe = { 有src: !!f?.getAttribute('src'), tabindex: f?.getAttribute('tabindex'), ariaHidden: f?.getAttribute('aria-hidden') };

  $('[data-embed-enter]')?.click(); await wait(200);
  out.進入後 = { tabindex: f?.getAttribute('tabindex'), ariaHidden: f?.getAttribute('aria-hidden'),
                entered: $('[data-embed-frame]')?.dataset.embedEntered,
                焦點在iframe: document.activeElement === f };

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(200);
  out.Esc離開後 = { tabindex: f?.getAttribute('tabindex'), entered: $('[data-embed-frame]')?.dataset.embedEntered,
                   焦點回按鈕: document.activeElement === $('[data-embed-enter]') };

  document.querySelectorAll('.dot')[6].click(); await wait(1000);
  out.跳至末頁 = st();
  out.末頁時嵌入已卸載 = [...document.querySelectorAll('[data-embed-frame]')].map((x) => x.dataset.embedState);
  return out;
}
