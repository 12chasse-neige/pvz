/**
 * Deterministic browser screenshot suite. Boots the production build with
 * a fixed seed and fixed simulation time for every shot (menu, level
 * select, gallery, full HUD, pause, victory, defeat, empty lawn, planted
 * defense, major wave, explosion, frozen zombie, damaged Wall-nut, mower,
 * dense combat, viewport/accessibility/quality variants), and verifies
 * pixel determinism by re-taking a sample of shots and comparing bytes.
 *
 * Run: pnpm shots
 */
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, '.artifacts', 'shots');
const URL = 'http://localhost:4173/';

interface Shot {
  name: string;
  query: string;
  viewport: { width: number; height: number };
  /** Emulate a touch device (coarse pointer → tablet HUD layout). */
  touch?: boolean;
  /** Optional extra actions after the scene is ready (e.g. open pause). */
  actions?: (page: Page) => Promise<void>;
  /** Wait after ready (fade settle). */
  settleMs?: number;
}

const plantsJSON = JSON.stringify([
  ['peashooter', 1, 1],
  ['sunflower', 2, 1],
  ['wallnut', 2, 2],
  ['snowpea', 3, 1],
]);

const densePlants = JSON.stringify(
  Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => [col % 2 === 0 ? 'peashooter' : 'sunflower', col, row]),
  ).flat(),
);

const denseZombies = JSON.stringify(
  Array.from({ length: 15 }, (_, i) => ({
    kind: ['basic', 'cone', 'bucket', 'runner', 'flag'][i % 5],
    row: i % 5,
    x: 560 + (i % 3) * 60,
    hpFrac: i % 4 === 0 ? 0.5 : undefined,
  })),
);

const SHOTS: Shot[] = [
  { name: 'menu', query: '?shot=1&scene=menu&t=1.6&seed=42', viewport: { width: 1280, height: 960 } },
  { name: 'menu-tablet', query: '?shot=1&scene=menu&t=2.2&seed=7', viewport: { width: 1024, height: 768 } },
  { name: 'menu-tablet-touch', query: '?shot=1&scene=menu&t=2.2&seed=7', viewport: { width: 1024, height: 768 }, touch: true },
  { name: 'levelselect', query: '?shot=1&scene=levelselect&t=1.2', viewport: { width: 1280, height: 960 } },
  { name: 'levelselect-tablet', query: '?shot=1&scene=levelselect&t=1.2', viewport: { width: 1024, height: 768 } },
  { name: 'gallery-plants', query: '?shot=1&scene=gallery&galleryGroup=0&t=0.8', viewport: { width: 1280, height: 960 } },
  { name: 'gallery-zombies', query: '?shot=1&scene=gallery&galleryGroup=1&t=0.8', viewport: { width: 1280, height: 960 } },
  { name: 'gallery-effects', query: '?shot=1&scene=gallery&galleryGroup=2&t=0.8', viewport: { width: 1280, height: 960 } },
  { name: 'gallery-ui', query: '?shot=1&scene=gallery&galleryGroup=3&t=0.8', viewport: { width: 1280, height: 960 } },
  { name: 'game-empty', query: '?shot=1&scene=game&level=0&seed=42&t=6', viewport: { width: 1280, height: 960 } },
  { name: 'game-planted', query: '?shot=1&scene=game&level=0&seed=42&t=8&plants=' + encodeURIComponent(plantsJSON), viewport: { width: 1280, height: 960 } },
  { name: 'game-majorwave', query: '?shot=1&scene=game&level=0&seed=42&t=61.4', viewport: { width: 1280, height: 960 } },
  {
    name: 'game-explosion',
    query: '?shot=1&scene=game&level=0&seed=42&t=0.3&cherryFuse=0.01&plants=' + encodeURIComponent(JSON.stringify([['cherrybomb', 3, 2]])),
    viewport: { width: 1280, height: 960 },
  },
  {
    name: 'game-frozen',
    query:
      '?shot=1&scene=game&level=0&seed=42&t=4&plants=' +
      encodeURIComponent(JSON.stringify([['snowpea', 2, 2]])) +
      '&zombies=' +
      encodeURIComponent(JSON.stringify([{ kind: 'basic', row: 2, x: 430, slowed: true }])),
    viewport: { width: 1280, height: 960 },
  },
  {
    name: 'game-wallnut-damaged',
    query:
      '?shot=1&scene=game&level=0&seed=42&t=4&wallnutHpFrac=0.2&plants=' +
      encodeURIComponent(JSON.stringify([['wallnut', 2, 2]])) +
      '&zombies=' +
      encodeURIComponent(JSON.stringify([{ kind: 'basic', row: 2, x: 240 }])),
    viewport: { width: 1280, height: 960 },
  },
  {
    name: 'game-mower',
    query:
      '?shot=1&scene=game&level=0&seed=42&t=0.3&zombies=' +
      encodeURIComponent(JSON.stringify([{ kind: 'basic', row: 1, x: 12 }])),
    viewport: { width: 1280, height: 960 },
  },
  {
    name: 'game-dense',
    query:
      '?shot=1&scene=game&level=0&seed=99&t=10&plants=' +
      encodeURIComponent(densePlants) +
      '&zombies=' +
      encodeURIComponent(denseZombies),
    viewport: { width: 1280, height: 960 },
  },
  {
    name: 'game-pause',
    query: '?shot=1&scene=game&level=0&seed=42&t=8&plants=' + encodeURIComponent(plantsJSON),
    viewport: { width: 1280, height: 960 },
    actions: async (page) => {
      await page.keyboard.press('Escape');
      await page.waitForSelector('.shed-panel', { timeout: 3000 });
    },
    settleMs: 500,
  },
  {
    name: 'game-tablet-touch',
    query: '?shot=1&scene=game&level=0&seed=42&t=8&plants=' + encodeURIComponent(plantsJSON),
    viewport: { width: 1024, height: 768 },
    touch: true,
  },
  {
    name: 'game-tier-low',
    query: '?shot=1&scene=game&level=0&seed=42&t=8&tier=low&plants=' + encodeURIComponent(plantsJSON),
    viewport: { width: 1280, height: 960 },
  },
  {
    name: 'game-tier-medium',
    query: '?shot=1&scene=game&level=0&seed=42&t=8&tier=medium&plants=' + encodeURIComponent(plantsJSON),
    viewport: { width: 1280, height: 960 },
  },
  {
    name: 'game-highcontrast',
    query: '?shot=1&scene=game&level=0&seed=42&t=8&contrast=1&plants=' + encodeURIComponent(plantsJSON),
    viewport: { width: 1280, height: 960 },
  },
  {
    name: 'game-muted',
    query: '?shot=1&scene=game&level=0&seed=42&t=8&muted=1&plants=' + encodeURIComponent(plantsJSON),
    viewport: { width: 1280, height: 960 },
  },
  {
    name: 'game-reducedmotion',
    query: '?shot=1&scene=game&level=0&seed=42&t=8&motion=0&plants=' + encodeURIComponent(plantsJSON),
    viewport: { width: 1280, height: 960 },
  },
  { name: 'victory', query: '?shot=1&scene=result-win&t=1.6', viewport: { width: 1280, height: 960 } },
  { name: 'defeat', query: '?shot=1&scene=result-lose&t=1.6', viewport: { width: 1280, height: 960 } },
];

