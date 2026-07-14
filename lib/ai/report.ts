import { z } from 'zod';
import type { Diagnostics, GameState } from '@/packages/game-engine/src';

export const aiReportSchema = z.object({
  headline: z.string(),
  resultSummary: z.string(),
  goalComment: z.string(),
  strongDecisions: z.array(z.object({ title: z.string(), explanation: z.string() })),
  bottlenecks: z.array(z.object({ title: z.string(), explanation: z.string(), estimatedLoss: z.string().nullable() })),
  energyComment: z.string(),
  counterfactualSummary: z.string(),
  alternativeActions: z.array(z.object({ change: z.string(), potentialResult: z.string(), why: z.string() })),
  finalInsight: z.string(),
  ctaBridge: z.string()
});

export type AiReport = z.infer<typeof aiReportSchema>;

export function buildFallbackReport(state: GameState, diagnostics: Diagnostics): AiReport {
  const money = new Intl.NumberFormat('ru-RU').format;
  const statusTitle = diagnostics.finalStatus === 'business_goal_reached'
    ? 'Бизнес-цель достигнута'
    : diagnostics.finalStatus === 'zero_revenue'
      ? 'Запуск дал нулевую выручку'
      : 'Запуск дал данные для усиления';

  return {
    headline: statusTitle,
    resultSummary: `По модели игры вы получили ${state.metrics.sales} продаж на ${money(state.metrics.revenue)} ₽ выручки.`,
    goalComment: `Цель: ${state.targets.targetSales} продаж и ${money(state.targets.targetRevenue)} ₽ выручки.`,
    strongDecisions: diagnostics.strongDecisions.map((title) => ({
      title,
      explanation: 'Это решение усилило маршрут запуска в расчёте игры.'
    })),
    bottlenecks: diagnostics.bottlenecks.map((item) => ({
      title: lossTitle(item.category),
      explanation: 'Здесь модель увидела наибольшую потенциальную потерю денег или заявок.',
      estimatedLoss: item.expectedLoss > 0 ? `около ${money(Math.round(item.expectedLoss))} ₽` : null
    })),
    energyComment: state.resources.energy < 30
      ? 'Энергия ниже 30: такой темп трудно повторять второй месяц без отдыха или делегирования.'
      : 'Энергии достаточно, запуск выглядит повторяемым по темпу.',
    counterfactualSummary: diagnostics.counterfactuals.length
      ? 'Есть несколько честных альтернатив, которые могли улучшить результат.'
      : state.endingReason === 'manual_finished'
        ? 'Запуск завершён досрочно, поэтому модель не сравнивала полный цикл альтернатив.'
        : 'Положительных независимых альтернатив по модели игры не найдено.',
    alternativeActions: diagnostics.counterfactuals.length ? diagnostics.counterfactuals.map((item) => ({
      change: item.change,
      potentialResult: `Потенциальный прирост прибыли: около ${money(Math.round(item.expectedProfitDelta))} ₽.`,
      why: 'Сравнение использует тот же seed и меняет одно ключевое решение.'
    })) : buildNextSteps(state, diagnostics),
    finalInsight: 'Сайт, бот и контент работают только как связанная система: трафик, вход, прогрев, обработка и продажа должны совпасть по времени.',
    ctaBridge: 'Разбор поможет найти, где в вашем реальном запуске теряются заявки и деньги.'
  };
}

