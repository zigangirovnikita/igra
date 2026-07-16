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
  await page.getByRole('button', { name: 'Готово' }).click();
  await page.getByRole('button', { name: 'Цель ясна' }).click();
  await page.getByRole('button', { name: 'Понятно!' }).click();
  await expect(page.getByRole('heading', { name: 'Меню рефлексии' })).toBeVisible();
}

async function forceTerminalActiveStage(page: Page) {
  await page.evaluate(async () => {
    const cachedRaw = localStorage.getItem('launch-game-cache');
    if (!cachedRaw) throw new Error('Missing cached session');
    const cached = JSON.parse(cachedRaw) as { sessionId: string };
    let state = await fetchState(cached.sessionId);

    async function command(type: string, payload: Record<string, unknown> = {}) {
      const response = await fetch(`/api/game/sessions/${cached.sessionId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandId: `e2e_${type}_${crypto.randomUUID()}`,
          expectedVersion: state.stateVersion,
          type,
          payload,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? data.error ?? `Command failed: ${type}`);
      state = data.state;
    }

    await command('v3_begin_action_plan');
    await command('v3_select_active', { kind: 'ad', key: 'ad:unprepared' });
    await command('v3_select_active', { kind: 'warmup', key: 'warmup:manual' });
    await command('v3_select_active', { kind: 'sales', key: 'sales:intuition' });
    await command('v3_start_active_stage');
    await command('v3_next');
    await command('v3_complete_active_stage', {
      manualAnswers: 200,
      directSalesChats: 200,
      postCallChats: 200,
      salesChats: 200,
      calls: 60,
    });

    async function fetchState(sessionId: string) {
      const response = await fetch(`/api/game/sessions/${sessionId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to fetch state');
      return data.state;
    }
  });
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

test('terminal v3 run reaches final diagnosis and lead form', async ({ page }) => {
  await completeOnboarding(page);
  await forceTerminalActiveStage(page);
  await page.reload();
  await page.getByRole('button', { name: 'Продолжить' }).click();

  await expect(page.getByRole('heading', { name: /Активный этап №1 завершен/ })).toBeVisible();
  await page.getByRole('button', { name: 'Смотреть итог запуска' }).click();
  await expect(page.getByRole('heading', { name: 'Вы выгорели' })).toBeVisible();

  await page.getByRole('button', { name: 'Посмотреть итоги' }).click();
  await expect(page.getByText('Источник объяснения')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Подробнее про реальный разбор' }).click();
  await expect(page.getByRole('heading', { name: 'Получить бесплатную консультацию' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отправить заявку' })).toBeVisible();
});

test('layout remains usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Начать игру' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
