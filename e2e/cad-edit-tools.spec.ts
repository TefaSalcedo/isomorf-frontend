import { expect, test, type Page } from '@playwright/test';
import { disposableUser, registerViaUi } from './helpers';

/** Week 9 edit tools — AutoCAD-style sessions driven by crossing-box
 *  selection and typed input, plus direct element clicks for
 *  offset/trim/extend/fillet.
 *  The editor starts at zoom 1 / pan 0, so canvas pixels map 1:1 to world
 *  centimeters; element coordinates typed below are in meters.
 *  A 1600px viewport keeps every click target inside the visible canvas —
 *  the fixed properties rail (288px) covers the stage's right edge at
 *  narrower widths and would swallow clicks past world x≈700. */
test.describe('cad edit tools', () => {
  async function newProject(page: Page) {
    await page.setViewportSize({ width: 1600, height: 900 });
    await registerViaUi(page, disposableUser());
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.locator('input[name="name"]').fill(`E2E Edit ${Date.now()}`);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/projects\//);
    await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();
  }

  function helpers(page: Page) {
    const paletteInput = page.locator('input[placeholder*="command or describe"]');
    const arm = async (query: string) => {
      await page.keyboard.press('Control+k');
      await expect(paletteInput).toBeFocused();
      await paletteInput.fill(query);
      await page.keyboard.press('Enter');
      await expect(paletteInput).toBeHidden();
    };
    /** Arm an edit op and wait until its HUD is live — the HUD only renders
     *  once React committed the session, which removes the race between the
     *  palette dispatch and the first canvas click. */
    const armEdit = async (query: string) => {
      await arm(query);
      await expect(page.locator('[data-testid="edit-prompt"]')).toBeVisible();
    };
    const type = async (text: string) => {
      await page.keyboard.type(text);
      await page.keyboard.press('Enter');
    };
    const box = async () => {
      const rect = await page.locator('.konvajs-content').boundingBox();
      if (!rect) throw new Error('canvas not visible');
      return rect;
    };
    const clickWorld = async (x: number, y: number) => {
      const rect = await box();
      await page.mouse.click(rect.x + x, rect.y + y);
    };
    /** Crossing-select drag (right→left touches anything) covering the canvas. */
    const selectAll = async () => {
      const rect = await box();
      await page.mouse.move(rect.x + rect.width - 3, rect.y + rect.height - 3);
      await page.mouse.down();
      await page.mouse.move(rect.x + 3, rect.y + 3, { steps: 6 });
      await page.mouse.up();
    };
    const rows = () => page.locator('tbody tr');
    const columnValues = (label: string) =>
      page.locator(`input[aria-label="${label}"]`).evaluateAll((nodes) =>
        nodes.map((node) => Number((node as HTMLInputElement).value)),
      );
    return { arm, armEdit, type, clickWorld, selectAll, rows, columnValues };
  }

  test('moves, copies, rotates, arrays, mirrors and scales with box selection + typed input', async ({ page }) => {
    test.setTimeout(180_000);
    await newProject(page);
    const { arm, armEdit, type, selectAll, rows, columnValues } = helpers(page);

    // Two horizontal guide lines at y=1m and y=3m.
    await arm('line');
    await type('0,1');
    await type('4,1');
    await arm('line');
    await type('0,3');
    await type('4,3');
    await page.keyboard.press('Escape');

    // MOVE both lines +1m in each axis: Y1 1→2 and 3→4.
    await selectAll();
    await armEdit('move');
    await type('0,0');
    await type('@1,1');
    await arm('table');
    expect((await columnValues('Y1')).sort((a, b) => a - b)).toEqual([2, 4]);

    // COPY both −0.5m on x: four line rows total.
    await arm('2d');
    await selectAll();
    await armEdit('copy');
    await type('0,0');
    await type('@-0.5,0');
    await page.keyboard.press('Escape');
    await arm('table');
    await expect(rows()).toHaveCount(4);

    // ROTATE 90° about (2, 2.5): every row reports ≈90 in the Rot column.
    await arm('2d');
    await selectAll();
    await armEdit('rotate');
    await type('2,2.5');
    await type('90');
    await arm('table');
    const rotations = await columnValues('Rot (°)');
    expect(rotations.every((value) => Math.abs(Math.abs(value) - 90) < 0.2)).toBe(true);

    // RECTANGULAR ARRAY 2×2 with 2m × 0.5m cells: 3 clones each → 16 rows.
    await arm('2d');
    await selectAll();
    await armEdit('array');
    await type('2x2');
    await type('0,0');
    await type('@2,0.5');
    await arm('table');
    await expect(rows()).toHaveCount(16);

    // POLAR ARRAY of 3 items over 180°: 2 clones each → 48 rows.
    await arm('2d');
    await selectAll();
    await armEdit('polar');
    await type('3<180');
    await type('3,2.5');
    await type('@1,0');
    await arm('table');
    await expect(rows()).toHaveCount(48);

    // MIRROR across the horizontal axis at y=4m — transforms in place.
    await arm('2d');
    await selectAll();
    await armEdit('mirror');
    await type('0,4');
    await type('@1,0');
    await arm('table');
    await expect(rows()).toHaveCount(48);

    // SCALE ×0.5 about the origin — count unchanged.
    await arm('2d');
    await selectAll();
    await armEdit('scale');
    await type('0,0');
    await type('0.5');
    await arm('table');
    await expect(rows()).toHaveCount(48);

    // Persistence: the session result survives save + reload.
    await arm('2d');
    await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();
    await arm('table');
    await expect(rows()).toHaveCount(48);
  });

  test('offsets, trims, extends and fillets lines with element clicks', async ({ page }) => {
    test.setTimeout(180_000);
    await newProject(page);
    const { arm, armEdit, type, clickWorld, columnValues } = helpers(page);

    // OFFSET: source line at y=0.8m — click it, set 0.4m, pick the side below.
    await arm('line');
    await type('6.5,0.8');
    await type('8.5,0.8');
    await armEdit('offset');
    await clickWorld(750, 80);
    await type('0.4');
    await clickWorld(750, 130);
    await page.keyboard.press('Escape');
    await arm('table');
    expect((await columnValues('Y1')).some((v) => Math.abs(v - 1.2) < 0.01)).toBe(true);

    // TRIM: vertical cutter at x=7m crossing a horizontal line at y=3m.
    // Arming with nothing selected exercises the pick phase: first click
    // chooses the cutting edge, Enter switches to trim mode.
    await arm('2d');
    await arm('line');
    await type('7,1.8');
    await type('7,4.2');
    await arm('line');
    await type('6,3');
    await type('9,3');
    await page.keyboard.press('Escape');
    await armEdit('trim');
    await clickWorld(700, 350);
    await page.keyboard.press('Enter');
    await clickWorld(830, 300);
    await page.keyboard.press('Escape');
    await arm('table');
    expect((await columnValues('X2')).some((v) => Math.abs(v - 7) < 0.01)).toBe(true);

    // EXTEND: pre-selecting the boundary first, then the picked end of the
    // short segment grows until it meets the vertical boundary at x=9.2m.
    await arm('2d');
    await arm('line');
    await type('9.2,3.4');
    await type('9.2,4.8');
    await arm('line');
    await type('7.8,4.3');
    await type('8.8,4.3');
    await page.keyboard.press('Escape');
    await clickWorld(920, 410);
    await armEdit('extend');
    await clickWorld(850, 430);
    await page.keyboard.press('Escape');
    await arm('table');
    expect((await columnValues('X2')).some((v) => Math.abs(v - 9.2) < 0.01)).toBe(true);

    // FILLET r=0.3m between perpendicular lines meeting at (7.8, 5)m.
    await arm('2d');
    await arm('line');
    await type('6,5');
    await type('7.8,5');
    await arm('line');
    await type('7.8,5');
    await type('7.8,5.6');
    await page.keyboard.press('Escape');
    await armEdit('fillet');
    await type('0.3');
    await clickWorld(720, 500);
    await clickWorld(780, 530);
    await page.keyboard.press('Escape');
    await arm('table');
    await expect(page.getByText('Arc', { exact: true }).first()).toBeVisible();
  });
});
