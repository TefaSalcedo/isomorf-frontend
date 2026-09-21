import { expect, test } from '@playwright/test';
import { disposableUser, registerViaUi } from './helpers';

test.describe('authentication', () => {
  test('register shows a password field, creates a session and lands on the dashboard', async ({ page }) => {
    const user = disposableUser();
    await page.goto('/register');
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await registerViaUi(page, user);
    await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
  });

  test('login restores an existing account after the session cookies are gone', async ({ page, context }) => {
    const user = disposableUser();
    await registerViaUi(page, user);

    await context.clearCookies();
    await page.goto('/login');
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="password"]').fill(user.password);
    await page.getByRole('button', { name: 'Enter workspace' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
  });
});
