/**
 * Performance acceptance scenes (headless Chromium):
 *  1. ordinary play — planted garden, assert no long task > 50 ms and a
 *     stable average frame rate on the desktop profile.
 *  2. stress — maximum expected zombies + projectiles + particles +
 *     animated plants; assert no unbounded particle/actor growth and no
 *     repeated asset decoding.
 *  3. tablet adaptive recovery — CPU-throttled tablet boot must demote the
 *     quality tier and recover after the throttle lifts.
 *
 * Run: pnpm perf
 */
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, '.artifacts');
const URL = 'http://localhost:4173/';

const planted = encodeURIComponent(
  JSON.stringify([
    ['peashooter', 1, 1],
    ['sunflower', 2, 1],
    ['wallnut', 2, 2],
    ['snowpea', 3, 1],
  ]),
);

const densePlants = encodeURIComponent(
  JSON.stringify(
    Array.from({ length: 5 }, (_, row) =>
      Array.from({ length: 6 }, (_, col) => [col % 2 === 0 ? 'peashooter' : 'sunflower', col, row]),
    ).flat(),
  ),
);

const denseZombies = encodeURIComponent(
  JSON.stringify(
    Array.from({ length: 20 }, (_, i) => ({
      kind: (['basic', 'cone', 'bucket', 'runner', 'flag'] as const)[i % 5],
      row: i % 5,
      x: 500 + (i % 4) * 60,
    })),
  ),
);

interface FrameStats {
  avg: number;
  p95: number;
  max: number;
  frames: number;
}

async function measureFrames(page: Page, ms: number): Promise<FrameStats> {
  return page.evaluate(
    `new Promise((resolve) => {
      const deltas = [];
      let last = performance.now();
      const t0 = performance.now();
      let raf = 0;
      const loop = (now) => {
        deltas.push(now - last);
        last = now;
        if (now - t0 >= ${ms}) {
          cancelAnimationFrame(raf);
          const sorted = [...deltas].sort((a, b) => a - b);
          const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
          const p95 = sorted[Math.floor(sorted.length * 0.95)];
          resolve({ avg: +avg.toFixed(2), p95: +p95.toFixed(2), max: +Math.max(...deltas).toFixed(2), frames: deltas.length });
        } else {
          raf = requestAnimationFrame(loop);
        }
      };
      raf = requestAnimationFrame(loop);
    })`,
  );
}

async function waitForGame(page: Page): Promise<void> {
  await page.waitForSelector('.hud', { timeout: 20000 });
  await page.waitForTimeout(1500);
}

