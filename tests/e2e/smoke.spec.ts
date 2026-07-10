import { expect, test } from '@playwright/test';

test('home and health endpoints respond', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Проживи 30 дней запуска/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Начать игру' })).toBeVisible();

  const live = await request.get('/api/health/live');
  expect(live.ok()).toBe(true);

  const ready = await request.get('/api/health/ready');
  expect(ready.ok()).toBe(true);
});

test('playable flow reaches final report and honest lead error', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать игру' }).click();
  await page.getByRole('button', { name: 'Старт' }).click();
  await expect(page.getByRole('heading', { name: 'Действия' })).toBeVisible();

  await page.getByRole('button', { name: /Предложить пилот/ }).click();
  await expect(page.getByText(/Завершено действие/)).toBeVisible();
  await page.getByRole('button', { name: /Дойти до финала/ }).click();
  await expect(page.getByRole('button', { name: 'Разобрать мой запуск' })).toBeVisible();

  await page.getByRole('button', { name: 'Разобрать мой запуск' }).click();
  await page.getByLabel('Контакт').fill('@test');
  await page.getByLabel(/Согласие на обработку/).check();
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(page.getByRole('status')).toContainText(/не доставлена|webhook/);
});
