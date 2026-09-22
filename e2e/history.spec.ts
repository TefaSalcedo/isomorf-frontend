import { expect, test, type Page } from '@playwright/test';
import { disposableUser, registerViaUi } from './helpers';

async function createProject(page: Page, name: string) {
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.locator('input[name="name"]').fill(name);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/projects\//);
  await expect(page.locator('canvas').first()).toBeVisible();
}

async function drawWall(page: Page) {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not visible');
  await page.getByRole('button', { name: 'Wall / slab' }).click();
  // The editor draws with two clicks: first sets the start, second commits.
  await page.mouse.move(box.x + 200, box.y + 250);
  await page.mouse.down();
  await page.mouse.up();
  await page.mouse.move(box.x + 520, box.y + 250, { steps: 8 });
  await page.mouse.down();
  await page.mouse.up();
}

test.describe('document history', () => {
  test('undo and redo survive a reload', async ({ page }) => {
    await registerViaUi(page, disposableUser());
    await createProject(page, `History ${Date.now()}`);

    await drawWall(page);
    await expect(page.getByText('1 element', { exact: true })).toBeVisible();
    await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 15_000 });

    const undoButton = page.getByRole('button', { name: 'Undo' });
    const redoButton = page.getByRole('button', { name: 'Redo' });
    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();

    await undoButton.click();
    await expect(page.getByText('0 elements', { exact: true })).toBeVisible();
    await expect(redoButton).toBeEnabled();

    // The persisted document must still report the older revision after reload.
    await page.reload();
    await expect(page.getByText('0 elements', { exact: true })).toBeVisible();
    await expect(redoButton).toBeEnabled();

    await redoButton.click();
    await expect(page.getByText('1 element', { exact: true })).toBeVisible();
  });
});
