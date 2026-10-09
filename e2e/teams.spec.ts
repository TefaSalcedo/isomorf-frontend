import { expect, test } from '@playwright/test';
import { disposableUser, registerViaUi } from './helpers';

test.describe('teams', () => {
  test('owner creates a team, shares a project and a viewer joins via invite link', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    await registerViaUi(owner, disposableUser());

    const projectName = `Shared Project ${Date.now()}`;
    await owner.getByRole('button', { name: 'New', exact: true }).click();
    await owner.locator('input[name="name"]').fill(projectName);
    await owner.getByRole('button', { name: 'Create project' }).click();
    await expect(owner).toHaveURL(/\/projects\//);

    await owner.goto('/teams');
    const teamName = `Team ${Date.now()}`;
    await owner.getByLabel('Team name').fill(teamName);
    await owner.getByRole('button', { name: 'Create team' }).click();
    await expect(owner).toHaveURL(/\/teams\/[^/]+$/);
    await expect(owner.getByRole('heading', { name: teamName })).toBeVisible();

    await owner.getByLabel('Choose one of your projects').selectOption({ label: projectName });
    await owner.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(owner.getByRole('link', { name: projectName })).toBeVisible();

    await owner.getByLabel('Role').selectOption('viewer');
    await owner.getByRole('button', { name: 'Generate invite link' }).click();
    const inviteUrl = await owner.getByTestId('invite-link').inputValue();
    expect(inviteUrl).toContain('/invites/');
    const invitePath = new URL(inviteUrl).pathname;
    await ownerContext.close();

    const viewerContext = await browser.newContext();
    const viewer = await viewerContext.newPage();
    await viewer.goto(invitePath);
    await expect(viewer.getByRole('link', { name: 'Sign in to accept' })).toBeVisible();
    await viewer.getByRole('link', { name: 'Create an account' }).click();
    const viewerUser = disposableUser();
    await viewer.locator('input[name="first_name"]').fill(viewerUser.firstName);
    await viewer.locator('input[name="last_name"]').fill(viewerUser.lastName);
    await viewer.locator('input[name="email"]').fill(viewerUser.email);
    await viewer.locator('input[name="password"]').fill(viewerUser.password);
    await viewer.locator('input[type="checkbox"]').check();
    await viewer.getByRole('button', { name: 'Create account and start free' }).click();

    await expect(viewer).toHaveURL(new RegExp(invitePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await viewer.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(viewer).toHaveURL(/\/teams\/[^/]+$/);
    await expect(viewer.getByRole('heading', { name: teamName })).toBeVisible();
    await expect(viewer.getByText('Leave team')).toBeVisible();

    await viewer.goto('/dashboard');
    await expect(viewer.getByText(projectName)).toBeVisible();
    await expect(viewer.getByText('Shared · Viewer')).toBeVisible();
    await viewer.getByText(projectName).click();
    await expect(viewer.getByTestId('read-only-banner')).toBeVisible();
    await viewerContext.close();
  });
});
