/**
 * Headless browser smoke test: boots the production build, walks through
 * loading → menu → level select → gameplay → pause, captures screenshots
 * into .artifacts/ and fails on any console error or page error.
 *
 * Run: pnpm smoke   (starts `vite preview` itself; needs Chromium installed
 * via `PLAYWRIGHT_BROWSERS_PATH=.pw-browsers pnpm exec playwright install chromium`)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, '.artifacts');
const URL = 'http://localhost:4173/';

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  mkdirSync(ART, { recursive: true });
  const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  try {
    // wait for the preview server
    for (let i = 0; i < 50; i++) {
      try {
        const res = await fetch(URL);
        if (res.ok) break;
      } catch {
        /* not up yet */
      }
      if (i === 49) throw new Error('vite preview did not start');
      await wait(200);
    }

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push('console: ' + m.text());
    });

    await page.goto(URL, { waitUntil: 'load' });
    // loading → menu
    await page.waitForSelector('.menu-title', { timeout: 15000 });
    await wait(500); // let the fade settle
    await page.screenshot({ path: join(ART, 'smoke-menu.png') });

    // menu → level select
    await page.click('button:has-text("Play")');
    await page.waitForSelector('.level-grid', { timeout: 5000 });
    await wait(600);
    await page.screenshot({ path: join(ART, 'smoke-levelselect.png') });

    // level select → game
    await page.click('.level-card:not(.locked)');
    await page.waitForSelector('.hud', { timeout: 5000 });
    await wait(2500); // let a wave start and entities animate
    await page.screenshot({ path: join(ART, 'smoke-game.png') });

    // plant a peashooter via seed packet + lawn click
    await page.click('.seed-card');
    await page.mouse.click(560, 420);
    await wait(1200);
    await page.screenshot({ path: join(ART, 'smoke-planted.png') });

    // pause overlay + accessibility toggles
    await page.keyboard.press('Escape');
    await page.waitForSelector('.shed-panel', { timeout: 3000 });
    await wait(400);
    await page.screenshot({ path: join(ART, 'smoke-pause.png') });
    await page.click('button:has-text("Resume")');

    // frame-time probe over ~2 s of live play
    const fps = await page.evaluate(`
      new Promise((resolve) => {
        const deltas = [];
        let last = performance.now();
        let raf = 0;
        const loop = (now) => {
          deltas.push(now - last);
          last = now;
          if (deltas.length >= 120) {
            cancelAnimationFrame(raf);
            const avg = deltas.slice(20).reduce((a, b) => a + b, 0) / (deltas.length - 20);
            resolve(Math.round(1000 / avg));
          } else {
            raf = requestAnimationFrame(loop);
          }
        };
        raf = requestAnimationFrame(loop);
      })
    `);
    console.log('live-play fps (headless, software rendering):', fps);
    await page.screenshot({ path: join(ART, 'smoke-live.png') });

    // ---- accessibility: every button needs an accessible name ----
    const unnamed = await page.evaluate(
      `[...document.querySelectorAll('button')].filter((b) => !((b.getAttribute('aria-label') || '').trim() || (b.textContent || '').trim())).length`,
    );
    if (unnamed > 0) {
      console.error('FAIL: buttons without accessible names:', unnamed);
      process.exitCode = 1;
    } else {
      console.log('a11y: every button has an accessible name');
    }

    // ---- audio settings persist through the pause panel ----
    const readMusicOn = `(() => { const raw = localStorage.getItem('pvz-save-v1'); return raw ? JSON.parse(raw).audio.musicOn : true; })()`;
    const musicOnBefore = await page.evaluate(readMusicOn);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.option-row', { timeout: 3000 });
    await page.click('.option-row:has-text("Music") input');
    await page.waitForTimeout(150);
    const musicOnAfter = await page.evaluate(readMusicOn);
    if (musicOnBefore === musicOnAfter) {
      console.error('FAIL: music toggle did not persist');
      process.exitCode = 1;
    } else {
      console.log('audio settings persist through the pause panel');
    }
    await page.click('.option-row:has-text("Music") input'); // restore
    await page.click('button:has-text("Resume")');

    // ---- input accuracy: a click in a cell plants exactly there ----
    await page.goto(URL + '?shot=1&scene=game&level=0&seed=5&live=1&mowers=0', { waitUntil: 'load' });
    await page.waitForSelector('.hud', { timeout: 20000 });
    await wait(900);
    // select the first seed (sunflower) and click cell (3,2) center
    await page.click('.seed-card');
    const rect = await page.evaluate(`(() => { const r = document.getElementById('game').getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height }; })()`);
    const cellX = rect.left + ((40 + 3 * 80 + 40) / 800) * rect.w;
    const cellY = rect.top + ((80 + 2 * 100 + 50) / 600) * rect.h;
    await page.mouse.click(cellX, cellY);
    await wait(250);
    const grid = await page.evaluate('window.__PVZ_GRID__()');
    if (grid[3][2] !== 'sunflower') {
      console.error('FAIL: pointer click did not plant in the expected cell', JSON.stringify(grid));
      process.exitCode = 1;
    } else {
      console.log('input accuracy: click planted in the exact expected cell');
    }
    // a click outside the lawn does not plant
    await page.click('.seed-card');
    await page.mouse.click(rect.left + 0.01 * rect.w, rect.top + 0.5 * rect.h);
    await wait(250);
    const grid2 = await page.evaluate('window.__PVZ_GRID__()');
    const planted = grid2.flat().filter(Boolean).length;
    if (planted !== 1) {
      console.error('FAIL: off-lawn click planted a plant');
      process.exitCode = 1;
    }

    // touch-tablet variant of the same accuracy check
    const touchContext = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 768 } });
    const touchPage = await touchContext.newPage();
    touchPage.on('pageerror', (e) => errors.push('touch pageerror: ' + String(e)));
    touchPage.on('console', (m) => {
      if (m.type() === 'error') errors.push('touch console: ' + m.text());
    });
    await touchPage.goto(URL + '?shot=1&scene=game&level=0&seed=5&live=1&mowers=0', { waitUntil: 'load' });
    await touchPage.waitForSelector('.hud', { timeout: 20000 });
    await wait(900);
    await touchPage.tap('.seed-card');
    const trect = await touchPage.evaluate(`(() => { const r = document.getElementById('game').getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height }; })()`);
    const tcx = trect.left + ((40 + 4 * 80 + 40) / 800) * trect.w;
    const tcy = trect.top + ((80 + 3 * 100 + 50) / 600) * trect.h;
    await touchPage.tap('#game', { position: { x: tcx - trect.left, y: tcy - trect.top } });
    await wait(250);
    const tgrid = await touchPage.evaluate('window.__PVZ_GRID__()');
    if (tgrid[4][3] !== 'sunflower') {
      console.error('FAIL: touch tap did not plant in the expected cell', JSON.stringify(tgrid));
      process.exitCode = 1;
    } else {
      console.log('touch accuracy: tap planted in the exact expected cell (tablet)');
    }
    await touchContext.close();

    // ---- live defeat flow: zombie crosses the house line ----
    await page.goto(
      URL + '?shot=1&scene=game&level=0&seed=5&live=1&mowers=0&zombies=' + encodeURIComponent(JSON.stringify([{ kind: 'basic', row: 0, x: 12 }])),
      { waitUntil: 'load' },
    );
    await page.waitForSelector('.result-lose', { timeout: 30000 });
    console.log('live defeat flow: loss leads to the defeat scene');
    await page.screenshot({ path: join(ART, 'smoke-defeat.png') });

    await wait(400);
    if (errors.length > 0) {
      console.error('BROWSER ERRORS:\n' + errors.join('\n'));
      process.exitCode = 1;
    } else {
      console.log('smoke ok — no console/page errors; screenshots in .artifacts/');
    }
    await browser.close();
  } finally {
    server.kill();
  }
}

void main();