function buildNextSteps(state: GameState, diagnostics: Diagnostics): AiReport['alternativeActions'] {
  const steps: AiReport['alternativeActions'] = [];
  const categories = new Set(diagnostics.bottlenecks.map((item) => item.category));
  if (categories.has('traffic')) {
    steps.push({ change: 'Сначала усилить входящий трафик', potentialResult: 'Набрать достаточно входящих для проверки всей воронки.', why: 'Сейчас главный риск находится на этапе привлечения людей.' });
  }
  if (categories.has('processing')) {
    steps.push({ change: 'Настроить обработку входящих', potentialResult: 'Не терять заявки до следующего шага.', why: 'Часть людей остаётся без ответа или не доходит до продажи.' });
  }
  if (categories.has('warmup')) {
    steps.push({ change: 'Усилить прогрев', potentialResult: 'Переводить больше лидов в заявки.', why: 'Слабое место находится между первым интересом и готовностью к продаже.' });
  }
  if (categories.has('sales')) {
    steps.push({ change: 'Подготовить продажи', potentialResult: 'Повысить конверсию заявок в оплату.', why: 'Заявки уже доходят до продажи, но часть людей не покупает.' });
  }
  if (state.activeRoute.nurture.includes('none')) {
    steps.push({ change: 'Добавить прогрев перед продажей', potentialResult: 'Подготовить человека к приглашению или покупке.', why: 'Сейчас маршрут ведёт к продаже без отдельного этапа доверия.' });
  }
  if (steps.length === 0) {
    steps.push({ change: 'Повторить запуск с одним улучшением', potentialResult: 'Понять влияние решения без смешивания причин.', why: 'Меняйте один слабый этап воронки за раз и сравнивайте результат.' });
  }
  return steps.slice(0, 3);
}

export async function explainWithAi(state: GameState, diagnostics: Diagnostics): Promise<{ report: AiReport; source: 'ai' | 'fallback' }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_REPORT_MODEL;
  if (!apiKey || !model) return { report: buildFallbackReport(state, diagnostics), source: 'fallback' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const request = () => fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        input: [
          {
            role: 'system',
            content: 'Ты маркетинговый аналитик симулятора запуска. Используй только переданный JSON, не придумывай цифры, верни JSON.'
          },
          { role: 'user', content: JSON.stringify({ diagnostics, metrics: state.metrics, targets: state.targets }) }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'launch_game_report',
            strict: true,
            schema: aiReportJsonSchema
          }
        }
      })
    });
    let response = await request();
    if (response.status === 429 || response.status >= 500) response = await request();
    if (!response.ok) throw new Error(`OpenAI status ${response.status}`);
    const data = await response.json() as ResponsesPayload;
    const raw = extractOutputText(data);
    if (!raw) throw new Error('Missing output_text');
    return { report: aiReportSchema.parse(JSON.parse(raw)), source: 'ai' };
  } catch {
    return { report: buildFallbackReport(state, diagnostics), source: 'fallback' };
  } finally {
    clearTimeout(timeout);
  }
}

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const aiReportJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'resultSummary', 'goalComment', 'strongDecisions', 'bottlenecks', 'energyComment', 'counterfactualSummary', 'alternativeActions', 'finalInsight', 'ctaBridge'],
  properties: {
    headline: { type: 'string' },
    resultSummary: { type: 'string' },
    goalComment: { type: 'string' },
    strongDecisions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'explanation'], properties: { title: { type: 'string' }, explanation: { type: 'string' } } } },
    bottlenecks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'explanation', 'estimatedLoss'], properties: { title: { type: 'string' }, explanation: { type: 'string' }, estimatedLoss: { type: ['string', 'null'] } } } },
    energyComment: { type: 'string' },
    counterfactualSummary: { type: 'string' },
    alternativeActions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['change', 'potentialResult', 'why'], properties: { change: { type: 'string' }, potentialResult: { type: 'string' }, why: { type: 'string' } } } },
    finalInsight: { type: 'string' },
    ctaBridge: { type: 'string' }
  }
};

function lossTitle(category: string): string {
  const titles: Record<string, string> = {
    processing: 'Обработка входящих',
    capacity: 'Вместимость продукта',
    energy: 'Энергия',
    traffic: 'Трафик',
    warmup: 'Прогрев',
    sales: 'Продажи',
    preparation: 'Подготовка',
  };
  return titles[category] ?? category;
}

function extractOutputText(payload: ResponsesPayload): string | undefined {
  if (payload.output_text) return payload.output_text;
  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((text): text is string => Boolean(text));
}
