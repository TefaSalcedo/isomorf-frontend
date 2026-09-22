import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { disposableUser, registerViaUi } from './helpers';

async function expectNoCriticalViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter((violation) => violation.impact === 'critical');
  expect(
    critical,
    `${context}: ${critical.map((violation) => `${violation.id} (${violation.nodes.length} nodes)`).join(', ')}`,
  ).toHaveLength(0);
}

test.describe('accessibility', () => {
  test('landing page has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    await expectNoCriticalViolations(page, 'landing');
  });

  test('register page has no critical axe violations', async ({ page }) => {
    await page.goto('/register');
    await expectNoCriticalViolations(page, 'register');
  });

  test('dashboard has no critical axe violations', async ({ page }) => {
    await registerViaUi(page, disposableUser());
    await expectNoCriticalViolations(page, 'dashboard');
  });

  test('editor canvas and toolbar have no critical axe violations', async ({ page }) => {
    await registerViaUi(page, disposableUser());
    const name = `A11y Project ${Date.now()}`;
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.locator('input[name="name"]').fill(name);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/projects\//);
    await expect(page.getByRole('application', { name: '2D drawing canvas' })).toBeVisible();
    await expectNoCriticalViolations(page, 'editor 2d');
  });
});

test.describe('language switcher', () => {
  test('switches UI between English and Spanish and persists the choice', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('button', { name: 'Create account and start free' })).toBeVisible();

    await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'ES' }).click();
    await expect(page.getByRole('button', { name: 'Crear cuenta y empezar gratis' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Crear cuenta y empezar gratis' })).toBeVisible();

    await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'EN' }).click();
    await expect(page.getByRole('button', { name: 'Create account and start free' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});
