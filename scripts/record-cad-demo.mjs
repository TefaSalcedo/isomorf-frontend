// Records a guided demo of the Week-8 CAD primitives as a .webm video:
// command-palette tool arming, typed coordinates (x,y / @dx,dy / L<deg / WxH),
// polyline close, and the CAD entities staying out of the 3D model.
// Usage: node scripts/record-cad-demo.mjs  (frontend dev server + backend must be up)
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_DIR = path.resolve(HERE, '../../videos');
const BASE = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.DEMO_EMAIL ?? 'e2e-catalog-20261007@isomorf.dev';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Catalog-2026!';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[cad-demo] ${msg}`);

async function armTool(page, query) {
  const input = page.locator('input[placeholder*="command or describe"]');
  await page.keyboard.press('Control+k');
  await input.waitFor({ state: 'visible' });
  await page.keyboard.type(query, { delay: 110 });
  await sleep(600);
  await page.keyboard.press('Enter');
  await input.waitFor({ state: 'hidden' });
  await sleep(350);
}

async function typePoint(page, text) {
  await page.keyboard.type(text, { delay: 140 });
  await sleep(250);
  await page.keyboard.press('Enter');
  await sleep(500);
}

const browser = await chromium.launch({ headless: true, slowMo: 300 });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
page.setDefaultTimeout(25000);

try {
  log('login');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await sleep(800);
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  try {
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  } catch {
    log('login failed -> registering demo account');
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await page.locator('input[name="first_name"]').fill('CAD');
    await page.locator('input[name="last_name"]').fill('Demo');
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Create account and start free' }).click();
    await page.waitForURL('**/dashboard');
  }
  await sleep(1500);

  log('open/create project');
  const card = page.getByRole('link', { name: /CAD Plan|Catalog E2E/i }).first();
  if (await card.count()) {
    await card.click();
  } else {
    await page.getByRole('button', { name: /Structural model/i }).click();
    await page.getByRole('textbox', { name: 'Project name' }).fill('CAD Plan 6x4');
    await page.getByRole('button', { name: 'Create project' }).click();
  }
  await page.waitForSelector('.konvajs-content canvas');
  await sleep(2200);

  log('polyline: closed 6x4 plan, keyboard only');
  await armTool(page, 'polyline');
  await typePoint(page, '0,0');
  await typePoint(page, '6,0');
  await typePoint(page, '6,4');
  await typePoint(page, '0,4');
  await page.keyboard.press('c');
  await sleep(900);

  log('line: diagonal');
  await armTool(page, 'line');
  await typePoint(page, '0,0');
  await typePoint(page, '6,4');
  await sleep(700);

  log('arc: 3 points');
  await armTool(page, 'arc');
  await typePoint(page, '0,4');
  await typePoint(page, '3,5');
  await typePoint(page, '6,4');
  await sleep(700);

  log('circle: center + radius');
  await armTool(page, 'circle');
  await typePoint(page, '3,2');
  await typePoint(page, '1.5');
  await sleep(700);

  log('rectangle: WxH size input');
  await armTool(page, 'rectangle');
  await typePoint(page, '8,0');
  await page.keyboard.type('2x1', { delay: 160 });
  await sleep(300);
  await page.keyboard.press('Enter');
  await sleep(700);

  log('hatch: two corners');
  await armTool(page, 'hatch');
  await typePoint(page, '8,2');
  await typePoint(page, '10,4');
  await sleep(900);

  log('zoom fit');
  await page.getByRole('button', { name: 'Fit' }).click();
  await sleep(1400);

  log('element table');
  await page.getByRole('button', { name: 'Table' }).click();
  await sleep(1800);

  log('3d view: CAD annotations excluded');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await sleep(3200);

  log('back to 2d');
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await sleep(1600);
  log('done');
} finally {
  await context.close();
  await browser.close();
  console.log(`[cad-demo] video saved under ${VIDEO_DIR}`);
}
