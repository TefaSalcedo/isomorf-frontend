import { expect, test } from '@playwright/test';
import { disposableUser, registerViaUi } from './helpers';

test.describe('projects', () => {
  test('creates a project from the dashboard and lists it as recent', async ({ page }) => {
    await registerViaUi(page, disposableUser());

    const name = `E2E Project ${Date.now()}`;
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.locator('input[name="name"]').fill(name);
    await page.locator('textarea[name="description"]').fill('Created by Playwright');
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page).toHaveURL(/\/projects\//);
    await page.goto('/dashboard');
    await expect(page.getByText(name)).toBeVisible();
  });
});
