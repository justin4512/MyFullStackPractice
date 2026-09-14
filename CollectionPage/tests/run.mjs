/**
 * 測試進入點 —— 同時供瀏覽器 runner 與（Node.js 到位後的）CLI 使用。
 * 匯入各測試檔以註冊套件，再由 harness 執行。
 */
import './unit/store.test.mjs';
import './unit/transition.test.mjs';
import './unit/router-view.test.mjs';
import './unit/folio.test.mjs';
import './unit/tokens-css.test.mjs';
import './unit/deck.test.mjs';

export { run, formatReport } from './harness.mjs';
