import { expect, type Page } from '@playwright/test';

export interface TestUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export function disposableUser(): TestUser {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    firstName: 'E2E',
    lastName: 'User',
    email: `e2e-${stamp}@example.com`,
    password: 'e2e-password-123',
  };
}

export async function registerViaUi(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');
  await page.locator('input[name="first_name"]').fill(user.firstName);
  await page.locator('input[name="last_name"]').fill(user.lastName);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Create account and start free' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
