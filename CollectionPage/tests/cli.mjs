/** Node CLI 測試進入點。Node.js 到位後執行 `npm test` 即可；瀏覽器版見 tests/index.html。 */
import { run, formatReport } from './run.mjs';

const report = await run();
console.log(formatReport(report));
process.exit(report.failed === 0 ? 0 : 1);
