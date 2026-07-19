import { expect, test, type Page } from '@playwright/test';

async function startV4Game(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать' }).click();
  await page.getByRole('button', { name: 'Девочка' }).click();
  await page.locator('input').fill('Марина');
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button').filter({ hasText: 'Новый iPhone' }).click();
  await page.getByRole('button', { name: 'Услуга' }).click();
  await page.locator('input').fill('30000');
  await page.getByRole('button', { name: 'Готово' }).click();
}

async function finishTutorialFast(page: Page) {
  await page.getByRole('button', { name: 'Запустить пробу' }).click();
  await expect(page.getByRole('heading', { name: 'Учебный запуск' })).toBeVisible();
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole('button', { name: /Проведи созвон|Ответь|Продай/ }).click();
  }
  await page.evaluate(async () => {
    const cachedRaw = localStorage.getItem('launch-game-cache');
    if (!cachedRaw) throw new Error('Missing cached session');
    const cached = JSON.parse(cachedRaw) as { sessionId: string };
    const stateResponse = await fetch(`/api/game/sessions/${cached.sessionId}`);
    const stateData = await stateResponse.json();
    const response = await fetch(`/api/game/sessions/${cached.sessionId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId: `e2e_v4_finish_${crypto.randomUUID()}`,
        expectedVersion: stateData.state.stateVersion,
        type: 'v4_finish_attempt',
        payload: { manualActions: 4 },
      }),
    });
    if (!response.ok) throw new Error(await response.text());
  });
  await page.reload();
  await page.getByRole('button', { name: 'Продолжить' }).click();
}

test('home and health endpoints respond', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /какая воронка заработает/i })).toBeVisible();
  expect((await request.get('/api/health/live')).ok()).toBe(true);
  expect((await request.get('/api/health/ready')).ok()).toBe(true);
});

test('v4 onboarding reaches tutorial attempt', async ({ page }) => {
  await startV4Game(page);
  await expect(page.getByRole('heading', { name: 'Сначала короткая пробная попытка' })).toBeVisible();
  await expect(page.getByText('Внешняя реклама', { exact: true })).toBeVisible();
});

test('reload offers canonical session resume in v4', async ({ page }) => {
  await startV4Game(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Продолжить запуск?' })).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByRole('heading', { name: 'Сначала короткая пробная попытка' })).toBeVisible();
});

test('v4 tutorial result opens builder and lead CTA', async ({ page }) => {
  await startV4Game(page);
  await finishTutorialFast(page);
  await expect(page.getByText(/На мечту пока не заработали|Мечту купить можно|Вы купили мечту/)).toBeVisible();
  await page.getByRole('button', { name: 'Сыграть еще раз' }).click();
  await expect(page.getByRole('heading', { name: 'Соберите воронку' })).toBeVisible();
});

test('layout remains usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Начать' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
