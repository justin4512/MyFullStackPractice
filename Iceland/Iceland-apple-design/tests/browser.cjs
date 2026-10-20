const {chromium}=require('/Users/justinadmin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
for(const width of [320,390,900,1440]){
 await p.setViewportSize({width,height:844});await p.goto('http://127.0.0.1:8765/Iceland-apple-design/',{waitUntil:'networkidle',timeout:60000});
 await p.waitForSelector('.dtab');
 assert.equal(await p.locator('.dtab').count(),15);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.selectOption('#theme-preference','dark');await p.waitForTimeout(350);await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.dtab');assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');
 if(width===390){await p.locator('#sheet-grip').click();await p.waitForTimeout(700);assert.equal(await p.locator('#panel').getAttribute('data-sheet'),'half');await p.screenshot({path:'/private/tmp/iceland-mobile.png'});}
 if(width===1440)await p.screenshot({path:'/private/tmp/iceland-desktop.png'});
 console.log('PASS viewport',width,'date/theme/layout');
}
assert.deepEqual(errors,[]);await b.close();})().catch(e=>{console.error(e);process.exit(1)});
