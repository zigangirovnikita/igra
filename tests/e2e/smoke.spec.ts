import { expect, test, type Page } from '@playwright/test';

async function completeOnboarding(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать →' }).click();
  await page.getByRole('button', { name: '👩 Женщина' }).click();
  await page.getByPlaceholder('Например: Марина').fill('Марина');
  await page.getByRole('button', { name: 'Дальше →' }).click();
  await page.getByPlaceholder(/Психолог/).fill('Обучение вышивке');
  await page.getByRole('button', { name: 'Дальше →' }).click();
  await page.getByRole('button', { name: /Экспертность/ }).click();
  await page.getByRole('button', { name: /Энергия/ }).click();
  await page.getByRole('button', { name: 'Дальше →' }).click();
  await page.getByRole('button', { name: 'Обучение в записи' }).click();
  await page.getByPlaceholder(/обучение вышиванию/).fill('Курс вышивки крестиком');
  await page.getByRole('button', { name: 'Дальше →' }).click();
  await page.getByRole('button', { name: 'Дальше →' }).click();
  await page.getByRole('button', { name: 'Детей нет, партнёр есть' }).click();
  await page.locator('.setup-dream-btn').first().click();
  await page.getByRole('button', { name: 'Дальше →' }).click();
  while (await page.locator('.setup-step--legend').count()) await page.locator('.setup-step--legend').click();
  await page.getByRole('button', { name: '📱 + ✈️ Instagram + Telegram' }).click();
  await page.getByRole('button', { name: 'Дальше →' }).click();
  await page.getByRole('button', { name: 'Дальше →' }).click();
  await page.getByRole('button', { name: 'Начать запуск →' }).click();
}

test('home and health endpoints respond', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Проживи 30 дней запуска/ })).toBeVisible();
  expect((await request.get('/api/health/live')).ok()).toBe(true);
  expect((await request.get('/api/health/ready')).ok()).toBe(true);
});

test('mobile onboarding reaches initial plan with persistent HUD', async ({ page }) => {
  await completeOnboarding(page);
  await expect(page.getByRole('heading', { name: 'Где будете брать людей?' })).toBeVisible();
  await expect(page.locator('.game-hud')).toContainText('День');
  await expect(page.locator('.game-hud')).toContainText('Банк');
  await expect(page.locator('.game-hud')).toContainText('Энергия');
});

test('reload offers canonical session resume', async ({ page }) => {
  await completeOnboarding(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Продолжить запуск?' })).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.locator('.choice-question')).toBeVisible();
});

test('layout remains usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Начать →' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
