import { expect, test } from '@playwright/test';

test('home and health endpoints respond', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Проживи 30 дней запуска/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Начать →' })).toBeVisible();

  const live = await request.get('/api/health/live');
  expect(live.ok()).toBe(true);

  const ready = await request.get('/api/health/ready');
  expect(ready.ok()).toBe(true);
});

test('playable flow reaches final report and honest lead error', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать →' }).click();
  
  // Gender
  await page.getByRole('button', { name: '👩 Женщина' }).click();
  // Name
  await page.getByPlaceholder('Например: Марина').fill('Тест');
  await page.getByRole('button', { name: 'Дальше →' }).click();
  // Niche
  await page.getByPlaceholder('Психолог').fill('QA');
  await page.getByRole('button', { name: 'Дальше →' }).click();
  // Superpowers
  const spButtons = await page.locator('.setup-grid-2 button').all();
  await spButtons[0].click();
  await spButtons[1].click();
  await page.getByRole('button', { name: 'Дальше →' }).click();
  // Product
  await page.getByRole('button', { name: 'Консультации' }).click();
  // Price
  await page.getByRole('button', { name: 'Дальше →' }).click();
  // Family
  await page.getByRole('button', { name: 'Детей нет, партнёр есть' }).click();
  // Legend
  while (await page.locator('.setup-step--legend').count() > 0) {
    await page.locator('.setup-step--legend').click();
    await page.waitForTimeout(200);
  }
  // Dreams
  const dreamButtons = await page.locator('.setup-dream-btn').all();
  await dreamButtons[0].click();
  await page.getByRole('button', { name: 'Дальше →' }).click();
  // Channels
  await page.getByRole('button', { name: 'Дальше →' }).click();
  // Reach
  await page.getByRole('button', { name: 'Дальше →' }).click();
  // Summary
  await page.getByRole('button', { name: 'Начать запуск →' }).click();

  // Intro narrative screens
  await page.waitForSelector('.narrative-body');
  while (await page.locator('.narrative-body').count() > 0) {
    await page.locator('.narrative-body').first().click();
    await page.waitForTimeout(200);
  }

  // Now we are in the game.
  await expect(page.locator('.choice-question')).toBeVisible();

  // When we click an action, we might see narrative screens before the result
  await page.locator('.choice-card:not(.choice-card--finish)').first().click();
  
  // Action narrative screens
  await page.waitForSelector('.narrative-body');
  while (await page.locator('.narrative-body').count() > 0) {
    await page.locator('.narrative-body').first().click();
    await page.waitForTimeout(200);
  }

  // Wait for result screen
  await page.waitForSelector('.result-body');
  await page.getByRole('button', { name: 'Посмотреть показатели →' }).click();

  // Wait for metrics screen
  await page.waitForSelector('.metrics-card');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  
  await expect(page.locator('.choice-question')).toBeVisible();
  await page.getByRole('button', { name: /Завершить/ }).click();
  
  // Final narrative screens
  await page.waitForSelector('.narrative-body');
  while (await page.locator('.narrative-body').count() > 0) {
    await page.locator('.narrative-body').first().click();
    await page.waitForTimeout(200);
  }

  await expect(page.getByRole('button', { name: 'Разобрать мой запуск' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Разобрать мой запуск' }).first().click();
  await page.getByLabel('Telegram / телефон').fill('@test');
  await page.locator('input[name="privacyConsent"]').check();
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
  await expect(page.locator('.lead-error')).toContainText(/не доставлена|webhook/);
});
