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
