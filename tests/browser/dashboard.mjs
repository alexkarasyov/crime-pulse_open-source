// Repeatable real-Chrome QA of the production build. See tests/browser/README.md.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import puppeteer from 'puppeteer-core';
import { AxePuppeteer } from '@axe-core/puppeteer';
import { projectRoot, startPreview } from './server.mjs';

const output = resolve(projectRoot, 'test-results/browser');
const results = { started: new Date().toISOString(), checks: [], accessibility: [], errors: [], payloads: [] };
const pause = ms => new Promise(done => setTimeout(done, ms));
const categories = ['assault', 'autoTheft', 'breakEnter', 'robbery', 'theftOver'];
const aggregate = async name => JSON.parse(await readFile(resolve(projectRoot, `dist/data/aggregates/${name}.json`), 'utf8'));
const annual = (await aggregate('by-neighbourhood-year')).neighbourhoods;
const monthly = (await aggregate('by-neighbourhood-month')).neighbourhoods;
const executablePath = [process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
].find(path => path && existsSync(path));
assert(executablePath, 'Chrome/Chromium was not found. Install Chrome or set CHROME_PATH to its executable. See tests/browser/README.md.');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(resolve(tmpdir(), 'crime-pulse-browser-'));
let preview;
let browser;
const save = () => writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
async function check(name, fn, page) {
  try { const detail = await fn(); results.checks.push({ name, pass: true, detail }); console.log(`PASS ${name}`); }
  catch (error) {
    results.checks.push({ name, pass: false, error: error.stack }); console.error(`FAIL ${name}: ${error.message}`);
    if (page && !page.isClosed()) await page.screenshot({ path: resolve(output, `failure-${results.checks.length}.png`), fullPage: true }).catch(() => {});
  }
  await save();
}
async function clickText(page, selector, text, exact = true) {
  const handle = await page.evaluateHandle((selector, text, exact) => [...document.querySelectorAll(selector)].find(el => exact ? el.textContent.trim() === text : el.textContent.includes(text)), selector, text, exact);
  const element = handle.asElement(); assert(element, `Missing ${selector}: ${text}`);
  await bringIntoView(element); await element.click(); await handle.dispose(); await pause(80);
}
async function bringIntoView(element) {
  await element.evaluate(el => el.scrollIntoView({behavior:'instant',block:'center',inline:'nearest'}));
  await pause(250); // Allow sticky controls and layout transitions to settle.
}
async function click(page, selector) {
  const element = await page.$(selector); assert(element, `Missing ${selector}`);
  await bringIntoView(element); await element.click(); await pause(100);
}
async function loaded(page) {
  // Visible islands hydrate when scrolled into view; do not mistake SSR for working controls.
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 650) { scrollTo(0,y); await new Promise(done => setTimeout(done, 20)); } scrollTo(0,0); });
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client]')].every(el => !el.hasAttribute('ssr')));
  await page.waitForNetworkIdle({ idleTime: 150, timeout: 10000 });
}
async function noOverflow(page) {
  // Mobile Chrome expands innerWidth on overflow. Compare against the requested
  // viewport, otherwise a widened page can falsely appear to fit itself.
  const size = await page.evaluate(width => ({ viewport: width, content: document.documentElement.scrollWidth }), page.viewport().width);
  assert(size.content <= size.viewport + 1, JSON.stringify(size)); return size;
}
async function scan(page, name) {
  const report = await new AxePuppeteer(page).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  results.accessibility.push({ name, violations: report.violations, incomplete: report.incomplete.map(v => ({id:v.id, count:v.nodes.length})) });
  assert.deepEqual(report.violations.map(v => ({ id:v.id, targets:v.nodes.map(n=>n.target) })), []);
}
async function createPage(name, viewport) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport); page.setDefaultTimeout(10000);
  const resources = new Map(); const pending = []; let capture = true;
  page.on('pageerror', error => results.errors.push({name, kind:'pageerror', message:error.message}));
  page.on('console', message => { if (message.type() === 'error') results.errors.push({name, kind:'console', message:message.text()}); });
  page.on('requestfailed', request => results.errors.push({name, kind:'request', url:request.url(), message:request.failure()?.errorText}));
  page.on('response', response => {
    if (!response.url().startsWith(preview.url)) return;
    if (response.status() >= 400) results.errors.push({name, kind:'http', status:response.status(), url:response.url()});
    if (capture && response.status() === 200) pending.push(response.buffer().then(body => resources.set(response.url(), gzipSync(body).length)).catch(error => results.errors.push({name,kind:'payload',message:error.message})));
  });
  // Third-party tile availability must not make local regression checks intermittent.
  // Leaflet and all 158 real polygons still load and receive real pointer clicks.
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/^https:\/\/[^/]+\.basemaps\.cartocdn\.com\//.test(request.url()) && process.env.QA_LIVE_TILES !== '1') {
      void request.respond({status:200, contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e6edf2"/></svg>'});
    } else void request.continue();
  });
  // Exercise Copy view without requiring OS clipboard permissions or touching its contents.
  await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{writeText:async value => { Reflect.set(window, '__qaClipboard', value); }}}); });
  return {page, context, payload: async () => { capture = false; await Promise.all(pending); return [...resources].map(([url,bytes])=>({path:new URL(url).pathname,gzipBytes:bytes})); }};
}
async function openTables(page) {
  const summaries = await page.$$('details.chart-data > summary'); assert(summaries.length > 0);
  for (const summary of summaries) { await bringIntoView(summary); await summary.click(); await pause(100); }
  assert.equal(await page.$$eval('details.chart-data[open]', els=>els.length), summaries.length);
}
async function mapClick(page) {
  await page.$eval('.map-canvas', element=>element.scrollIntoView({behavior:'instant',block:'center'}));
  await pause(300);
  const point = await page.evaluate(() => {
    const bounds = document.querySelector('.map-canvas').getBoundingClientRect();
    for (let y = Math.max(1,bounds.top + 20); y < Math.min(innerHeight,bounds.bottom)-10; y += 8) {
      for (let x = bounds.left + 10; x < bounds.right-10; x += 8) {
        if (document.elementFromPoint(x,y)?.matches('path.leaflet-interactive')) return {x,y};
      }
    }
  });
  assert(point, 'No unobscured map polygon under pointer');
  await Promise.all([page.waitForNavigation({waitUntil:'load'}), page.mouse.click(point.x, point.y)]);
  assert.match(new URL(page.url()).pathname, /^\/neighbourhood\/\d+\/$/);
}

