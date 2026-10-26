import { expect, test, type Page } from '@playwright/test';
import { disposableUser, registerViaUi } from './helpers';

test.describe('dimensions and annotations', () => {
  async function newProject(page: Page, locale: 'en' | 'es' = 'en') {
    await page.setViewportSize({ width: 1600, height: 900 });
    await registerViaUi(page, disposableUser());
    if (locale === 'es') {
      await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'ES' }).click();
    }
    await page.getByRole('button', { name: locale === 'es' ? 'Nuevo' : 'New', exact: true }).click();
    await page.locator('input[name="name"]').fill(`${locale === 'es' ? 'Proyecto Planta' : 'E2E Annotations'} ${Date.now()}`);
    await page.getByRole('button', { name: locale === 'es' ? 'Crear proyecto' : 'Create project' }).click();
    await expect(page).toHaveURL(/\/projects\//);
    await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();
  }

  function helpers(page: Page) {
    const paletteInput = page.locator('input[placeholder*="command or describe"], input[placeholder*="comando o describe"]');
    const arm = async (query: string) => {
      await page.keyboard.press('Control+k');
      await expect(paletteInput).toBeFocused();
      await paletteInput.fill(query);
      await page.keyboard.press('Enter');
      await expect(paletteInput).toBeHidden();
    };
    const typePoint = async (point: string) => {
      await page.keyboard.type(point);
      await page.keyboard.press('Enter');
    };
    return { arm, typePoint };
  }

  test('creates, edits, and persists dimensions, text, leaders, tables, and DIM styles', async ({ page }) => {
    test.setTimeout(240_000);
    await newProject(page);
    const { arm, typePoint } = helpers(page);

    await arm('line');
    await typePoint('0,0');
    await typePoint('5,0');
    await arm('line');
    await typePoint('0,0');
    await typePoint('0,4');
    await arm('circle');
    await typePoint('3,2');
    await typePoint('1');

    await arm('dli');
    await typePoint('0,0');
    await typePoint('5,0');
    await typePoint('2.5,0.5');

    await arm('dal');
    await typePoint('1,0');
    await typePoint('4,4');
    await typePoint('5,3');
    await expect(page.getByTestId('dimension-value')).toHaveText('5.00');

    await arm('dan');
    await typePoint('5,0');
    await typePoint('7,0');
    await typePoint('5,2');
    await typePoint('6,0.5');

    await arm('dra');
    await typePoint('4,2');
    await typePoint('5,3');
    await expect(page.getByTestId('dimension-value')).toHaveText('R1.00');
    await expect(page.locator('p').filter({ hasText: /^Radial$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Annotation', exact: true })).toBeVisible();

    await arm('t');
    await typePoint('6,1');
    const annotationEditor = page.getByTestId('annotation-editor');
    await expect(annotationEditor).toBeFocused();
    await annotationEditor.fill('Planta 1:50');
    await annotationEditor.press('Enter');
    await page.getByLabel('Bold').check();
    await expect(page.getByRole('textbox', { name: 'Text' })).toHaveValue('Planta 1:50');

    await page.locator('.konvajs-content').click({ position: { x: 4, y: 4 } });
    await arm('le');
    await typePoint('-6,-2');
    await typePoint('-5,-1');
    await expect(annotationEditor).toBeFocused();
    await annotationEditor.fill('Grid line A');
    await annotationEditor.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Leader text' })).toHaveValue('Grid line A');

    await arm('tb');
    const canvas = page.locator('.konvajs-content');
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('canvas not visible');
    const tablePoint = { x: bounds.x + 450, y: bounds.y + 250 };
    await page.mouse.click(tablePoint.x, tablePoint.y);
    await page.mouse.dblclick(tablePoint.x + 20, tablePoint.y + 20);
    await expect(annotationEditor).toBeFocused();
    await annotationEditor.fill('Item');
    await annotationEditor.press('Enter');

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByText('Annotation', { exact: true }).scrollIntoViewIfNeeded();
    await page.getByLabel('Annotation scale').selectOption('100');
    await page.getByRole('button', { name: 'Duplicate style' }).click();
    await page.getByLabel('Style name').fill('DIM-e2e');
    await page.getByRole('button', { name: 'Save project settings' }).click();
    await page.getByText('DIM-e2e', { exact: true }).scrollIntoViewIfNeeded();

    await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByLabel('Annotation scale')).toHaveValue('100');
    await expect(page.getByText('DIM-e2e', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Home' }).click();
    await arm('elements');
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(10);
    await expect(page.getByText('Dimension', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Leader', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Text', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Table', { exact: true }).first()).toBeVisible();
    const selectRow = async (type: string) => rows.filter({ hasText: type }).first().locator('td').nth(2).click();
    await selectRow('Text');
    await expect(page.getByRole('textbox', { name: 'Text' })).toHaveValue('Planta 1:50');
    await selectRow('Leader');
    await expect(page.getByRole('textbox', { name: 'Leader text' })).toHaveValue('Grid line A');
    await selectRow('Table');
    await arm('2d');
    await page.mouse.dblclick(tablePoint.x + 20, tablePoint.y + 20);
    await expect(annotationEditor).toHaveValue('Item');
  });

  test('commits and autosaves an active text edit when switching views', async ({ page }) => {
    test.setTimeout(90_000);
    await newProject(page);
    const { arm, typePoint } = helpers(page);

    await arm('t');
    await typePoint('6,1');
    const annotationEditor = page.getByTestId('annotation-editor');
    await expect(annotationEditor).toBeFocused();
    await annotationEditor.fill('View switch keeps this text');

    const view3d = page.getByRole('button', { name: '3D', exact: true });
    await view3d.click();
    await expect(view3d).toHaveAttribute('aria-pressed', 'true');
    await expect(annotationEditor).toBeHidden();
    const view2d = page.getByRole('button', { name: '2D', exact: true });
    await view2d.click();
    await expect(view2d).toHaveAttribute('aria-pressed', 'true');

    await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await page.getByRole('button', { name: 'Home' }).click();
    await arm('elements');
    const row = page.locator('tbody tr').filter({ hasText: 'Text' });
    await expect(row).toHaveCount(1);
    await row.locator('td').nth(2).click();
    await expect(page.getByRole('textbox', { name: 'Text' })).toHaveValue('View switch keeps this text');
  });

});
