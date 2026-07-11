import { expect, test, type Page } from '@playwright/test';

async function completeOnboarding(page: Page) {
  // 1. Setup Phase
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать →' }).click();
  await page.getByRole('button', { name: '👩 Женщина' }).click();
  await page.getByPlaceholder('Например: Марина').fill('Марина');
  await page.getByRole('button', { name: 'Дальше →' }).click();
  await page.getByPlaceholder(/Психолог/).fill('Обучение вышивке');
  await page.getByRole('button', { name: 'Начать историю →' }).click();

  // 2. Intro Phase
  await page.getByRole('button', { name: 'Дальше →' }).click();
  await page.getByRole('button', { name: 'Начать первый день' }).click();

  // 3. Day 1 Phase
  // day1_product_type
  await page.getByRole('button', { name: 'Консультации' }).click();
  await page.getByRole('button', { name: 'Дальше →' }).click();
  // day1_product_name
  await page.locator('input').fill('Мой продукт'); // InputScreen default placeholder is "..."
  await page.getByRole('button', { name: 'Дальше' }).click();
  // day1_product_price
  await page.locator('input').fill('5000');
  await page.getByRole('button', { name: 'Дальше' }).click();
  // day1_sale_method
  await page.getByRole('button', { name: 'В переписке' }).click();
  await page.getByRole('button', { name: 'Дальше →' }).click();
  // day1_nurture
  await page.getByRole('button', { name: 'Нет, сразу приглашать' }).click();
  await page.getByRole('button', { name: 'Дальше →' }).click();
  // day1_entry_point
  await page.getByRole('button', { name: 'Напишет в директ' }).click();
  await page.getByRole('button', { name: 'Дальше →' }).click();
  // day1_business_goal
  await page.getByRole('button', { name: 'Цель понятна' }).click();
  // day1_dreams
  await page.locator('.scene-choice-btn').first().click(); // changed from setup-dream-btn to scene-choice-btn
  await page.getByRole('button', { name: 'Дальше →' }).click();

  // day1 finish
  await page.getByRole('button', { name: 'Завершить первый день' }).click();

  // Day 2
  await page.getByRole('button', { name: 'Посмотреть свои ресурсы' }).click(); // day2_audience_intro
  await page.getByRole('button', { name: 'Telegram' }).click(); // day2_audience_channels
  await page.getByRole('button', { name: 'Дальше →' }).click();
  await page.locator('input').fill('100'); // day2_telegram_views
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Начать запуск' }).click();
  await expect(page.getByRole('heading', { name: 'День 3' })).toBeVisible();
}

test('home and health endpoints respond', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Проживи 30 дней запуска/ })).toBeVisible();
  expect((await request.get('/api/health/live')).ok()).toBe(true);
  expect((await request.get('/api/health/ready')).ok()).toBe(true);
});

test('mobile onboarding reaches initial plan with persistent HUD', async ({ page }) => {
  await completeOnboarding(page);
  await expect(page.locator('.game-hud')).toContainText('День');
  await expect(page.locator('.game-hud')).toContainText('Банк');
  await expect(page.locator('.game-hud')).toContainText('Энергия');
});

test('reload offers canonical session resume', async ({ page }) => {
  await completeOnboarding(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Продолжить запуск?' })).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByRole('heading', { name: 'День 3' })).toBeVisible();
});

test('layout remains usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Начать →' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