async function surface(mode, viewport, route, label) {
  const name = `${mode}/${label}`;
  const {page, context, payload} = await createPage(name, viewport);
  const test = (title, fn) => check(`${name}: ${title}`, fn, page);
  try {
    const response = await page.goto(preview.url + route, {waitUntil:'load'}); assert.equal(response.status(),200); await loaded(page);
    await test('production headers, navigation, initial payload', async () => {
      assert.match(response.headers()['content-security-policy'], /object-src 'none'/);
      assert.equal(response.headers()['x-content-type-options'], 'nosniff');
      assert(await page.evaluate(() => ['/','/neighbourhood/','/compare/','/about/'].every(href=>document.querySelector(`nav[aria-label="Primary"] a[href="${href}"]`))));
      const resources = await payload(); const gzipBytes = resources.reduce((sum,r)=>sum+r.gzipBytes,0);
      results.payloads.push({name,gzipBytes,resources});
      // Total first-party, compressed, fully scrolled initial view; excludes map tiles.
      assert(gzipBytes < 1024 * 1024, `${gzipBytes} bytes exceeds the 1 MiB per-route budget`);
      return {gzipBytes};
    });
    await test('counts default and responsive layout', async () => {
      assert(await page.evaluate(()=>[...document.querySelectorAll('.seg-btn')].some(el=>el.textContent.trim()==='Counts'&&el.getAttribute('aria-pressed')==='true')));
      return noOverflow(page);
    });
    if (label !== 'about') await test('unit toggle round trip', async () => {
      await clickText(page,'.seg-btn','Rate / 10K');
      assert(await page.evaluate(()=>[...document.querySelectorAll('.seg-btn')].some(el=>el.textContent.includes('Rate')&&el.getAttribute('aria-pressed')==='true')));
      await noOverflow(page); await clickText(page,'.seg-btn','Counts');
    });
    if (label === 'overview' || label === 'detail' || label === 'compare') await test('chart data disclosures open by keyboard', async () => {
      const summary = await page.$('details.chart-data > summary'); assert(summary);
      await summary.focus(); await page.keyboard.press('Enter');
      assert(await page.$eval('details.chart-data',el=>el.open));
      assert(await page.$eval('details.chart-data caption',el=>el.textContent.includes('incident counts')));
      await page.keyboard.press('Enter'); await openTables(page); await noOverflow(page);
      if (mode === 'mobile' && label !== 'overview') {
        const handle = await page.evaluateHandle(()=>[...document.querySelectorAll('.chart-data-scroll')].find(el=>el.scrollWidth>el.clientWidth));
        const table = handle.asElement(); assert(table, 'Expected a horizontally scrollable data table');
        await bringIntoView(table); await table.focus(); await page.keyboard.press('ArrowRight');
        await page.waitForFunction(()=>document.activeElement.scrollLeft>0);
        await handle.dispose();
      }
    });
    for (const theme of ['dark','light']) await test(`${theme} accessibility and layout`, async () => {
      if (await page.$eval('html',el=>el.dataset.theme) !== theme) await click(page, '[aria-label="Switch light / dark theme"]');
      await pause(250); // Contrast must be measured after theme transitions.
      assert.equal(await page.$eval('html',el=>el.dataset.theme),theme);
      await noOverflow(page); await scan(page,`${name}/${theme}`);
    });
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'})); await pause(250);
    await page.screenshot({path:resolve(output,`${mode}-${label}.png`),fullPage:true});

    if (label === 'compare') {
      await test('count baseline default, scale, rates and shared preference', async () => {
        assert.equal(await page.$eval('.compare-trend-chart',el=>el.dataset.baselineVisible),'false');
        assert.equal(await page.$$eval('.compare-trend-chart [data-series="toronto"]',els=>els.length),0);
        const before = await page.$eval('.compare-trend-chart [data-series="87"]',el=>el.getAttribute('d'));
        await click(page, '.compare-baseline-control input');
        assert.notEqual(await page.$eval('.compare-trend-chart [data-series="87"]',el=>el.getAttribute('d')),before);
        assert.equal(await page.$$eval('.chart-data thead th',els=>els.filter(el=>el.textContent.includes('Toronto-wide')).length),1);
        await clickText(page,'.seg-btn','Rate / 10K'); assert(await page.$eval('.compare-baseline-control input',el=>el.checked));
        await click(page, '.compare-baseline-control input');
        await clickText(page,'.seg-btn','Counts'); assert(await page.$eval('.compare-baseline-control input',el=>el.checked));
        await click(page, '[aria-label="Copy a shareable link to this view"]');
        const copied = await page.evaluate(()=>Reflect.get(window, '__qaClipboard')); assert.equal(new URL(copied).searchParams.get('cb'),'10');
        await page.goto(copied,{waitUntil:'load'}); await loaded(page);
        assert(await page.$eval('.compare-baseline-control input',el=>el.checked));
        await clickText(page,'.seg-btn','Rate / 10K'); assert.equal(await page.$eval('.compare-baseline-control input',el=>el.checked),false);
        await clickText(page,'.seg-btn','Counts'); await click(page, '.compare-baseline-control input');
      });
      await test('table values reconcile with built series', async () => {
        const rows = await page.$$eval('.chart-data:first-of-type tbody tr',els=>els.map(el=>[...el.children].map(cell=>cell.textContent.trim())));
        const row = rows.find(cells=>cells[0]==='2016'); assert(row);
        assert.equal(Number(row[1].replaceAll(',','')),annual['87'].series.assault.find(p=>p.year===2016).count);
      });
      await test('add, swap and remove Compare slots', async () => {
        assert.deepEqual(await page.$$eval('.compare-picker-select select',els=>els.map(el=>el.value)),['87','73','143']);
        await clickText(page,'.compare-picker.add','+ Add a neighbourhood'); await page.waitForFunction(()=>document.querySelectorAll('.compare-picker-select select').length===4);
        await page.select('[aria-label="Pick neighbourhood for slot 1"]','73');
        const ids = await page.$$eval('.compare-picker-select select',els=>els.map(el=>el.value)); assert.equal(ids[0],'73'); assert.equal(new Set(ids).size,4);
        await click(page, '[aria-label="Remove slot 4"]'); await page.waitForFunction(()=>document.querySelectorAll('.compare-picker-select select').length===3); await click(page, '[aria-label="Remove slot 3"]'); await page.waitForFunction(()=>document.querySelectorAll('.compare-picker-select select').length===2);
        assert.equal((await page.$$('.compare-picker-select select')).length,2); assert.equal((await page.$$('[aria-label^="Remove slot"]')).length,0);
      });
      await test('category remains in scope after reload', async () => {
        await page.goto(preview.url+'/compare/?c=ro&p=ro',{waitUntil:'load'}); await loaded(page);
        await clickText(page,'.filter-chip','Assault'); await page.reload({waitUntil:'load'}); await loaded(page);
        assert.match(await page.$eval('.compare-trend-chart',el=>el.getAttribute('aria-label')),/assault/i);
        assert(new URL(page.url()).searchParams.get('c').split(',').includes('as'));
      });
    }
    if (label === 'index') {
      await test('single/all category controls reconcile with source totals', async () => {
        await page.type('[aria-label="Search neighbourhoods by name"]','Moss Park');
        assert.equal((await page.$$('.nbhd-index-row')).length,1);
        const value = async () => Number((await page.$eval('.nbhd-index-row',el=>el.children[3].textContent)).replaceAll(',',''));
        assert.equal(await value(),categories.reduce((sum,c)=>sum+annual['73'].series[c].find(p=>p.year===2025).count,0));
        await click(page, '[aria-label="Show only Assault"]'); assert.equal(await value(),annual['73'].series.assault.find(p=>p.year===2025).count);
        await click(page, '[aria-label="Show all five categories"]'); assert(await page.$eval('body',el=>el.textContent.includes('5 CATEGORIES SUMMED')));
      });
      await test('search empty state and population sort', async () => {
        await page.type('[aria-label="Search neighbourhoods by name"]','zzzz'); assert.equal((await page.$$('.nbhd-index-row')).length,0);
        assert(await page.$eval('.nbhd-index-table',el=>el.textContent.includes('No neighbourhoods match')));
        await page.$eval('[aria-label="Search neighbourhoods by name"]',el=>{el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));});
        await clickText(page,'.sort-button','Population',false);
        const values = await page.$$eval('.nbhd-index-row',els=>els.map(el=>Number(el.children[2].textContent.replaceAll(',',''))));
        assert.equal(values.length,158); assert(values.every((value,i)=>i===0||value<=values[i-1]));
      });
    }
    if (label === 'detail') {
      await test('calendar keyboard/touch values and monthly reconciliation', async () => {
        assert.equal((await page.$$('.cal-cell-button')).length,120);
        await page.focus('.cal-cell-button[tabindex="0"]'); await page.keyboard.press('ArrowRight');
        assert.equal(await page.evaluate(()=>document.activeElement.dataset.column),'1');
        const expected = monthly['73'].series.assault.find(p=>p.year===2017&&p.month===1).count;
        assert.match(await page.$eval('.calendar-readout',el=>el.textContent),new RegExp(`Jan 2017.*${expected} incidents`));
        const cell = await page.$('.cal-cell-button[data-month="3"][data-column="2"]'); await bringIntoView(cell);
        if (viewport.hasTouch) await cell.tap(); else await cell.click();
        assert.match(await page.$eval('.calendar-readout',el=>el.textContent),/Apr 2018/);
        await clickText(page,'.calendar-values summary','View monthly data');
        const rows = await page.$$eval('.calendar-values tbody tr',els=>els.map(el=>[...el.children].slice(1).map(cell=>Number(cell.textContent.replaceAll(',','')))));
        for (let year=2016;year<=2025;year++) assert.equal(rows.reduce((sum,row)=>sum+row[year-2016],0),annual['73'].series.assault.find(p=>p.year===year).count);
        await scan(page,`${name}/expanded-calendar`);
      });
      await test('feed pagination and fixed per-capita comparison', async () => {
        assert.equal((await page.$$('.feed-row')).length,14); await clickText(page,'.feed4 button','LOAD NEXT 14 →'); assert.equal((await page.$$('.feed-row')).length,28);
        const before = await page.$$eval('.neigh-v2-table tbody tr',els=>els.map(el=>el.textContent));
        await clickText(page,'.seg-btn','Rate / 10K'); assert.deepEqual(await page.$$eval('.neigh-v2-table tbody tr',els=>els.map(el=>el.textContent)),before);
        await clickText(page,'.seg-btn','Counts');
      });
    }
    if (await page.$('.filterbar')) await test('category/year filters and calendar range', async () => {
      await click(page, '.vrail-btn'); await clickText(page,'.vrail-chips button','Assault');
      assert.equal((await page.$$('.vrail-chips [aria-pressed="true"]')).length,4);
      await page.select('[aria-label="Start year"]','2020'); await page.select('[aria-label="End year"]','2023');
      assert.equal(new URL(page.url()).searchParams.get('y'),'2020-2023');
      if (label === 'detail') assert.equal((await page.$$('.cal-cell-button')).length,48);
      if (label === 'overview') { await clickText(page,'.vrail-panel button','+ Include 2026 YTD'); assert(await page.$eval('.filterbar',el=>el.textContent.includes('2026 is year-to-date (data through'))); }
      await click(page, '.vrail-btn'); await noOverflow(page);
    });
    if (await page.$('.map-canvas')) await test('158 populated map polygons and pointer navigation', async () => {
      assert.equal((await page.$$('.leaflet-overlay-pane path.leaflet-interactive')).length,158);
      await mapClick(page);
    });
  } catch (error) { await test('surface completes', () => {throw error;}); }
  finally {await context.close();}
}

