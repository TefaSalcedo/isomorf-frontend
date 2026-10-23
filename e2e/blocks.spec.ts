import { expect, test, type Page } from '@playwright/test';
import { disposableUser, registerViaUi } from './helpers';

/** Week 10 block library — create a block from a box selection, insert a
 *  reference with a single canvas click, explode it back into loose
 *  elements, and verify the result persists across save + reload.
 *  Canvas pixels map 1:1 to world centimeters at the default zoom. */
test.describe('block library', () => {
  async function newProject(page: Page) {
    await page.setViewportSize({ width: 1600, height: 900 });
    await registerViaUi(page, disposableUser());
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.locator('input[name="name"]').fill(`E2E Blocks ${Date.now()}`);
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
    const selectAll = async () => {
      const rect = await box();
      await page.mouse.move(rect.x + rect.width - 3, rect.y + rect.height - 3);
      await page.mouse.down();
      await page.mouse.move(rect.x + 3, rect.y + 3, { steps: 6 });
      await page.mouse.up();
    };
    const rows = () => page.locator('tbody tr');
    return { arm, type, clickWorld, selectAll, rows };
  }

  test('creates, inserts, explodes and persists a block', async ({ page }) => {
    test.setTimeout(180_000);
    await newProject(page);
    const { arm, type, clickWorld, selectAll, rows } = helpers(page);

    // Two guide lines become the block contents.
    await arm('line');
    await type('1,1');
    await type('3,1');
    await arm('line');
    await type('1,1');
    await type('1,3');
    await page.keyboard.press('Escape');

    // Select both and save them as a named block in the library panel.
    await selectAll();
    await arm('blocks');
    await expect(page.getByPlaceholder('Block name')).toBeVisible();
    await page.getByPlaceholder('Block name').fill('corner-guides');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText('corner-guides')).toBeVisible();
    await expect(page.getByText('2 items')).toBeVisible();

    // Insert places a single block_ref element at the click point.
    await page.getByRole('button', { name: 'Insert', exact: true }).click();
    await expect(page.getByText('Click canvas to place')).toBeVisible();
    await clickWorld(900, 500);
    await page.keyboard.press('Escape');
    await arm('elements');
    await expect(rows()).toHaveCount(3);
    await expect(page.getByText('Block', { exact: true }).first()).toBeVisible();

    // Explode the instance: one row becomes two loose items again.
    await arm('2d');
    await clickWorld(920, 510);
    await arm('explode');
    await arm('elements');
    await expect(rows()).toHaveCount(4);

    // Persistence: elements (and the library) survive save + reload.
    await arm('2d');
    await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();
    await arm('elements');
    await expect(rows()).toHaveCount(4);

    // The block definition itself survived: it still lists in the panel.
    await arm('blocks');
    await expect(page.getByText('corner-guides')).toBeVisible();
  });
});