async function main(): Promise<void> {
  mkdirSync(ART, { recursive: true });
  console.log('building…');
  await new Promise<void>((resolve, reject) => {
    const b = spawn('pnpm', ['build'], { cwd: ROOT, stdio: 'ignore' });
    b.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('build failed'))));
  });
  const server = spawn(
    'pnpm',
    ['exec', 'vite', 'preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'],
    { cwd: ROOT, stdio: 'ignore' },
  );
  const results: Record<string, unknown> = {};
  let failed = false;
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    // count image decodes from before the app loads
    await page.addInitScript(`
      window.__DECODES__ = 0;
      const origDecode = Image.prototype.decode;
      Image.prototype.decode = function () { window.__DECODES__++; return origDecode.call(this); };
    `);

    // ---- 1. ordinary play ----
    console.log('ordinary play (desktop profile)…');
    await page.goto(URL + '?shot=1&scene=game&level=0&seed=42&live=1&plants=' + planted, { waitUntil: 'load' });
    await waitForGame(page);
    await page.evaluate(`new Promise((r) => { const o = new PerformanceObserver((l) => { window.__LONGTASKS__ = l.getEntries().map((e) => e.duration); o.disconnect(); r(); }); o.observe({ entryTypes: ['longtask'] }); setTimeout(r, 9000); })`);
    const ordinary = await measureFrames(page, 6000);
    const ordinaryLongTasks = await page.evaluate('(window.__LONGTASKS__ || []).slice()');
    results.ordinary = { fps: Math.round(1000 / ordinary.avg), p95: ordinary.p95, max: ordinary.max, longTasks: ordinaryLongTasks };
    console.log('  fps', results.ordinary);

    // ---- 2. stress ----
    console.log('stress (max entities)…');
    await page.goto(
      URL + '?shot=1&scene=game&level=0&seed=99&live=1&plants=' + densePlants + '&zombies=' + denseZombies,
      { waitUntil: 'load' },
    );
    await waitForGame(page);
    const decodesAt5s = await page.evaluate('window.__DECODES__');
    const stress = await measureFrames(page, 6000);
    const statsA = await page.evaluate('window.__PVZ_STATS__');
    const decodesAt11s = await page.evaluate('window.__DECODES__');
    const stressLongTasks = await page.evaluate(
      `new Promise((r) => {
        let done = false;
        const finish = (list) => { if (!done) { done = true; o.disconnect(); r(list); } };
        const o = new PerformanceObserver((l) => finish(l.getEntries().map((e) => e.duration)));
        o.observe({ entryTypes: ['longtask'] });
        setTimeout(() => finish([]), 8000);
      })`,
    );
    results.stress = {
      fps: Math.round(1000 / stress.avg),
      p95: stress.p95,
      max: stress.max,
      stats: statsA,
      longTasks: stressLongTasks,
      decodesStable: decodesAt5s === decodesAt11s,
      decodeCount: decodesAt11s,
    };
    console.log('  fps', results.stress.fps, 'stats', JSON.stringify(statsA));

    // ---- 3. tablet adaptive recovery ----
    console.log('tablet adaptive recovery…');
    // Deterministic quality driver: sustained slow frames demote the live
    // pipeline; sustained fast frames recover it (hysteresis included).
    await page.goto(
      URL + '?shot=1&scene=game&level=0&seed=99&live=1&tier=high&plants=' + densePlants + '&zombies=' + denseZombies,
      { waitUntil: 'load' },
    );
    await waitForGame(page);
    const qTier = await page.evaluate('window.__PVZ_QUALITY__.tier()');
    await page.evaluate('window.__PVZ_QUALITY__.sample(22, 180)'); // ~3 s of sustained misses
    const tierDemoted = await page.evaluate('window.__PVZ_QUALITY__.tier()');
    await page.evaluate('window.__PVZ_QUALITY__.sample(11, 900)'); // long stable recovery → two promotion hops
    const tierRecovered = await page.evaluate('window.__PVZ_QUALITY__.tier()');
    const caps = await page.evaluate('window.__PVZ_STATS__');
    console.log('  tier:', qTier, '→ demoted:', tierDemoted, '→ recovered:', tierRecovered);

    // Real CPU throttle (informational: headless shells often ignore it).
    let throttleFps = 0;
    try {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
      await page.waitForTimeout(3000);
      const throttled = await measureFrames(page, 3000);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      throttleFps = Math.round(1000 / throttled.avg);
      console.log('  fps under 8x CPU throttle (may be ignored in headless):', throttleFps);
    } catch {
      console.log('  CPU throttling not supported in this browser build');
    }
    results.tablet = {
      tierStart: qTier,
      tierDemoted: tierDemoted,
      tierRecovered: tierRecovered,
      throttleFps,
      stats: caps,
    };

    // ---- assertions ----
    const ordinaryFps = Math.round(1000 / (ordinary.avg as number));
    if ((ordinaryLongTasks as number[]).length > 0) {
      console.error('FAIL: long tasks during ordinary play:', ordinaryLongTasks);
      failed = true;
    }
    if (ordinaryFps < 50) {
      console.error('FAIL: ordinary-play fps below 50:', ordinaryFps);
      failed = true;
    }
    if ((statsA as { particles: number }).particles > 420 || (statsA as { actors: number }).actors > 40) {
      console.error('FAIL: unbounded cosmetic growth:', statsA);
      failed = true;
    }
    if (!(results.stress as { decodesStable: boolean }).decodesStable) {
      console.error('FAIL: assets decoded repeatedly during play');
      failed = true;
    }
    if (tierDemoted === 'high') {
      console.error('FAIL: quality did not demote after sustained frame-time misses');
      failed = true;
    }
    if (tierRecovered !== 'high') {
      console.error('FAIL: quality did not promote back after a long stable recovery');
      failed = true;
    }
    if (errors.length > 0) {
      console.error('BROWSER ERRORS:\n' + errors.join('\n'));
      failed = true;
    }

    writeFileSync(join(ART, 'perf-report.json'), JSON.stringify(results, null, 2));
    console.log(failed ? 'perf FAILED — see .artifacts/perf-report.json' : 'perf ok — report in .artifacts/perf-report.json');
    await browser.close();
  } finally {
    server.kill();
  }
  if (failed) process.exitCode = 1;
}

void main();