async function take(page: Page, shot: Shot): Promise<Buffer> {
  await page.setViewportSize(shot.viewport);
  await page.goto(URL + shot.query, { waitUntil: 'load' });
  const isGame = shot.query.includes('scene=game');
  await page.waitForSelector(isGame ? '.hud' : '.menu-title, .result-win, .result-lose, .gallery-screen .btn-row', {
    timeout: 20000,
  });
  await page.waitForTimeout(shot.settleMs ?? 700);
  if (shot.actions) await shot.actions(page);
  await page.waitForTimeout(250);
  return page.screenshot();
}

async function main(): Promise<void> {
  mkdirSync(ART, { recursive: true });
  console.log('building…');
  await new Promise<void>((resolve, reject) => {
    const b = spawn('pnpm', ['build'], { cwd: ROOT, stdio: 'inherit' });
    b.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('build failed'))));
  });
  const server = spawn(
    'pnpm',
    ['exec', 'vite', 'preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'],
    { cwd: ROOT, stdio: 'ignore' },
  );
  try {
    for (let i = 0; i < 50; i++) {
      try {
        const res = await fetch('http://localhost:4173/');
        if (res.ok) break;
      } catch {
        /* not up */
      }
      if (i === 49) throw new Error('preview did not start');
      await new Promise((r) => setTimeout(r, 200));
    }
    const browser: Browser = await chromium.launch();
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const touchContext = await browser.newContext({ hasTouch: true });
    const touchPage = await touchContext.newPage();
    touchPage.on('pageerror', (e) => errors.push(String(e)));
    touchPage.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    const hashOf = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex').slice(0, 12);
    for (const shot of SHOTS) {
      const buf = await take(shot.touch ? touchPage : page, shot);
      const { writeFileSync } = await import('node:fs');
      writeFileSync(join(ART, shot.name + '.png'), buf);
      console.log('shot', shot.name.padEnd(22), buf.length + ' bytes', hashOf(buf));
    }
    // touch layout actually activated on touch shots
    for (const name of ['menu-tablet-touch', 'game-tablet-touch']) {
      const shot = SHOTS.find((s) => s.name === name)!;
      await touchPage.goto(URL + shot.query, { waitUntil: 'load' });
      await touchPage.waitForSelector('.hud, .menu-title', { timeout: 20000 });
      const cls = await touchPage.evaluate('document.body.className');
      if (!cls.includes('touch-mode')) {
        console.error('FAIL: touch-mode class missing on touch device for', name);
        process.exitCode = 1;
      }
    }
    console.log('touch-mode layout verified on touch device');

    // Determinism check: re-take a sample and compare bytes.
    console.log('determinism re-take…');
    const sample = ['menu', 'game-planted', 'gallery-zombies', 'victory'];
    let deterministic = true;
    for (const name of sample) {
      const shot = SHOTS.find((s) => s.name === name)!;
      const again = await take(page, shot);
      const first = readFileSync(join(ART, name + '.png'));
      const same = first.equals(again);
      if (!same) deterministic = false;
      console.log('re-take', name.padEnd(22), same ? 'IDENTICAL' : 'DIFFERS');
    }

    if (errors.length > 0) {
      console.error('BROWSER ERRORS:\n' + errors.join('\n'));
      process.exitCode = 1;
    }
    if (!deterministic) {
      console.error('determinism check FAILED');
      process.exitCode = 1;
    } else {
      console.log('screenshots ok —', SHOTS.length, 'shots + determinism verified; see .artifacts/shots/');
    }
    await browser.close();
  } finally {
    server.kill();
  }
}

void main();