try {
  preview = await startPreview();
  browser = await puppeteer.launch({executablePath,headless:true,userDataDir:profile,args:['--disable-background-networking','--disable-component-update',...(process.env.QA_NO_SANDBOX==='1'?['--no-sandbox']:[])]});
  results.browser = await browser.version(); results.tiles = process.env.QA_LIVE_TILES === '1' ? 'live CARTO' : 'local fixture';
  for (const [mode,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:375,height:812,isMobile:true,hasTouch:true}]]) {
    for (const [route,label] of [['/','overview'],['/compare/','compare'],['/neighbourhood/','index'],['/neighbourhood/73/','detail'],['/about/','about']]) await surface(mode,viewport,route,label);
  }
  const {page,context,payload} = await createPage('shared-links',{width:1280,height:900});
  await check('Copy view defaults override recipient preferences after open/reload', async () => {
    await page.goto(preview.url,{waitUntil:'load'}); await loaded(page); await payload(); await click(page, '[aria-label="Copy a shareable link to this view"]');
    const copied = await page.evaluate(()=>Reflect.get(window, '__qaClipboard')); const query = new URL(copied).searchParams;
    for (const key of ['u','p','c','y','ytd','cmp','cb']) assert(query.has(key),`Missing ${key}`);
    assert.equal(query.get('u'),'count'); assert.equal(query.get('cb'),'01');
    await page.evaluate(()=>localStorage.setItem('crime-pulse.v1',JSON.stringify({unit:'rate',primaryCat:'robbery',activeCats:['robbery'],includeYTD:true,yearRange:[2020,2023]})));
    for (const reload of [false,true]) {
      if (reload) await page.reload({waitUntil:'load'}); else await page.goto(copied,{waitUntil:'load'}); await loaded(page);
      assert(await page.evaluate(()=>[...document.querySelectorAll('.seg-btn')].some(el=>el.textContent.trim()==='Counts'&&el.getAttribute('aria-pressed')==='true')));
      const rail = await page.$$eval('.vrail-btn',els=>els.map(el=>el.textContent).join(' ')); assert.match(rail,/5 of 5 categories/); assert.match(rail,/2016 – 2025/); assert.match(rail,/YTD off/);
    }
  }, page);
  await context.close();
  await check('branded 404 and development routes excluded',async () => {
    // Expected errors are checked in isolation, without weakening runtime error checks.
    for (const route of ['/missing-qa-path/','/project/','/styleguide/']) {const response=await fetch(preview.url+route); assert.equal(response.status,404); assert.match(await response.text(),/404/);}
  });
  await check('no browser, console, HTTP or request errors',()=>assert.deepEqual(results.errors,[]));
} catch(error) {results.checks.push({name:'browser setup/run',pass:false,error:error.stack}); console.error(error);}
finally {
  if (browser) await browser.close(); if(preview) await preview.close(); await rm(profile,{recursive:true,force:true});
  results.finished = new Date().toISOString(); await save();
}
const failed = results.checks.filter(check=>!check.pass);
console.log(`${results.checks.length-failed.length}/${results.checks.length} browser checks passed; ${results.accessibility.length} accessibility scans. Results: ${output}`);
process.exitCode = failed.length ? 1 : 0;
