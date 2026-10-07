// Records a guided demo of the element-catalog feature set as a .webm video.
// Usage: node scripts/record-demo.mjs  (frontend dev server + backend must be up)
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_DIR = path.resolve(HERE, '../../videos');
const BASE = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.DEMO_EMAIL ?? 'e2e-catalog-20261007@isomorf.dev';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Catalog-2026!';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[demo] ${msg}`);

async function canvasBox(page) {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) throw new Error('canvas not visible');
  return box;
}

async function clickCanvas(page, fx, fy) {
  const box = await canvasBox(page);
  const x = box.x + box.width * fx;
  const y = box.y + box.height * fy;
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.down();
  await page.mouse.up();
}

async function drawLine(page, fx1, fy1, fx2, fy2) {
  await clickCanvas(page, fx1, fy1);
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width * fx2, box.y + box.height * fy2, { steps: 10 });
  await page.mouse.down();
  await page.mouse.up();
}

const browser = await chromium.launch({ headless: true, slowMo: 320 });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
page.setDefaultTimeout(20000);

try {
  log('login');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await sleep(800);
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await page.waitForURL('**/dashboard');
  await sleep(1500);

  log('open project');
  const card = page.getByRole('link', { name: /Catalog E2E/i }).first();
  if (await card.count()) {
    await card.click();
  } else {
    await page.getByRole('button', { name: /Structural model/i }).click();
    await page.getByRole('textbox', { name: 'Project name' }).fill('Demo video');
    await page.getByRole('button', { name: 'Create project' }).click();
  }
  await page.waitForSelector('canvas');
  await sleep(2200);

  log('command palette: vigueta');
  await page.keyboard.press('Control+k');
  await sleep(600);
  await page.keyboard.type('vigueta', { delay: 90 });
  await sleep(700);
  await page.keyboard.press('Enter');
  await sleep(400);
  await drawLine(page, 0.08, 0.75, 0.45, 0.75);
  await sleep(800);

  log('footing (rect tool)');
  await page.getByRole('button', { name: 'Footing' }).click();
  await drawLine(page, 0.55, 0.6, 0.68, 0.85);
  await sleep(800);

  log('wall (line tool)');
  await page.getByRole('button', { name: 'Wall', exact: true }).click();
  await drawLine(page, 0.08, 0.3, 0.4, 0.3);
  await sleep(800);

  log('select slab -> inspector');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await clickCanvas(page, 0.42, 0.42);
  await sleep(900);
  const matSection = page.getByRole('button', { name: 'Material & section' });
  if (await matSection.count()) {
    await matSection.click();
    await sleep(600);
  }
  const material = page.getByRole('combobox', { name: 'Material' }).first();
  if (await material.count()) {
    await material.selectOption({ index: 2 });
    await sleep(700);
  }

  log('catalog panel');
  await page.locator('button[aria-label="Catalog"]').click();
  await sleep(1200);
  const matName = page.getByPlaceholder(/New material name/i);
  if (await matName.count()) {
    await matName.fill('Hormigon H-35');
    await page.getByRole('button', { name: /Add material/i }).click();
    await sleep(900);
  }

  log('table view');
  await page.getByRole('button', { name: 'Table' }).click();
  await sleep(1400);
  const filter = page.locator('select').first();
  if (await filter.count()) await sleep(400);

  log('3d view');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await sleep(3200);

  log('back to 2d');
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await sleep(1600);
  log('done');
} finally {
  await context.close();
  await browser.close();
  console.log(`[demo] video saved under ${VIDEO_DIR}`);
}
