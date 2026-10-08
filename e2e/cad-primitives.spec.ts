import { expect, test } from '@playwright/test';
import { disposableUser, registerViaUi } from './helpers';

/** Week 8 CAD primitives — keyboard-only flow.
 *  Arms tools through the command palette (Ctrl+K) and feeds coordinates via
 *  the dynamic input, AutoCAD style: "x,y" absolute, "@dx,dy" relative,
 *  bare numbers as radius/length and "c" to close a polyline. */
test.describe('cad primitives (keyboard only)', () => {
  test('draws a closed 6x4m plan polyline plus line, circle and rectangle using only the keyboard', async ({ page }) => {
    await registerViaUi(page, disposableUser());

    const name = `E2E CAD ${Date.now()}`;
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.locator('input[name="name"]').fill(name);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/projects\//);
    await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();

    const paletteInput = page.locator('input[placeholder*="command or describe"]');
    const armTool = async (query: string) => {
      await page.keyboard.press('Control+k');
      await expect(paletteInput).toBeFocused();
      await paletteInput.fill(query);
      await page.keyboard.press('Enter');
      await expect(paletteInput).toBeHidden();
    };
    const typePoint = async (text: string) => {
      await page.keyboard.type(text);
      await page.keyboard.press('Enter');
    };

    // Closed rectangular plan outline: polyline 0,0 → 6,0 → 6,4 → 0,4 → close.
    await armTool('polyline');
    await typePoint('0,0');
    await typePoint('6,0');
    await typePoint('6,4');
    await typePoint('0,4');
    await page.keyboard.press('c');

    // Annotation line across the plan diagonal.
    await armTool('line');
    await typePoint('0,0');
    await typePoint('6,4');

    // Circle: center 3,2 and bare number as radius (1.5 m).
    await armTool('circle');
    await typePoint('3,2');
    await typePoint('1.5');

    // Rectangle from typed size WxH.
    await armTool('rectangle');
    await typePoint('8,0');
    await page.keyboard.type('2x1');
    await page.keyboard.press('Enter');

    // The element table lists every drawn entity (view via palette).
    await armTool('table');
    for (const label of ['Polyline', 'Line', 'Circle', 'Rectangle']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    // Persistence: the toolbar badge reports "Saved · vN" only after the
    // debounced PUT flushes with no pending changes — deterministic save signal.
    await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await armTool('table');
    for (const label of ['Polyline', 'Line', 'Circle', 'Rectangle']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });
});
