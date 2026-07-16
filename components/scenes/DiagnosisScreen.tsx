'use client';

import { useState } from 'react';
import { getV3AttemptInsight, type Diagnostics, type GameState } from '@/packages/game-engine/src';
import type { AiReport } from '@/lib/ai/report';

type Props = {
  state: GameState;
  diagnostics: Diagnostics;
  aiReport: AiReport;
  onRestart: () => void;
  onLead: () => void;
};

type Tab = 'summary' | 'diagnosis';

export function DiagnosisScreen({ state, diagnostics, aiReport, onRestart, onLead }: Props) {
  const [tab, setTab] = useState<Tab>('summary');
  const formatMoney = (value: number) => `${value.toLocaleString('ru-RU')} ₽`;
  const startingBank = diagnostics.financials.bankRemaining + diagnostics.financials.expenses;
  const productPrice = state.launchPlan.productPrice ?? 0;
  const attemptInsights = state.v3.stageReports.map((report) => getV3AttemptInsight(report, productPrice, {
    productType: state.v3.productType,
    productName: state.launchPlan.productName,
    productPrice,
  }));
  const missedRevenue = attemptInsights.reduce((sum, item) => sum + item.missedRevenue, 0);
  const worstInsight = attemptInsights.find((item) => item.severity === 'danger') ?? attemptInsights.find((item) => item.severity === 'warning') ?? attemptInsights[0];
  const gameResult = buildGameResult(state, diagnostics, formatMoney);
  const dreamSummary = buildDreamSummary(diagnostics, formatMoney);
  const strongDecisionItems = buildStrongDecisionItems(state, aiReport);
  const bottleneckItems = buildBottleneckItems(state, diagnostics, aiReport, formatMoney);
  const launchPath = buildLaunchPath(state, formatMoney);

  return (
    <div className="scene-screen diagnosis-screen scrollable">
      <h1 className="diagnosis-main-title">Игра была завершена.</h1>

      <section className={`diagnosis-final-result diagnosis-final-result--${gameResult.kind}`}>
        <span>{gameResult.badge}</span>
        <strong>{gameResult.title}</strong>
        <p>{gameResult.reason}</p>
      </section>

      <div className="diagnosis-scoreboard" aria-label="Итоги игры">
        <div>
          <span>Продажи</span>
          <strong>{state.metrics.sales} / {state.targets.targetSales}</strong>
        </div>
        <div>
          <span>Выручка</span>
          <strong>{formatMoney(state.metrics.revenue)}</strong>
          <em>цель {formatMoney(state.targets.targetRevenue)}</em>
        </div>
        <div>
          <span>День</span>
          <strong>{Math.min(state.resources.day, 30)} / 30</strong>
        </div>
        <div>
          <span>Энергия</span>
          <strong>{state.resources.energy}%</strong>
        </div>
      </div>

      <section className="diagnosis-simple-card">
        <h2>Что это значит</h2>
        <p>{gameResult.summary}</p>
      </section>

      <section className="diagnosis-simple-card">
        <h2>Мечты</h2>
        <DreamResultList diagnostics={diagnostics} formatMoney={formatMoney} summary={dreamSummary} />
      </section>

      <section className="diagnosis-simple-card diagnosis-simple-card--accent">
        <h2>Главный вывод</h2>
        <p>{worstInsight?.recommendation ?? aiReport.finalInsight}</p>
        {missedRevenue > 0 && <strong>Потенциал улучшения: около {formatMoney(missedRevenue)}</strong>}
      </section>

      <section className="diagnosis-tab-panel">
        <div role="tablist" aria-label="Разделы диагностики" className="diagnosis-tabs">
          <button className={`diagnosis-tab${tab === 'summary' ? ' diagnosis-tab--active' : ''}`} role="tab" aria-selected={tab === 'summary'} onClick={() => setTab('summary')}>Итог</button>
          <button className={`diagnosis-tab${tab === 'diagnosis' ? ' diagnosis-tab--active' : ''}`} role="tab" aria-selected={tab === 'diagnosis'} onClick={() => setTab('diagnosis')}>Диагностика</button>
        </div>

        <div className="diagnosis-tab-content">
          {tab === 'summary' && (
            <section role="tabpanel">
              <Card title="Финансы">
                <p>Стартовый банк: {formatMoney(startingBank)}</p>
                <p>Потрачено из банка: {formatMoney(diagnostics.financials.expenses)}</p>
                <p>Остаток банка: {formatMoney(diagnostics.financials.bankRemaining)}</p>
                <p>Выручка: {formatMoney(diagnostics.financials.revenue)}</p>
                <p>Прибыль запуска: {formatMoney(diagnostics.financials.launchProfit)}</p>
                <p><strong>Всего доступно после запуска: {formatMoney(diagnostics.financials.totalLiquidity)}</strong></p>
                <p>Продажи: {state.metrics.sales} из цели {state.targets.targetSales}</p>
              </Card>

              <Card title="Комментарий к цели"><p>{aiReport.goalComment}</p></Card>
              <Card title="Энергия"><p>{aiReport.energyComment}</p></Card>

              {state.v3.stageReports.length > 0 && (
                <Card title="Разбор попыток">
                  <div className="diagnosis-attempts">
                    {state.v3.stageReports.map((report, index) => {
                      const insight = attemptInsights[index];
                      return (
                        <div className={`diagnosis-attempt-row diagnosis-attempt-row--${insight.severity}`} key={report.id}>
                          <span>Попытка №{report.stageNumber}</span>
                          <strong>{insight.headline}</strong>
                          <em>{insight.lossLabel}</em>
                          <p>{insight.recommendation}</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </section>
          )}

          {tab === 'diagnosis' && (
            <section role="tabpanel">
              <Card title="Сильные решения">
                {strongDecisionItems.length === 0 ? <p>Выраженных сильных решений не найдено.</p> : (
                  <ul>{strongDecisionItems.map((item) => <li key={item.title}><strong>{item.title}.</strong> {item.text}</li>)}</ul>
                )}
              </Card>

              <Card title="Узкие места">
                {bottleneckItems.length === 0 ? <p>Крупных узких мест не найдено.</p> : (
                  <ul>{bottleneckItems.map((item) => <li key={item.title}><strong>{item.title}.</strong> {item.text}</li>)}</ul>
                )}
              </Card>

              <Card title="Ошибки">
                {diagnostics.mistakes.length === 0 ? <p>Критичных ошибок модель не нашла.</p> : (
                  <ul>{diagnostics.mistakes.map((mistake, index) => <li key={`${mistake.day}-${index}`}>День {mistake.day}: {mistake.message}</li>)}</ul>
                )}
              </Card>

              <Card title="Путь запуска">
                {launchPath.map((line) => <p key={line}>{line}</p>)}
              </Card>
            </section>
          )}
        </div>
      </section>

      <div className="diagnosis-footer">
        <div className="scene-paragraph diagnosis-cta-copy">
          <p>Это была просто игра, но она очень ярко показала, что может произойти при реальных продажах вашего продукта.</p>
          <p>Предлагаю созвониться, чтобы разобрать воронку, рекламу и продажи для вашего реального запуска.</p>
          <p>Нажмите "Подробнее про реальный разбор" или сыграйте еще раз!</p>
        </div>
        <div className="scene-actions">
          <button className="btn-primary" onClick={onLead}>Подробнее про реальный разбор</button>
          <button className="btn-secondary" onClick={onRestart}>Начать заново</button>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="diagnosis-card">
      <h2 className="diagnosis-card-title">{title}</h2>
      {children}
    </div>
  );
}

function buildGameResult(
  state: GameState,
  diagnostics: Diagnostics,
  formatMoney: (value: number) => string,
): { kind: 'win' | 'loss' | 'stopped'; badge: string; title: string; reason: string; summary: string } {
  const reachedGoal = state.endingReason === 'goal_finished' || diagnostics.finalStatus === 'business_goal_reached';
  const progress = `Вы сделали ${state.metrics.sales} из ${state.targets.targetSales} продаж и заработали ${formatMoney(state.metrics.revenue)} из ${formatMoney(state.targets.targetRevenue)}.`;

  if (reachedGoal) {
    return {
      kind: 'win',
      badge: 'ПОБЕДА',
      title: 'Вы выиграли игру.',
      reason: 'Цель запуска выполнена.',
      summary: `${progress} Цель закрыта, теперь можно смотреть, какая связка сработала и как повторить результат.`,
    };
  }

  if (state.endingReason === 'manual_finished') {
    return {
      kind: 'stopped',
      badge: 'ОСТАНОВКА',
      title: 'Игра остановлена досрочно.',
      reason: 'Вы завершили запуск до финального условия победы или проигрыша.',
      summary: `${progress} Данных уже достаточно, чтобы увидеть сильные и слабые места запуска.`,
    };
  }

  const reason = state.endingReason === 'time_finished'
    ? 'Закончились 30 игровых дней.'
    : state.resources.bank <= 0
      ? 'Закончился банк.'
      : state.resources.energy <= 0
        ? 'Закончилась энергия.'
        : 'Закончился ключевой ресурс.';

  return {
    kind: 'loss',
    badge: 'ПРОИГРЫШ',
    title: 'Вы проиграли игру.',
    reason,
    summary: `${progress} До цели не хватило продаж или выручки, поэтому запуск завершился проигрышем.`,
  };
}

function DreamResultList({
  diagnostics,
  formatMoney,
  summary,
}: {
  diagnostics: Diagnostics;
  formatMoney: (value: number) => string;
  summary?: string;
}) {
  if (diagnostics.dreams.length === 0) {
    return <p>Покупки на старте не выбирались.</p>;
  }

  return (
    <div className="diagnosis-dream-result">
      {summary && <p>{summary}</p>}
      <ul>
        {diagnostics.dreams.map((dream) => (
          <li key={dream.id} className={dream.affordable ? 'is-bought' : 'is-missed'}>
            <strong>{dream.title}</strong>
            <span>{dream.affordable ? 'Куплено' : 'Денег не хватило'} · {formatMoney(dream.price)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildDreamSummary(diagnostics: Diagnostics, formatMoney: (value: number) => string): string {
  if (diagnostics.dreams.length === 0) return 'Желания на старте не выбирались.';
  const affordable = diagnostics.dreams.filter((dream) => dream.affordable);
  const total = diagnostics.dreams.reduce((sum, dream) => sum + dream.price, 0);
  if (affordable.length === diagnostics.dreams.length) {
    return `На выбранные желания хватило денег. Общая сумма желаний: ${formatMoney(total)}.`;
  }
  if (affordable.length === 0) {
    return `На выбранные желания денег не хватило. Общая сумма желаний: ${formatMoney(total)}.`;
  }
  return `Денег хватило на ${affordable.length} из ${diagnostics.dreams.length} желаний. Общая сумма желаний: ${formatMoney(total)}.`;
}

type DiagnosisListItem = { title: string; text: string };
type V3Report = NonNullable<GameState['v3']['lastStageReport']>;

function buildStrongDecisionItems(state: GameState, aiReport: AiReport): DiagnosisListItem[] {
  if (state.v3.stageReports.length === 0) {
    return aiReport.strongDecisions.map((item) => ({ title: item.title, text: item.explanation }));
  }

  const reports = state.v3.stageReports;
  const last = reports.at(-1);
  const items: DiagnosisListItem[] = [];
  const prepared = reports.some((report) =>
    !report.adTitle.includes('без подготовки')
    || !report.warmupTitle.includes('руками')
    || !report.salesTitle.includes('по наитию')
  );

  if (prepared) {
    items.push({
      title: 'Подготовка перед запуском',
      text: 'Хорошо, что вы подготовились перед активным этапом, а не делали все по наитию.',
    });
  }

  if (last) {
    const adText = instrumentStrength('ad', last.adTitle);
    const warmupText = instrumentStrength('warmup', last.warmupTitle);
    const salesText = instrumentStrength('sales', last.salesTitle);
    if (adText) items.push({ title: last.adTitle, text: adText });
    if (warmupText) items.push({ title: last.warmupTitle, text: warmupText });
    if (salesText) items.push({ title: last.salesTitle, text: salesText });
  }

  const applications = reports.reduce((sum, report) => sum + report.applications, 0);
  const sales = reports.reduce((sum, report) => sum + report.salesCount, 0);
  const revenue = reports.reduce((sum, report) => sum + report.revenue, 0);
  if (applications > 0) {
    items.push({
      title: 'Заявки появились',
      text: `Хорошо, что прогрев довел людей до заявки: всего заявок ${applications}. Это значит, что часть аудитории поняла ценность продукта.`,
    });
  }
  if (sales > 0) {
    items.push({
      title: 'Продажи состоялись',
      text: `Хорошо, что выбранная связка дала оплаты: ${sales} продаж на ${revenue.toLocaleString('ru-RU')} ₽.`,
    });
  }
  if (state.history.some((entry) => entry.type === 'v3_advice')) {
    items.push({
      title: 'Вы советовались перед решением',
      text: 'Хорошо, что вы брали рекомендации, когда не хватало ясности. В запуске это снижает риск делать случайные действия.',
    });
  }

  return uniqueByTitle(items).slice(0, 5);
}

function instrumentStrength(kind: 'ad' | 'warmup' | 'sales', title: string): string | null {
  const normalized = title.toLocaleLowerCase('ru-RU');
  if (kind === 'ad') {
    if (normalized.includes('сторис')) return 'Сторис дают быстрые касания с теплой аудиторией и помогают проверить отклик без долгой подготовки.';
    if (normalized.includes('рилс')) return 'Рилс дают больше охвата и помогают набрать верх воронки, если нужны новые люди.';
    if (normalized.includes('тг') || normalized.includes('telegram')) return 'Telegram помогает работать с более теплой аудиторией и не зависеть только от случайного охвата.';
    if (normalized.includes('внешняя реклама')) return 'Внешняя реклама помогает масштабировать входящий поток быстрее, чем органический контент.';
    return null;
  }
  if (kind === 'warmup') {
    if (normalized.includes('бот с ии')) return 'Хорошо, что вы выбрали бот с ИИ. Он снимает с вас ручные ответы на этапе прогрева и помогает не терять людей.';
    if (normalized.includes('обычный бот')) return 'Хорошо, что вы выбрали бот. Он автоматизирует часть прогрева и снижает ручную нагрузку.';
    if (normalized.includes('видеоурок')) return 'Хорошо, что вы выбрали видеоурок. Он заранее объясняет ценность продукта и подводит людей к заявке.';
    if (normalized.includes('гайд') || normalized.includes('лендинг')) return 'Хорошо, что вы выбрали гайд или лендинг. Он дает человеку понятный первый шаг перед заявкой.';
    if (normalized.includes('автовебинар')) return 'Хорошо, что вы выбрали автовебинар. Он прогревает через экспертность и может давать автоматические продажи.';
    return null;
  }
  if (normalized.includes('переписка')) return 'Хорошо, что вы подготовили переписку. Она помогает не импровизировать в моменте и доводить заявки до оплаты.';
  if (normalized.includes('созвон')) return 'Хорошо, что вы подготовили созвон. Для дорогих продуктов разговор часто лучше раскрывает ценность и снимает сомнения.';
  if (normalized.includes('сайт')) return 'Хорошо, что вы выбрали сайт. Он забирает часть ручной продажи и помогает людям купить без вашего постоянного участия.';
  if (normalized.includes('автовебинар')) return 'Хорошо, что вы выбрали автовебинар в продажах. Он может продавать часть аудитории без ручной обработки.';
  return null;
}

function buildBottleneckItems(
  state: GameState,
  diagnostics: Diagnostics,
  aiReport: AiReport,
  formatMoney: (value: number) => string,
): DiagnosisListItem[] {
  if (state.v3.stageReports.length === 0) {
    return aiReport.bottlenecks.map((item) => ({
      title: item.title,
      text: `${item.explanation}${item.estimatedLoss ? ` Потенциальные потери - ${item.estimatedLoss}.` : ''}`,
    }));
  }

  const totals = v3Totals(state.v3.stageReports);
  return diagnostics.bottlenecks.map((item) => ({
    title: bottleneckTitle(item.category),
    text: bottleneckText(item.category, totals, item.expectedLoss, formatMoney),
  }));
}

function bottleneckTitle(category: string): string {
  const titles: Record<string, string> = {
    traffic: 'Реклама',
    warmup: 'Прогрев',
    processing: 'Обработка заявок',
    capacity: 'Перегруз потока',
    sales: 'Продажи',
    energy: 'Энергия',
    preparation: 'Подготовка',
  };
  return titles[category] ?? category;
}

function bottleneckText(
  category: string,
  totals: ReturnType<typeof v3Totals>,
  expectedLoss: number,
  formatMoney: (value: number) => string,
): string {
  const loss = `Потенциальные потери - около ${formatMoney(Math.round(expectedLoss))}.`;
  if (category === 'traffic') {
    return `Реклама дала ${totals.leads} лидов при ${totals.views.toLocaleString('ru-RU')} просмотрах. Воронке не хватило входящего потока, чтобы стабильно добрать план продаж. ${loss}`;
  }
  if (category === 'warmup') {
    const leadBase = Math.max(1, totals.leads);
    const percent = Math.round((totals.notInterested / leadBase) * 100);
    return `На этапе прогрева ${totals.notInterested} из ${totals.leads} лидов не оставили заявку и не попали в базу для дальнейшей продажи. Это примерно ${percent}% входящего потока. ${loss}`;
  }
  if (category === 'processing') {
    return `${totals.lost} заявок остыли или остались без ответа и не дошли до продаж. Это потери не в рекламе, а в обработке уже заинтересованных людей. ${loss}`;
  }
  if (category === 'capacity') {
    return `В запуске было ${totals.viralEvents} залетевших рекламных события и ${totals.viralViews.toLocaleString('ru-RU')} дополнительных просмотров. Поток вырос, но ${totals.lost} заявок не были обработаны вовремя. ${loss}`;
  }
  if (category === 'sales') {
    return `До продаж дошли ${totals.applications - totals.lost} заявок, но ${totals.noBuys} человек не купили после продажных действий. Значит, слабое место было в закрытии на оплату. ${loss}`;
  }
  if (category === 'energy') {
    return `Энергия закончилась или упала слишком низко, поэтому ручные действия начали ограничивать запуск. Когда все держится на вас, заявки быстрее остывают. ${loss}`;
  }
  return `Этот этап забрал заметную часть результата запуска. ${loss}`;
}

function v3Totals(reports: V3Report[]) {
  return reports.reduce((acc, report) => ({
    views: acc.views + report.views,
    leads: acc.leads + report.newLeads,
    notInterested: acc.notInterested + report.notInterested,
    applications: acc.applications + report.applications,
    lost: acc.lost + report.lost,
    viralEvents: acc.viralEvents + (report.viralEventsCount ?? 0),
    viralViews: acc.viralViews + (report.viralViews ?? 0),
    noBuys: acc.noBuys + report.callsNoBuy + report.chatsNoBuy + Math.max(0, report.siteVisits - report.siteBuys - report.siteMessages),
  }), {
    views: 0,
    leads: 0,
    notInterested: 0,
    applications: 0,
    lost: 0,
    viralEvents: 0,
    viralViews: 0,
    noBuys: 0,
  });
}

function buildLaunchPath(state: GameState, formatMoney: (value: number) => string): string[] {
  const product = `Продукт: ${state.launchPlan.productName || 'не указан'} за ${formatMoney(state.launchPlan.productPrice ?? 0)}`;
  const lastReport = state.v3.stageReports.at(-1);
  if (lastReport) {
    return [
      product,
      `Последняя попытка №${lastReport.stageNumber}:`,
      `Реклама: ${lastReport.adTitle}`,
      `Прогрев: ${lastReport.warmupTitle}`,
      `Продажи: ${lastReport.salesTitle}`,
    ];
  }
  return [
    product,
    `${labelEntry(state.activeRoute.entry)} → ${state.activeRoute.nurture.map(labelNurture).join(', ')} → ${labelProcessing(state.activeRoute.processing)} → ${labelSale(state.activeRoute.saleMethod)} → ${labelFollowup(state.activeRoute.followup)}`,
  ];
}

function uniqueByTitle(items: DiagnosisListItem[]): DiagnosisListItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  });
}

function labelEntry(value: string): string {
  return ({ direct_messages: 'директ', guide: 'гайд', video_lesson: 'видеоурок', website: 'сайт', webinar_registration: 'регистрация на вебинар' } as Record<string, string>)[value] ?? value;
}
function labelNurture(value: string): string {
  return ({ none: 'без прогрева', guide: 'гайд', video_lesson: 'видеоурок', telegram: 'Telegram-прогрев', webinar: 'вебинар' } as Record<string, string>)[value] ?? value;
}
function labelProcessing(value: string): string {
  return ({ manual: 'ручная обработка', simple_bot: 'простой бот', ai_bot: 'ИИ-бот', manager: 'менеджер', website_auto: 'сайт' } as Record<string, string>)[value] ?? value;
}
function labelSale(value: string): string {
  return ({ manual_chat: 'переписка', call: 'созвон', website_auto: 'сайт', bot_auto: 'бот', webinar_direct: 'вебинар' } as Record<string, string>)[value] ?? value;
}
function labelFollowup(value: string): string {
  return ({ none: 'без дожима', manual: 'ручной дожим', bot: 'дожим ботом' } as Record<string, string>)[value] ?? value;
}
