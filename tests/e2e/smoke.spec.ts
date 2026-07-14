import { expect, test, type Page } from '@playwright/test';

async function completeOnboarding(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать игру' }).click();
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByRole('button', { name: 'Женщина' }).click();
  await page.locator('input').fill('Марина');
  await page.getByRole('button', { name: 'Готово, дальше' }).click();
  await page.locator('input').fill('Эксперт по запускам');
  await page.getByRole('button', { name: 'Готово, дальше' }).click();
  await page.getByRole('button').filter({ hasText: 'Продажи' }).click();
  await page.getByRole('button', { name: 'Готово, дальше' }).click();
  await page.getByRole('button', { name: 'Начать сюжет!' }).click();

  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByRole('button', { name: 'Правила ясны!' }).click();
  await page.getByRole('button', { name: 'Хорошо' }).click();
  await page.getByRole('button', { name: 'Услуги' }).click();
  await page.locator('input').fill('15000');
  await page.getByRole('button', { name: 'Готово, дальше' }).click();
  await page.getByRole('button').filter({ hasText: 'Новый айфон' }).click();
  await page.getByRole('button', { name: 'Цель ясна' }).click();
  await page.getByRole('button', { name: 'Понятно!' }).click();
  await expect(page.getByRole('heading', { name: 'Меню рефлексии' })).toBeVisible();
}

test('home and health endpoints respond', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Проживи 30 дней запуска/ })).toBeVisible();
  expect((await request.get('/api/health/live')).ok()).toBe(true);
  expect((await request.get('/api/health/ready')).ok()).toBe(true);
});

test('mobile onboarding reaches initial plan with persistent HUD', async ({ page }) => {
  await completeOnboarding(page);
  await expect(page.getByText('День')).toBeVisible();
  await expect(page.getByText('Банк')).toBeVisible();
  await expect(page.getByText('Энергия')).toBeVisible();
});

test('reload offers canonical session resume', async ({ page }) => {
  await completeOnboarding(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Продолжить запуск?' })).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByRole('heading', { name: 'Меню рефлексии' })).toBeVisible();
});

test('layout remains usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Начать игру' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
