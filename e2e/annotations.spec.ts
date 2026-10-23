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

  test('captures Spanish annotation screenshots on a fresh project', async ({ page }) => {
    test.setTimeout(240_000);
    await newProject(page, 'es');
    const { arm, typePoint } = helpers(page);
    const fit = () => page.getByRole('button', { name: 'Ajustar', exact: true }).click();

    for (const [start, end] of [
      ['2,2', '7,2'],
      ['7,2', '7,6'],
      ['7,6', '2,6'],
      ['2,6', '2,2'],
    ]) {
      await arm('line');
      await typePoint(start);
      await typePoint(end);
    }
    await arm('circle');
    await typePoint('4.5,4');
    await typePoint('0.7');

    await arm('dli');
    await typePoint('2,2');
    await typePoint('7,2');
    await typePoint('4.5,1.5');
    await arm('dal');
    await typePoint('2,2');
    await typePoint('7,6');
    await typePoint('3,5.5');
    await arm('dan');
    await typePoint('7,2');
    await typePoint('2,2');
    await typePoint('7,6');
    await typePoint('6,3');
    await arm('dra');
    await typePoint('5.2,4');
    await typePoint('6,4.8');
    await expect(page.getByTestId('dimension-value')).toHaveText('R0.70');
    await fit();
    await page.screenshot({ path: '/home/ubuntu/week11/shot-dimensions.png' });

    await arm('t');
    await typePoint('2,7.5');
    const annotationEditor = page.getByTestId('annotation-editor');
    await expect(annotationEditor).toBeFocused();
    await annotationEditor.fill('Planta 1:50');
    await annotationEditor.press('Enter');
    await page.getByLabel('Negrita').check();
    const textHeight = page.getByLabel('Altura de texto (mm)');
    await textHeight.fill('4');
    await textHeight.press('Enter');
    await page.locator('.konvajs-content').click({ position: { x: 10, y: 10 } });
    await arm('le');
    await typePoint('7,6.5');
    await typePoint('8,7');
    await expect(annotationEditor).toBeFocused();
    await annotationEditor.fill('Eje A');
    await annotationEditor.press('Enter');
    await fit();
    await page.screenshot({ path: '/home/ubuntu/week11/shot-text-leader.png' });

    const canvas = page.locator('.konvajs-content');
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('canvas not visible');
    const tablePoint = { x: bounds.x + 100, y: bounds.y + 650 };
    await arm('tb');
    await page.mouse.click(tablePoint.x, tablePoint.y);
    const zoomText = await page.locator('header span.w-12').textContent();
    const zoom = Number.parseFloat(zoomText ?? '100') / 100;
    const cellWidth = 120 * zoom;
    const cellHeight = 30 * zoom;
    const editCell = async (row: number, col: number, value: string) => {
      await page.mouse.dblclick(
        tablePoint.x + col * cellWidth + 20,
        tablePoint.y + row * cellHeight + 20,
      );
      await expect(annotationEditor).toBeFocused();
      await annotationEditor.fill(value);
      await annotationEditor.press('Enter');
    };
    await editCell(0, 0, 'Elemento');
    await editCell(0, 1, 'Cantidad');
    await editCell(0, 2, 'Unidad');
    await editCell(1, 0, 'Muro');
    await editCell(1, 1, '4');
    await editCell(1, 2, 'm');
    await editCell(2, 0, 'Círculo');
    await editCell(2, 1, '1');
    await editCell(2, 2, 'ud');
    await fit();
    await page.screenshot({ path: '/home/ubuntu/week11/shot-table.png' });

    await page.getByRole('button', { name: 'Configuración' }).first().click();
    const annotationSection = page.getByText('Anotación', { exact: true }).last();
    await annotationSection.evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await expect(page.getByLabel('Escala de anotación')).toHaveValue('50');
    await expect(page.getByText('ISO-25', { exact: true })).toBeVisible();
    await page.screenshot({ path: '/home/ubuntu/week11/shot-annotation-settings.png' });
  });
});
