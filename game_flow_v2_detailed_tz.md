# Техническое задание на полную переработку игрового пути


## Проект

Репозиторий: `zigangirovnikita/igra`

Приложение: интерактивная mobile-first игра «Проживи 30 дней запуска за 10 минут».

Версия нового сценария: **2.0**

Статус документа: **единственный источник истины для переработки игрового пути**.

---

# 0. Перед началом работы

1. Создать ветку:

```bash
git checkout -b feat/game-flow-v2
```

2. Не вносить изменения напрямую в `main`.
3. Прочитать этот документ полностью до первого изменения.
4. Сначала выполнить рефакторинг типов и состояния, затем UI. Не начинать с перерисовки экранов.
5. После каждого этапа делать отдельный коммит.
6. Не останавливать работу из-за противоречия со старым ТЗ: приоритет у этого документа.
7. Не считать задачу завершённой, пока не удалён старый scene queue и не пройдены проверки.

## 0.1. Реестр файлов

### Существующие файлы, которые обязательно прочитать и изменить

```text
AGENTS.md
package.json
docs/lessons_learned.md
docs/launch-game-tz.md

config/game-config.v1.json
lib/config/game-config.ts

packages/game-engine/src/index.ts
packages/game-engine/src/types.ts
packages/game-engine/src/state/initial.ts
packages/game-engine/src/state/goals.ts
packages/game-engine/src/state/invariants.ts
packages/game-engine/src/actions/availability.ts
packages/game-engine/src/actions/commands.ts
packages/game-engine/src/time/ticks.ts
packages/game-engine/src/calculations/content.ts
packages/game-engine/src/calculations/funnel.ts
packages/game-engine/src/calculations/modifiers.ts
packages/game-engine/src/diagnostics/report.ts
packages/game-engine/src/events/dispatcher.ts

lib/game/schemas.ts
lib/game/store.ts
lib/game/leadClient.ts
lib/scenes/types.ts
lib/scenes/setupCopy.ts
lib/scenes/setupMapping.ts
lib/scenes/narratives.ts

components/game/GameApp.tsx
components/scenes/SceneEngine.tsx
components/scenes/SceneContent.tsx
components/scenes/SetupScene.tsx
components/scenes/ChoiceScreen.tsx
components/scenes/NarrativeScreen.tsx
components/scenes/ResultScreen.tsx
components/scenes/DirectMiniGame.tsx
components/scenes/DiagnosisScreen.tsx
components/scenes/ResumePrompt.tsx
components/scenes/LeadForm.tsx
components/scenes/GameHud.tsx

app/page.tsx
app/globals.css
app/api/game/sessions/route.ts
app/api/game/sessions/[id]/route.ts
app/api/game/sessions/[id]/commands/route.ts
app/api/game/sessions/[id]/finish/route.ts

prisma/schema.prisma

tests/fixtures/scenarios.ts
scripts/validate-config.ts
scripts/balance-sim.ts
scripts/export-sessions.ts
```

`app/page.tsx` и `components/game/GameApp.tsx` могут не потребовать содержательных изменений, но агент обязан проверить, что они импортируют новый SceneEngine и config v2 без legacy-зависимостей.

### Существующие файлы, которые удалить после переноса логики

```text
lib/scenes/script.ts
lib/scenes/decisionFlow.ts
```

Удалять только после того, как новый resolver работает и импорты отсутствуют.

### Существующие UI-файлы, которые удалить, если после рефакторинга они не используются

```text
components/scenes/CtaScene.tsx
components/scenes/MetricsScreen.tsx
```

Решение фиксированное:

- CTA должен находиться на финальном diagnosis или открывать LeadForm;
- отдельный второй CTA-экран не нужен;
- отдельный MetricsScreen не нужен, если его полностью заменяет DaySummaryScreen;
- не оставлять мёртвые компоненты «на всякий случай».

### Новые файлы, которые создать

```text
docs/game-flow-v2-tz.md
config/game-config.v2.json

packages/game-engine/src/flow/transitions.ts
packages/game-engine/src/flow/outcome.ts
packages/game-engine/src/flow/pending-decisions.ts
packages/game-engine/src/flow/day-report.ts

lib/game-flow/resolve-current-scene.ts
lib/game-flow/action-options.ts
lib/game-flow/action-copy.ts
lib/game-flow/scenes/intro.ts
lib/game-flow/scenes/day-one.ts
lib/game-flow/scenes/day-two.ts
lib/game-flow/scenes/daily.ts
lib/game-flow/scenes/pending-decisions.ts
lib/game-flow/scenes/final.ts

components/scenes/InputScreen.tsx
components/scenes/MultiInputScreen.tsx
components/scenes/MultiChoiceScreen.tsx
components/scenes/ActionConfirmationScreen.tsx
components/scenes/DaySummaryScreen.tsx
components/scenes/CrisisScreen.tsx
components/scenes/HistoryScreen.tsx

tests/unit/flow/initial-flow.test.ts
tests/unit/flow/daily-flow.test.ts
tests/unit/flow/no-scene-queue.test.ts
tests/unit/engine/inbound.test.ts
tests/unit/engine/repeat-policy.test.ts
tests/unit/engine/finish.test.ts
tests/unit/engine/resume.test.ts

tests/e2e/game-flow-v2.spec.ts
tests/e2e/repeat-action.spec.ts
tests/e2e/inbound-flow.spec.ts
tests/e2e/resume-flow.spec.ts
tests/e2e/final-flow.spec.ts

prisma/migrations/<timestamp>_game_flow_v2/migration.sql
```

### Экспорты

В `packages/game-engine/src/index.ts` экспортировать:

```ts
export * from './types';
export { applyCommand } from './actions/commands';
export { createInitialState } from './state/initial';
export { calculateTargets, getBucketTargetSales } from './state/goals';
export { assertStateInvariants } from './state/invariants';
export { buildActionOutcome } from './flow/outcome';
export { deriveNextPendingDecision } from './flow/pending-decisions';
```

`finishGame` экспортировать из одного места и использовать только finish endpoint. Не оставлять две разные реализации финализации.

---

# 0. Что должен сделать агент

Нужно не добавить несколько экранов к текущей реализации, а **перестроить архитектуру игрового сценария**.

Текущая реализация управляет интерфейсом через массив `queue: Scene[]`. Экраны заранее складываются в очередь, часть сцен добавляется в начало, часть в конец. Из-за этого:

- появляются два одинаковых меню подряд;
- результат действия может показываться после старого меню;
- финал оказывается за устаревшим экраном выбора;
- после перезагрузки игра возвращает пользователя не на тот экран;
- обработка входящих и мини-игра создают дополнительные копии главного меню;
- клиентская очередь становится вторым, неканоническим состоянием игры.

Новая реализация должна быть **state-driven**:

```text
каноническое GameState на сервере
→ текущее состояние сценария FlowState
→ чистая функция resolveCurrentScene()
→ ровно один текущий экран
```

Запрещено хранить будущую последовательность игры в массиве сцен.

---

# 1. Приоритет требований

При конфликте использовать следующий порядок:

1. Этот документ.
2. Текущая согласованная продуктовая концепция.
3. Реальный код и проверенные технические ограничения репозитория.
4. Старые документы в `docs/`.
5. Старый `AGENTS.md`.

Старый файл `docs/launch-game-tz.md` и текущий `AGENTS.md` могут содержать устаревшие решения. Нельзя автоматически переносить из них требования, которые противоречат этому документу.

После завершения работы обновить `AGENTS.md`, чтобы он ссылался на новый документ.

---

# 2. Зафиксированные продуктовые решения

## 2.1. Что удалить

Полностью убрать:

- вопрос о детях;
- вопрос о партнёре;
- семейные сценарии;
- легенду про мужа, жену, партнёра или вахту;
- выбор двух суперсил;
- числовую температуру клиентов;
- термины `warm`, `cold`, `hot` в модели лидов;
- постепенное процентное «остывание» лидов;
- клиентскую очередь будущих сцен;
- техническое главное меню из категорий `demand/product/content/route/sales/recovery`;
- искусственное скрытие действий через `slice(0, 4)` и `slice(0, 5)`.

## 2.2. Что оставить

Оставить:

- пол персонажа;
- имя;
- нишу;
- 100 000 ₽ стартового банка;
- 30 игровых дней;
- энергию;
- выбор продукта и цены;
- мечты;
- площадки и исходные просмотры;
- действия по исследованию спроса;
- создание продукта;
- контент;
- воронки;
- боты;
- менеджера;
- созвоны;
- продажи в переписке;
- дожим;
- консультации;
- отдых;
- мини-игру входящих;
- seeded random;
- серверные расчёты;
- финальную диагностику;
- форму заявки.

## 2.3. Важное различие

Термин **«прогрев»** остаётся. Это этап маркетингового маршрута: гайд, видео, история, кейсы, Telegram, вебинар.

Термин **«теплота лида»** и числовая температура удаляются.

Допустимые состояния группы:

- пришли входящие;
- часть обработана;
- часть отложена;
- часть потеряна;
- появились заявки;
- назначены созвоны;
- созвоны состоялись;
- появились продажи;
- часть не купила;
- часть доступна для дожима.

---

# 3. Целевой пользовательский путь

## 3.1. До создания серверной сессии

### Экран 1. Обложка

Кнопки:

- `Начать игру`
- `Продолжить сохранённую игру` — только при валидной сохранённой сессии.

### Экран 2. Пол

Кнопки:

- `Женщина`
- `Мужчина`

### Экран 3. Имя

Поле:

- имя, 2–30 символов.

Кнопки:

- `Продолжить`
- `Назад`

### Экран 4. Ниша

Поле:

- ниша, 2–120 символов.

Кнопки:

- `Начать историю`
- `Назад`

После этого отправить `POST /api/game/sessions`.

Тело запроса:

```ts
{
  avatarGender: 'female' | 'male';
  name: string;
  niche: string;
}
```

Сессия создаётся со стартовым днём 1 и экраном `intro_budget`.

---

## 3.2. Вступление

### `intro_budget`

Текст:

> У вас есть 100 000 ₽ и 30 дней, чтобы запустить продукт.

Кнопка:

- `Дальше`

### `intro_beach`

Текст:

> Перед началом работы персонаж едет к морю и решает спокойно придумать запуск.

Кнопка:

- `Начать первый день`

После кнопки перейти на `day1_product_type`.

---

## 3.3. День 1 — придумать первоначальный запуск

День 1 не является отдельной анкетой перед игрой. Это первый сюжетный день.

Последовательность:

```text
day1_product_type
→ day1_product_name
→ day1_product_price
→ day1_sale_method
→ day1_nurture
→ day1_entry_point
→ day1_business_goal
→ day1_dreams
→ day1_summary
```

### `day1_product_type`

Кнопки:

- `Консультации`
- `Услуга`
- `Обучение в записи`
- `Живое обучение`
- `Наставничество`
- `Клуб / подписка`

Команда: `set_product_type`.

### `day1_product_name`

Поле:

- название или тема продукта.

Команда: `set_product_name`.

### `day1_product_price`

Поле:

- цена от 100 до 5 000 000 ₽.

Команда: `set_product_price`.

После установки цены пересчитать бизнес-цель.

### `day1_sale_method`

Вопрос:

> Как человек будет принимать решение о покупке?

Кнопки:

- `В переписке`
- `На созвоне`
- `На вебинаре`
- `Самостоятельно на сайте`
- `Автоматически через бота`

Команда: `set_sale_method`.

### `day1_nurture`

Формулировка должна зависеть от выбранного способа продажи.

Пример для созвона:

> Нужно ли сначала подготовить человека к приглашению на созвон?

Кнопки:

- `Нет, сразу приглашать`
- `Дать полезный материал`
- `Рассказать историю и показать кейсы`
- `Провести отдельный прогрев`
- `Пока не знаю`

`Пока не знаю` сохраняет `nurture = ['none']` и отдельный флаг `launchPlan.nurtureUncertain = true`.

Команда: `set_nurture`.

### `day1_entry_point`

Вопрос:

> Где человек увидит предложение и сделает следующий шаг?

Кнопки:

- `Напишет в директ`
- `Получит гайд`
- `Посмотрит видеоурок`
- `Перейдёт на сайт`
- `Зайдёт в бота`
- `Зарегистрируется на вебинар`

Не блокировать логически слабые комбинации. Игра должна позволять ошибиться.

Команда: `set_entry_point`.

### `day1_business_goal`

Показать рассчитанную цель:

- количество продаж;
- целевую выручку;
- предупреждение о вместимости продукта, если цель выше вместимости.

Кнопки:

- `Цель понятна`
- `Назад к цене`

На этом этапе пользователь не вводит произвольную цель.

### `day1_dreams`

Можно выбрать несколько целей.

Показывать:

- целевую выручку;
- сумму выбранных целей;
- ориентировочный остаток **до учёта расходов запуска**.

Обязательно написать:

> Это расчёт от целевой выручки. В финале покупки считаются из результата после расходов на запуск.

Кнопки:

- варианты мечтаний;
- `Продолжить`;
- `Назад`.

Команда: `set_dreams`.

### `day1_summary`

Собрать текст:

- что продаёт персонаж;
- по какой цене;
- где происходит продажа;
- какой прогрев запланирован;
- куда направляются люди;
- какая бизнес-цель;
- какие мечты выбраны.

Кнопки:

- `Завершить первый день`
- `Изменить план`

`Изменить план` возвращает на `day1_product_type`, сохраняя введённые значения.

`Завершить первый день`:

- сохраняет `initialRoute`;
- устанавливает операционный маршрут;
- увеличивает день с 1 до 2;
- переводит flow на `day2_intro`.

---

## 3.4. День 2 — определить стартовые ресурсы

Последовательность:

```text
day2_intro
→ day2_channels
→ day2_metrics
→ day2_summary
```

### `day2_intro`

Текст:

> План готов. Теперь нужно понять, что уже есть для запуска.

Кнопка:

- `Посмотреть ресурсы`

### `day2_channels`

Мультивыбор:

- `Instagram`
- `Telegram`
- `База клиентов / контактов`
- `Пока ничего нет`

`Пока ничего нет` означает пустой массив каналов и снимает остальные варианты.

Команда: `set_channels`.

### `day2_metrics`

Поля зависят от каналов.

Для Instagram:

- средние просмотры рилсов;
- средние просмотры сторис.

Для Telegram:

- средние просмотры публикаций.

Для базы:

- количество контактов.

Разрешить ноль.

Команда: `set_audience_metrics`.

### `day2_summary`

Показать стартовые ресурсы.

Кнопки:

- `Начать запуск`
- `Изменить данные`

`Начать запуск`:

- увеличивает день с 2 до 3;
- переводит flow на `daily_intro`;
- рассчитывает текст первого рабочего дня.

---

## 3.5. Ежедневный цикл с 3-го дня

Основная последовательность:

```text
daily_intro
→ daily_intent
→ action_list
→ action_configuration
→ action_confirmation
→ action_process
→ action_result
→ post_action_decision
→ day_summary
→ следующий daily_intro
```

Ни один следующий экран не должен заранее лежать в очереди.

---

## 3.6. `daily_intro`

Текст зависит от последнего результата.

Если продаж не было:

> Вчера продаж не было. Что попробовать теперь?

Если продажи были:

> Вчера пришли оплаты. Продолжить эту схему или усилить её?

Если входящие потеряны:

> Часть людей ушла без ответа. Нужно решить, как не повторить это.

Кнопка:

- `Решить, что делать`

Если есть обязательное `pendingDecision`, вместо общего меню сразу показывать это решение.

---

## 3.7. `daily_intent`

Основные кнопки:

- `Попробовать получить продажи`
- `Исправить систему запуска`
- `Получить совет`
- `Восстановить силы`
- `Завершить запуск`

Контекстные кнопки:

- `Повторить успешное действие`
- `Продолжить вчерашнее действие`
- `Автоматизировать процесс`

Не показывать больше шести кнопок. Но нельзя скрывать доступные действия простым `slice`. Выбор должен быть осмысленным и контекстным.

---

## 3.8. Ветка `get_sales`

Показывать источники, которые доступны по текущим каналам.

Instagram:

- сторис;
- рилсы;
- рилсы + сторис;
- прямой эфир.

Telegram:

- Telegram-прогрев;
- пост с предложением;
- приглашение на эфир.

База контактов:

- написать по базе;
- пригласить старых клиентов;
- сделать рассылку.

Если площадок нет:

- предложить бесплатные способы создать первые контакты;
- либо перейти в `Исправить систему`;
- не показывать пустой экран.

После контентного действия спросить:

1. тип контента;
2. куда вести людей;
3. использовать текущий маршрут или временно изменить его.

---

## 3.9. Ветка `fix_system`

Подгруппы:

- `Проверить спрос`
- `Изменить продукт`
- `Добавить прогрев`
- `Изменить путь клиента`
- `Улучшить обработку входящих`
- `Добавить дожим`
- `Изменить способ продажи`

После выбора подгруппы показать все релевантные действия, доступные и недоступные.

Недоступные действия показывать заблокированными с причиной.

Обязательная кнопка:

- `Назад`

---

## 3.10. Ветка `get_advice`

Кнопки:

- `Поговорить с подругой / другом`
- `Спросить знакомого SMM`
- `Базовая консультация за 5 000 ₽`
- `Подробная диагностика за 10 000 ₽`
- `Назад`

После совета показать:

- текст совета;
- сколько потрачено дней;
- сколько потрачено денег;
- какие действия рекомендуются.

Кнопки:

- `Последовать совету`
- `Сохранить вывод и выбрать другое`

Совет сам не исправляет воронку и не создаёт продажи.

---

## 3.11. Ветка `restore_energy`

Кнопки:

- `Взять один выходной`
- `Отдохнуть два дня`
- `Продолжить работать`
- `Назад`

---

## 3.12. Подтверждение действия

До подтверждения деньги и энергия не списываются.

Показать:

- название;
- описание;
- дни;
- стоимость;
- энергию;
- текущий маршрут;
- предупреждения.

Кнопки:

- `Запустить действие`
- `Изменить настройки`
- `Назад`

Только `Запустить действие` отправляет `confirm_action`.

---

## 3.13. Результат действия

Показать:

- просмотры;
- входящие;
- обработанные;
- заявки;
- записи на созвон;
- проведённые созвоны;
- продажи;
- выручку;
- потерянные входящие;
- потраченные дни;
- потраченные деньги;
- потраченную энергию.

Кнопка:

- `Продолжить`

После неё вычисляется следующее обязательное решение.

---

## 3.14. Решения после результата

Приоритет:

1. входящие;
2. заявки;
3. дожим;
4. кризис энергии;
5. досрочная цель;
6. итог дня.

### Входящие

Кнопки:

- `Ответить всем`
- `Ответить доступному количеству`
- `Выбрать часть сообщений`
- `Ответить завтра`
- `Подключить менеджера`
- `Сделать бота`
- `Оставить без ответа`

Если входящих достаточно для мини-игры и лимит мини-игр не исчерпан — показать мини-игру.

### Заявки

Кнопки зависят от продукта и первоначального плана:

- `Продать в переписке`
- `Позвать на созвон`
- `Отправить на сайт`
- `Отправить в бота`
- `Позвать на вебинар`

### Не купившие

Кнопки:

- `Написать ещё раз`
- `Предложить созвон`
- `Показать кейс`
- `Настроить автоматический дожим`
- `Не дожимать`

---

## 3.15. Правило отложенных входящих без теплоты

Не использовать проценты и температуру.

Правило:

1. При выборе `Ответить завтра` группа получает:
   - `inboundDecision = 'deferred'`;
   - `deferredUntilDay = currentDay + 1`.
2. В начале следующего дня решение по этой группе показывается раньше главного меню.
3. Второй раз отложить ту же группу нельзя.
4. Если игрок выбирает не отвечать, остаток сразу переносится в `lost`.
5. Если бот или менеджер успел завершиться до истечения отсрочки, он может обработать остаток.
6. Никаких 75%, 45%, 20% и поля `temperature`.

---

## 3.16. Итог дня

Показать:

- действие;
- результат;
- решения после действия;
- сколько дней прошло;
- текущий банк;
- текущую энергию;
- выручку;
- продажи.

Кнопки:

- `Начать следующий день`
- `Посмотреть историю решений`

---

# 4. Условия завершения

## 4.1. Закончились дни

Если после действия следующий доступный день выходит за пределы 30:

- не создавать новое ежедневное меню;
- перейти в `final_reason`;
- причина `time_finished`.

## 4.2. Энергия равна нулю

Не завершать автоматически.

Показать кризис:

- `Отдохнуть один день`
- `Отдохнуть два дня`
- `Делегировать`
- `Завершить запуск`

Если дней для отдыха нет — оставить только делегирование при наличии денег и завершение.

## 4.3. Банк равен нулю

Не завершать автоматически.

- платные действия заблокированы;
- бесплатные доступны;
- показать предупреждение.

## 4.4. Цель достигнута раньше срока

Показать:

- `Продолжить запуск`
- `Завершить и посмотреть итоги`

После `Продолжить` не показывать этот вопрос повторно при каждой следующей продаже.

## 4.5. Ручное завершение

Требовать подтверждение:

- `Да, завершить`
- `Нет, продолжить`

Ручное завершение **не должно перематывать оставшиеся дни**.

---

# 5. Целевая архитектура

## 5.1. Каноническое состояние

Каноническим является только `GameState`, сохранённый сервером.

React может хранить:

- последнее полученное `GameState`;
- `busy`;
- сообщение об ошибке;
- локальное состояние незавершённого поля ввода;
- открытую форму заявки.

React не может хранить:

- очередь будущих сцен;
- будущие игровые решения;
- рассчитанные метрики;
- копию маршрута, отличающуюся от серверной;
- скрытый прогресс сценария.

## 5.2. Получение экрана

Создать чистую функцию:

```ts
resolveCurrentScene(state: GameState, config: GameConfig): Scene
```

Она:

- ничего не изменяет;
- не использует React;
- не делает API-запросы;
- не использует `Math.random`;
- возвращает ровно один экран;
- строит экран только из канонического состояния.

## 5.3. Переходы

Каждая кнопка либо:

- отправляет серверную команду;
- изменяет только локальное UI-состояние формы;
- открывает форму заявки;
- возвращает назад внутри незапущенной конфигурации действия.

---

# 6. Новая модель типов

## 6.1. `PlayerProfile`

В `packages/game-engine/src/types.ts` заменить текущий `SetupInput`.

```ts
export type PlayerProfile = {
  avatarGender: Gender;
  name: string;
  niche: string;
};

export type SetupInput = PlayerProfile;
```

Удалить из `SetupInput`:

- `productName`;
- `superpowers`;
- `productType`;
- `productPrice`;
- `averageReelViews`;
- `averageStoryViews`;
- `telegramStatus`;
- `averageTelegramViews`;
- `dreams`.

## 6.2. `LaunchPlan`

```ts
export type LaunchPlan = {
  productType: string | null;
  productName: string;
  productPrice: number | null;

  plannedSaleMethod: SaleMethod | null;
  plannedEntry: EntryPoint | null;
  plannedNurture: NurtureType[];
  nurtureUncertain: boolean;

  dreams: string[];
  confirmed: boolean;
};
```

## 6.3. `AudienceResources`

```ts
export type AudienceChannel = 'instagram' | 'telegram' | 'contacts';

export type AudienceResources = {
  channels: AudienceChannel[];
  averageReelViews: number;
  averageStoryViews: number;
  averageTelegramViews: number;
  contactsCount: number;
  confirmed: boolean;
};
```

## 6.4. Состояние сценария

```ts
export type FlowStage =
  | 'intro'
  | 'day1_plan'
  | 'day2_resources'
  | 'daily'
  | 'final';

export type FlowStep =
  | 'intro_budget'
  | 'intro_beach'
  | 'day1_product_type'
  | 'day1_product_name'
  | 'day1_product_price'
  | 'day1_sale_method'
  | 'day1_nurture'
  | 'day1_entry_point'
  | 'day1_business_goal'
  | 'day1_dreams'
  | 'day1_summary'
  | 'day2_intro'
  | 'day2_channels'
  | 'day2_metrics'
  | 'day2_summary'
  | 'daily_intro'
  | 'daily_intent'
  | 'action_list'
  | 'action_configuration'
  | 'action_confirmation'
  | 'action_process'
  | 'action_result'
  | 'post_action'
  | 'day_summary'
  | 'energy_crisis'
  | 'budget_notice'
  | 'goal_reached'
  | 'finish_confirmation'
  | 'final_reason'
  | 'final_diagnosis';

export type DailyIntent =
  | 'get_sales'
  | 'fix_system'
  | 'get_advice'
  | 'restore_energy'
  | 'repeat_last'
  | 'automate'
  | 'finish';

export type FlowState = {
  stage: FlowStage;
  step: FlowStep;
  selectedIntent: DailyIntent | null;
  selectedGroup: string | null;
  goalPromptHandled: boolean;
  backStep: FlowStep | null;
};
```

## 6.5. Настраиваемое действие

```ts
export type PendingAction = {
  actionId: string;
  selectedAtDay: number;
  contentType?: ContentType;
  temporaryRoute?: RouteSelection;
  targetCohortId?: string;
  confirmed: boolean;
};
```

## 6.6. Результат действия

```ts
export type ActionOutcome = {
  actionId: string;
  title: string;
  startedDay: number;
  finishedDay: number;

  impressionsDelta: number;
  inboundDelta: number;
  processedDelta: number;
  applicationsDelta: number;
  bookedCallsDelta: number;
  heldCallsDelta: number;
  salesDelta: number;
  revenueDelta: number;
  lostDelta: number;

  bankDelta: number;
  energyDelta: number;

  createdCohortIds: string[];
  narrativeKeys: string[];
};
```

## 6.7. Итог дня

```ts
export type DayReport = {
  id: string;
  startedDay: number;
  finishedDay: number;
  actionId: string;
  actionTitle: string;
  outcome: ActionOutcome;
  decisions: Array<{
    type: string;
    label: string;
  }>;
};
```

## 6.8. Решения

```ts
export type PendingDecision =
  | {
      type: 'inbound';
      cohortId: string;
    }
  | {
      type: 'sales';
      cohortId: string;
    }
  | {
      type: 'followup';
      cohortId: string;
    }
  | {
      type: 'energy_crisis';
    }
  | {
      type: 'goal_reached';
    }
  | {
      type: 'finish_confirmation';
    };
```

## 6.9. Причина завершения

```ts
export type EndingReason =
  | 'time_finished'
  | 'goal_finished'
  | 'manual_finished'
  | 'resource_finished';
```

## 6.10. Новый `GameState`

Изменить:

```ts
schemaVersion: 2;
player: PlayerProfile;
launchPlan: LaunchPlan;
audience: AudienceResources;
flow: FlowState;
pendingAction: PendingAction | null;
pendingDecision: PendingDecision | null;
lastOutcome: ActionOutcome | null;
currentDayReport: DayReport | null;
dayReports: DayReport[];
endingReason: EndingReason | null;
```

Оставить:

- `targets`;
- `resources`;
- `assets`;
- `activeRoute`;
- `scheduledActions`;
- `cohorts`;
- `metrics`;
- `flags`;
- `history`;
- `diagnostics`.

Переименовать `initialPlan` в `initialRoute`.


# 7. Новая модель группы входящих

В `LeadCohort`:

Удалить:

```ts
temperature
unprocessedWarm
considering
```

Добавить:

```ts
unprocessedInbound: number;
pendingFollowup: number;

inboundDecision: 'pending' | 'resolved' | 'deferred';
salesDecision: 'not_ready' | 'pending' | 'resolved';
followupDecision: 'not_ready' | 'pending' | 'resolved';

deferredUntilDay: number | null;
deferCount: number;
```

Сохранить:

- `responses` или переименовать в `inbound`;
- `processed`;
- `applications`;
- `bookedCalls`;
- `heldCalls`;
- `sales`;
- `unprocessedApplications`;
- `lost`;
- `capacityLostLeads`;
- `routeSnapshot`;
- `followedUp`.

Рекомендуемый механический rename:

```text
responses → inbound
unprocessedWarm → unprocessedInbound
considering → pendingFollowup
```

Если rename делается, выполнить его во всём проекте одной задачей и не оставлять смешанные названия.

Команда поиска:

```bash
rg "responses|unprocessedWarm|considering|temperature|decay|superpowers|familyType" .
```

После завершения команда не должна находить рабочий код со старыми полями. Допустимы только миграционные комментарии или история документации.

---

# 8. Серверные команды

В `GameCommand` сделать явный union.

Добавить:

```ts
advance_intro
set_product_type
set_product_name
set_product_price
set_sale_method
set_nurture
set_entry_point
set_dreams
advance_day1_goal
complete_day_one
advance_day2_intro
set_channels
set_audience_metrics
complete_day_two
choose_intent
choose_action_group
select_action
configure_action
cancel_pending_action
confirm_action
acknowledge_action_process
acknowledge_action_result
resolve_inbound
defer_inbound
resolve_sales
resolve_followup
complete_day
continue_after_goal
request_finish
cancel_finish
repair_flow
abandon_game
```

Существующие команды:

- `resolve_mini_game` — оставить;
- `start_parallel` — временно оставить в движке;
- `record_reflection` — можно оставить для аналитики;
- `set_route` — использовать только внутри серверной логики или developer mode.

Удалить из публичного UI-протокола:

- прямой `start_action`;
- прямой `set_plan`;
- `finish_game` как обычную команду `/commands`.

Финализация выполняется только через `POST /api/game/sessions/[id]/finish`, потому что этот endpoint также сохраняет `GameResult` и запускает формирование объяснения.

Пользовательское действие сначала выбирается, настраивается и подтверждается.

---

# 9. Валидация команд

Файл: `lib/game/schemas.ts`.

Текущий `payload: z.unknown()` недостаточен.

Сделать `z.discriminatedUnion('type', [...])`.

Пример:

```ts
const base = {
  commandId: z.string().min(1).max(120),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().optional(),
};

export const commandRequestSchema = z.discriminatedUnion('type', [
  z.object({
    ...base,
    type: z.literal('advance_intro'),
    payload: z.object({}),
  }),
  z.object({
    ...base,
    type: z.literal('set_product_type'),
    payload: z.object({
      productType: z.string().min(1),
    }),
  }),
  z.object({
    ...base,
    type: z.literal('set_product_price'),
    payload: z.object({
      productPrice: z.coerce.number().int().min(100).max(5_000_000),
    }),
  }),
  z.object({
    ...base,
    type: z.literal('set_dreams'),
    payload: z.object({
      dreams: z.array(z.string()).min(1),
    }),
  }),
  z.object({
    ...base,
    type: z.literal('confirm_action'),
    payload: z.object({}),
  }),
]);
```

Добавить все команды, не оставлять общий `unknown`.

---

# 10. Изменения по файлам

## 10.1. `components/scenes/SceneEngine.tsx`

### Полностью удалить

- `queue`;
- `setQueue`;
- `pushScenes`;
- `advanceQueue`;
- `prevStateRef`;
- `planRef`;
- `buildInitialPlanScenes`;
- `buildInitialGameScenes`;
- `buildPostActionScenes`;
- `buildMainChoiceScene`;
- fallback на главное меню;
- добавление результата в конец очереди;
- ручное добавление меню после входящих;
- ручное добавление меню после мини-игры.

### Оставить

- загрузку config;
- `gameState`;
- `busy`;
- `error`;
- resume;
- lead form;
- restart.

### Новая структура

```tsx
export function SceneEngine({ config }: Props) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mode, setMode] = useState<'setup' | 'game' | 'lead'>('setup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scene = gameState
    ? resolveCurrentScene(gameState, config)
    : null;

  async function sendCommand(command: ClientCommand) {
    // POST /commands
    // expectedVersion = gameState.stateVersion
    // при 409 заменить состояние на серверное
    // при успехе setGameState(data.state)
  }

  return (
    <SceneContent
      scene={scene}
      busy={busy}
      onAction={handleSceneAction}
    />
  );
}
```

### Обработка 409

Если API вернул:

```ts
{ error: 'version_conflict', state }
```

Нужно:

- заменить локальный state на серверный;
- показать сообщение `Состояние игры обновлено`;
- не повторять команду автоматически.

---

## 10.2. `components/scenes/SceneContent.tsx`

Переписать API компонента.

Сейчас компонент принимает много отдельных callbacks.

Должно быть:

```ts
type Props = {
  scene: Scene;
  busy: boolean;
  onAction: (action: SceneAction) => void;
};
```

Поддержать типы:

- `narrative`;
- `choice`;
- `text_input`;
- `number_input`;
- `multi_input`;
- `multi_choice`;
- `action_confirm`;
- `result`;
- `mini_game_direct`;
- `day_summary`;
- `crisis`;
- `diagnosis`.

---

## 10.3. `components/scenes/SetupScene.tsx`

Оставить только:

```text
welcome
gender
name
niche
```

Удалить JSX-блоки:

- superpowers;
- product;
- product_name;
- price;
- family;
- legend;
- dreams;
- channels;
- reach;
- summary.

После ниши вызвать `onComplete`.

Новый `SetupDraft`:

```ts
{
  gender: 'female' | 'male';
  name: string;
  niche: string;
}
```

---

## 10.4. `lib/scenes/setupCopy.ts`

Удалить:

- `FamilyType`;
- `familyOptions`;
- `getLegendText`;
- product labels из setup;
- дефолты цены, продукта, охватов и мечтаний.

Оставить:

```ts
export type SetupStep = 'welcome' | 'gender' | 'name' | 'niche';

export const SETUP_STEPS = [
  'welcome',
  'gender',
  'name',
  'niche',
] as const;
```

---

## 10.5. `lib/scenes/setupMapping.ts`

`draftToSetupInput()` должен возвращать только:

```ts
{
  avatarGender: draft.gender,
  name: draft.name.trim(),
  niche: draft.niche.trim(),
}
```

Переписать cache.

Хранить:

```ts
type CachedSessionPointer = {
  sessionId: string;
  schemaVersion: 2;
  expiresAt: number;
};
```

Не хранить полный `GameState` в localStorage.

При resume всегда запрашивать сервер.

Если сервер недоступен — показать ошибку, а не использовать устаревший локальный state.

---

## 10.6. Создать `lib/game-flow/resolve-current-scene.ts`

Главный resolver.

Структура:

```ts
export function resolveCurrentScene(
  state: GameState,
  config: GameConfig
): Scene {
  if (state.status === 'finished') {
    return resolveFinalScene(state, config);
  }

  if (state.pendingDecision) {
    return resolvePendingDecisionScene(state, config);
  }

  switch (state.flow.step) {
    case 'intro_budget':
      return introBudgetScene(state);
    case 'day1_product_type':
      return productTypeScene(state, config);
    case 'day1_product_name':
      return productNameScene(state);
    // ...
    case 'daily_intent':
      return dailyIntentScene(state, config);
    case 'action_confirmation':
      return actionConfirmationScene(state, config);
    case 'action_result':
      return actionResultScene(state);
    case 'day_summary':
      return daySummaryScene(state);
    default:
      return safeRecoveryScene(state);
  }
}
```

`safeRecoveryScene` не должен молча показывать главное меню. Он должен сообщать:

> Не удалось определить текущий шаг игры.

Кнопка:

- `Восстановить экран`

Она отправляет отдельную команду `repair_flow` только в developer mode либо ведёт к безопасному `daily_intro`, если state валиден.

---

## 10.7. Создать файлы flow

Создать:

```text
lib/game-flow/scenes/intro.ts
lib/game-flow/scenes/day-one.ts
lib/game-flow/scenes/day-two.ts
lib/game-flow/scenes/daily.ts
lib/game-flow/scenes/pending-decisions.ts
lib/game-flow/scenes/final.ts
lib/game-flow/action-options.ts
lib/game-flow/action-copy.ts
```

В этих файлах только:

- тексты;
- варианты кнопок;
- mapping состояния в Scene;
- причины disabled.

Не размещать формулы продаж и конверсий.

---

## 10.8. `lib/scenes/types.ts`

Удалить setup-типы из union игровых сцен.

Добавить generic action:

```ts
export type SceneAction =
  | {
      kind: 'command';
      type: GameCommand['type'];
      payload: Record<string, unknown>;
    }
  | {
      kind: 'local';
      type: 'back' | 'open_lead' | 'restart';
    };
```

Каждая option:

```ts
export type ChoiceOption = {
  id: string;
  icon?: string;
  title: string;
  description?: string;
  costLabel?: string;
  daysLabel?: string;
  energyLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  action: SceneAction;
};
```

---

## 10.9. `lib/scenes/script.ts`

После перехода на resolver удалить файл.

Нельзя оставлять параллельно:

- старый `buildPostActionScenes`;
- новый `resolveCurrentScene`.

Иначе снова появятся два источника сценария.

---

## 10.10. `lib/scenes/decisionFlow.ts`

После переноса action mapping удалить файл.

Логику категорий заменить на `action-options.ts`.

---

## 10.11. `lib/scenes/narratives.ts`

Удалить:

- `familyLegend`;
- тексты про партнёра;
- использование `state.player.productPrice`;
- использование суперсил;
- слова `тёплый`, `горячий`, `остыл` применительно к уровню лида.

Заменить обращения:

```text
state.player.productPrice
→ state.launchPlan.productPrice
```

Тексты:

```text
«Они, скорее всего, уже остыли»
→ «Они ушли, не получив ответа»
```

```text
«Тёплая аудитория откликается»
→ «Текущая аудитория отреагировала»
```

Разделить тексты по этапам, если файл становится слишком большим.

---

## 10.12. `packages/game-engine/src/state/initial.ts`

Создавать состояние:

```ts
const state: GameState = {
  schemaVersion: 2,
  status: 'active',
  player: setup,

  launchPlan: {
    productType: null,
    productName: '',
    productPrice: null,
    plannedSaleMethod: null,
    plannedEntry: null,
    plannedNurture: ['none'],
    nurtureUncertain: false,
    dreams: [],
    confirmed: false,
  },

  audience: {
    channels: [],
    averageReelViews: 0,
    averageStoryViews: 0,
    averageTelegramViews: 0,
    contactsCount: 0,
    confirmed: false,
  },

  targets: {
    targetSales: 0,
    targetRevenue: 0,
    personalGoal: 0,
  },

  resources: {
    day: 1,
    bank: config.startingBank,
    energy: config.startingEnergy,
  },

  flow: {
    stage: 'intro',
    step: 'intro_budget',
    selectedIntent: null,
    selectedGroup: null,
    goalPromptHandled: false,
    backStep: null,
  },

  pendingAction: null,
  pendingDecision: null,
  lastOutcome: null,
  currentDayReport: null,
  dayReports: [],
  endingReason: null,
};
```

`activeRoute` временно стартует безопасным маршрутом:

```ts
{
  entry: 'direct_messages',
  nurture: ['none'],
  processing: 'manual',
  saleMethod: 'manual_chat',
  followup: 'none',
}
```

---

## 10.13. `packages/game-engine/src/state/goals.ts`

Изменить сигнатуру:

```ts
calculateTargets(
  launchPlan: LaunchPlan,
  config: GameConfig
): Targets
```

Если цена отсутствует:

```ts
return {
  targetSales: 0,
  targetRevenue: 0,
  personalGoal: 0,
};
```

Мечты брать из:

```ts
launchPlan.dreams
```

Цена:

```ts
launchPlan.productPrice
```

Вызывать пересчёт после:

- `set_product_price`;
- `set_dreams`;
- изменения типа продукта, если требуется предупреждение вместимости.

---

## 10.14. `packages/game-engine/src/actions/commands.ts`

Переписать `applyCommand` на явные handlers.

Рекомендуемая структура:

```ts
export function applyCommand(
  input: GameState,
  config: GameConfig,
  command: GameCommand
): GameState {
  if (input.appliedCommandIds.includes(command.commandId)) {
    return input;
  }

  let state = structuredClone(input);

  switch (command.type) {
    case 'advance_intro':
      state = advanceIntro(state);
      break;
    case 'set_product_type':
      state = setProductType(state, config, command.payload);
      break;
    case 'set_product_name':
      state = setProductName(state, command.payload);
      break;
    case 'set_product_price':
      state = setProductPrice(state, config, command.payload);
      break;
    case 'confirm_action':
      state = confirmPendingAction(state, config);
      break;
    // ...
    default:
      assertNever(command);
  }

  state.appliedCommandIds.push(command.commandId);
  state.stateVersion += 1;
  assertStateInvariants(state, config);

  return state;
}
```

### `select_action`

Должен:

- найти action;
- проверить availability;
- создать `pendingAction`;
- не списывать ресурсы;
- перевести `flow.step` на первый configuration step или confirmation.

### `configure_action`

Должен:

- менять только `pendingAction`;
- проверять допустимые enum;
- не выполнять действие.

### `confirm_action`

Должен:

1. повторно проверить availability;
2. сохранить `beforeState`;
3. списать ресурсы;
4. запустить существующий детерминированный расчёт;
5. сформировать `ActionOutcome`;
6. определить новые cohort IDs;
7. установить `lastOutcome`;
8. создать `currentDayReport`;
9. установить `flow.step = 'action_process'`;
10. не создавать следующее меню.

### `acknowledge_action_process`

Должен:

- проверить, что `lastOutcome` существует;
- перевести `flow.step` с `action_process` на `action_result`;
- не менять ресурсы и метрики повторно.

### `acknowledge_action_result`

Должен:

- найти следующее обязательное решение;
- либо установить `pendingDecision`;
- либо перейти в `day_summary`.

### `complete_day`

Должен:

- добавить `currentDayReport` в `dayReports`;
- очистить `pendingAction`;
- очистить `lastOutcome` только после формирования intro следующего дня;
- проверить конец времени;
- проверить goal prompt;
- перейти на `daily_intro` или final.

---

## 10.15. Создать `packages/game-engine/src/flow/transitions.ts`

Хранить переходы интро, дня 1, дня 2 и ежедневного цикла.

Каждая функция принимает state и возвращает новый state.

Запрещено менять React из этого файла.

---

## 10.16. Создать `packages/game-engine/src/flow/outcome.ts`

Функция:

```ts
buildActionOutcome(
  before: GameState,
  after: GameState,
  action: ActionConfig
): ActionOutcome
```

Все delta рассчитываются здесь.

UI получает готовые числа.

---

## 10.17. Создать `packages/game-engine/src/flow/pending-decisions.ts`

Функция:

```ts
deriveNextPendingDecision(state: GameState): PendingDecision | null
```

Приоритет:

1. unresolved inbound;
2. unresolved applications;
3. unresolved followup;
4. energy crisis;
5. goal reached;
6. null.

Для группы решение должно показываться только один раз согласно её status-полям.

---

## 10.18. `packages/game-engine/src/actions/availability.ts`

Исправить `repeatPolicy`.

### `never`

Недоступно после первого старта.

### `unlimited`

Разрешено при наличии ресурсов и дней.

### `once_per_cohort`

Требовать `targetCohortId`.

Недоступно, если в history уже есть выполненное действие с тем же actionId и cohortId.

### `upgrade`

В config добавить:

```ts
upgradeGroup?: string;
upgradeLevel?: number;
upgradeCost?: number;
```

Правило:

- нельзя запускать уровень ниже уже выполненного;
- текущий уровень повторно нельзя;
- следующий уровень можно;
- если указан `upgradeCost`, списывать его вместо полной стоимости.

Для консультации:

```text
basic: level 1, cost 5 000
detailed: level 2, full cost 10 000, upgradeCost 5 000
```


## 10.19. `packages/game-engine/src/time/ticks.ts`

Удалить:

- `decayCohort`;
- чтение `config.decay`;
- умножение остатка на temperature.

Добавить:

```ts
expireDeferredInbound(state)
```

Правило:

- если `deferredUntilDay` прошёл;
- и решение не обработано;
- весь `unprocessedInbound` переносится в `lost`;
- status становится `resolved`.

Не использовать процентные потери.

### Важная проверка

Не допустить, чтобы группа потерялась в тот же tick, в который она создана.

---

## 10.20. `packages/game-engine/src/calculations/content.ts`

Заменить:

```ts
state.player.averageReelViews
→ state.audience.averageReelViews
```

Аналогично:

- stories;
- Telegram.

Удалить суперсилы:

- количество рилсов всегда базовое из config;
- убрать `hasSuperpower`;
- убрать expertise/marketing/sales modifiers.

При создании cohort:

```ts
unprocessedInbound: 0
pendingFollowup: 0
inboundDecision: 'pending'
salesDecision: 'not_ready'
followupDecision: 'not_ready'
deferredUntilDay: null
deferCount: 0
```

---

## 10.21. `packages/game-engine/src/calculations/funnel.ts`

Заменить `unprocessedWarm` на `unprocessedInbound`.

После точки входа:

```ts
next.unprocessedInbound = next.activated;
next.inboundDecision =
  next.unprocessedInbound > 0 ? 'pending' : 'resolved';
```

После обработки:

- уменьшить `unprocessedInbound`;
- увеличить `processed`;
- при появлении заявок:
  - `salesDecision = 'pending'`;
- после продажи:
  - некупивших записать в `pendingFollowup`;
  - `followupDecision = pendingFollowup > 0 ? 'pending' : 'not_ready'`.

Удалить суперсилы из:

- manual capacity;
- followup rate;
- sale rate modifiers.

---

## 10.22. `packages/game-engine/src/calculations/modifiers.ts`

Удалить:

```ts
hasSuperpower()
```

Удалить все условия по:

- expertise;
- sales;
- marketing;
- energy superpower.

Сохранить:

- low energy penalties;
- demand multiplier;
- nurture multiplier;
- processing quality;
- price and sale-method modifiers;
- product quality;
- route effects.

---

## 10.23. `packages/game-engine/src/diagnostics/report.ts`

Заменить:

```ts
state.player.productPrice
→ state.launchPlan.productPrice ?? 0
```

Заменить:

```ts
state.player.dreams
→ state.launchPlan.dreams
```

Текст ошибки:

```text
«часть входящих остыла без обработки»
→ «часть входящих осталась без ответа»
```

Диагностика processing должна использовать:

- `lost`;
- `unprocessedInbound`;
- ожидаемую потерю выручки.

Не использовать temperature.

---

## 10.24. `packages/game-engine/src/state/invariants.ts`

Добавить проверки:

- schemaVersion = 2;
- launchPlan price либо null, либо положительное;
- если `launchPlan.confirmed`, обязательны productType, productPrice, saleMethod, entry;
- если `audience.confirmed`, метрики неотрицательны;
- flow stage и step совместимы;
- pendingAction существует только на action steps;
- finished state имеет diagnostics и endingReason;
- cohort не содержит отрицательных значений;
- deferred cohort имеет deferredUntilDay;
- `temperature` отсутствует;
- revenue = sales × launchPlan.productPrice.

До подтверждения продукта, когда price null, revenue должен быть 0.

---

## 10.25. `config/game-config.v1.json`

Не изменять файл на месте.

Создать:

```text
config/game-config.v2.json
```

Версия:

```json
"version": "2.0.0"
```

Удалить:

```json
"superpowers"
"decay"
```

Добавить UI-метаданные действий:

```json
{
  "intent": "get_sales",
  "group": "instagram",
  "configurationSteps": ["content_type", "destination"],
  "uiVisible": true
}
```

Расширить `ActionConfig`:

```ts
intent:
  | 'get_sales'
  | 'fix_system'
  | 'get_advice'
  | 'restore_energy';

group: string;
configurationSteps: string[];
uiVisible: boolean;

upgradeGroup?: string;
upgradeLevel?: number;
upgradeCost?: number;
```

### Классификация действий

#### `get_advice`

- friend_advice;
- smm_advice;
- consultation_basic;
- consultation_detailed.

#### `fix_system / demand`

- demand_poll;
- demand_interviews;
- demand_pilot_offer.

#### `fix_system / product`

- product_pilot;
- product_self;
- product_home;
- product_studio.

#### `get_sales / instagram`

- stories_3d;
- reels_7d;
- reels_stories_7d;
- live_stream.

#### `get_sales / telegram`

- telegram_warmup.

`telegram_warmup` с `contentType = selling` используется как прямое предложение в Telegram. Отдельное действие `telegram_offer` в этой версии не создавать.

#### `get_sales / contacts`

Текущий движок не содержит источника базы контактов, хотя этот вариант есть в пользовательском пути. Добавить:

```json
{
  "id": "contacts_outreach",
  "enabled": true,
  "category": "content",
  "intent": "get_sales",
  "group": "contacts",
  "title": "Написать по базе контактов",
  "cost": 0,
  "days": 1,
  "energyCost": 5,
  "requirements": [
    {
      "operator": "in",
      "path": "audience.channels",
      "value": ["contacts"]
    }
  ],
  "effects": [],
  "repeatPolicy": "unlimited",
  "configurationSteps": ["content_type", "destination"],
  "uiVisible": true,
  "analyticsId": "contacts_outreach"
}
```

В `SourceType` добавить `contacts`.

Базовый объём показов для этого действия:

```ts
impressions = state.audience.contactsCount;
```

Response rate вынести в `config.content.contactsResponseRate`. Техническое стартовое значение для версии 2: `0.05`. Оно считается балансировочным параметром и не должно быть захардкожено в TypeScript.

#### `get_sales / webinar`

- webinar.

#### `fix_system / nurture`

- guide_self;
- guide_specialist;
- video_self;
- video_specialist.

#### `fix_system / processing`

- simple_bot_self;
- simple_bot_specialist;
- ai_bot_self;
- ai_bot_specialist;
- hire_manager.

#### `fix_system / website`

- website_basic;
- website_beautiful.

#### Скрытые автоматические действия

`uiVisible: false`:

- website_auto_sale;
- bot_auto_sale;
- webinar_sale.

#### Контекстные продажи

Не показывать в общем меню, только после заявок:

- manual_chat;
- calls.

#### Контекстный дожим

Не показывать в общем меню, только после некупивших:

- manual_followup;
- bot_followup.

#### `restore_energy`

- rest_one_day;
- rest_two_days.

---

## 10.26. `lib/config/game-config.ts`

Импортировать `game-config.v2.json`.

Обновить Zod:

- убрать обязательные superpowers;
- убрать decay;
- добавить intent/group/configurationSteps/uiVisible;
- добавить upgrade metadata.

---

## 10.27. `scripts/validate-config.ts`

Добавить проверки:

- все visible actions имеют intent и group;
- configurationSteps содержат только известные значения;
- upgradeGroup содержит уникальные уровни;
- upgradeCost не больше full cost;
- hidden auto actions не показываются в menu;
- action IDs уникальны;
- event IDs уникальны;
- probability distribution = 1.

---

## 10.28. События в config

Переименовать:

```text
manager_cold_leads → manager_without_nurture
manager_warm_leads → manager_after_nurture
hot_lead_lost → inbound_lost
client_thinking → followup_available
```

Переписать сообщения без терминов теплоты.

Можно сохранить старый analyticsId только при необходимости совместимости аналитики. В противном случае version 2 использует новые IDs.

---

## 10.29. `packages/game-engine/src/events/dispatcher.ts`

Обновить matchers под новые поля.

Удалить проверки:

- `temperature`;
- warm backlog;
- hot lead.

Использовать:

- `lost` delta;
- `unprocessedInbound`;
- `pendingFollowup`;
- наличие nurture.

---

## 10.30. API создания сессии

Файл:

```text
app/api/game/sessions/route.ts
```

Изменить только setup schema и initial state.

Ответ оставить:

```ts
{
  sessionId,
  configVersion,
  seedFingerprint,
  state,
}
```

Cookie оставить.

---

## 10.31. API команд

Файл:

```text
app/api/game/sessions/[id]/commands/route.ts
```

Оставить optimistic concurrency.

После parsing не делать unsafe cast из произвольного payload.

`parsed.data` должен уже соответствовать `GameCommand`.

При сохранении event:

- eventType = command.type;
- gameDay = новый current day;
- payload = валидированный payload.

---

## 10.32. API finish

Файл:

```text
app/api/game/sessions/[id]/finish/route.ts
```

Принимать:

```ts
{
  reason:
    | 'time_finished'
    | 'goal_finished'
    | 'manual_finished'
    | 'resource_finished';
}
```

`finishGame()` не должен автоматически вызывать:

```ts
advanceDays(input, config, config.totalDays)
```

Новая логика:

```ts
export function finishGame(
  input: GameState,
  config: GameConfig,
  reason: EndingReason
): GameState {
  const state = structuredClone(input);

  recalculateMetrics(state);
  state.status = 'finished';
  state.endingReason = reason;
  state.flow = {
    ...state.flow,
    stage: 'final',
    step: 'final_reason',
  };
  state.diagnostics = calculateDiagnostics(state, config);

  return state;
}
```

Повторный finish должен быть idempotent.

Endpoint должен принимать `expectedVersion`. При конфликте вернуть `409` и актуальный state, как command endpoint.

До вызова endpoint пользователь может находиться на `final_reason` или `finish_confirmation` при незавершённом status. После успешного ответа state получает `status = 'finished'` и `flow.step = 'final_diagnosis'`.

---

## 10.33. `lib/game/store.ts`

Исправить:

```ts
stateVersion: { increment: 1 }
```

на:

```ts
stateVersion: session.state.stateVersion
```

DB version должна совпадать с канонической версией state.

Не записывать всегда:

```ts
status: 'playing'
```

Использовать mapping:

```ts
active / goal_reached → playing
finished → finished
abandoned → abandoned
```

При чтении schemaVersion 1:

- не пытаться открыть в новом resolver;
- вернуть код `legacy_state`;
- предложить начать заново.

---

## 10.34. Prisma

Файл:

```text
prisma/schema.prisma
```

`currentState` уже Json, поэтому FlowState не требует отдельных колонок.

Но `GameResult` сейчас не хранит полную диагностику.

Добавить:

```prisma
diagnostics Json?
endingReason String?
```

Поля должны быть nullable, чтобы миграция применялась к уже существующим строкам `game_results`. Для всех результатов версии 2 endpoint finish обязан заполнять оба поля.

Сохранить существующие аналитические поля.

Создать миграцию:

```text
prisma/migrations/<timestamp>_game_flow_v2/migration.sql
```

В finish route записывать полный diagnostics.

В `getSession()` использовать полный `diagnostics`, а не восстанавливать `mistakes: []` и `dreams: []`.

---

## 10.35. `components/scenes/ResumePrompt.tsx`

Показывать:

- текущий день;
- банк;
- энергию;
- понятный текущий этап.

Примеры:

- `Первый день: план запуска`;
- `Второй день: стартовые ресурсы`;
- `День 8: выбор действия`;
- `День 14: обработка входящих`;
- `Финальный отчёт`.

Кнопки:

- `Продолжить`
- `Начать заново`

При старой schemaVersion:

> Это сохранение создано в предыдущей версии игры и больше не совместимо.

Кнопка:

- `Начать новую игру`

---

## 10.36. `components/scenes/LeadForm.tsx`

Заменить:

```ts
state.player.productName
state.player.productPrice
```

на:

```ts
state.launchPlan.productName
state.launchPlan.productPrice
```

Кнопка назад должна возвращать на final diagnosis.

Поскольку queue удалена, это будет обычное переключение локального `mode` обратно в `game`.

---

## 10.37. `lib/game/leadClient.ts`

Заменить fallback price:

```ts
state.launchPlan.productPrice ?? 0
```

Не отправлять форму, если продукт или цена отсутствуют.

---

## 10.38. `components/scenes/DiagnosisScreen.tsx`

Использовать launchPlan.

Тексты этапов:

- трафик;
- входящие;
- обработка;
- заявки;
- продажа;
- дожим.

Не показывать «прогрев успешен» только по отсутствию traffic bottleneck.

Диагностика должна брать кодовые факты из `diagnostics`.

---

## 10.39. `components/scenes/DirectMiniGame.tsx`

Удалить зависимость manual capacity от суперсилы.

Capacity приходит со сцены, рассчитанный движком.

После результата не добавлять меню.

Команда `resolve_mini_game` обновит state, resolver определит следующий экран.

Кнопка `Рассчитать автоматически` означает симуляцию ручной обработки до лимита, а не подключение автоматизации.

---

## 10.40. `components/scenes/ChoiceScreen.tsx`

Добавить поддержку:

- `backAction`;
- disabled reason;
- recommended badge;
- максимум шести options на одном экране;
- отсутствие options считается ошибкой flow, а не пустым экраном.

Не обрезать options внутри компонента.

---

## 10.41. Новые компоненты

Создать:

```text
components/scenes/InputScreen.tsx
components/scenes/MultiInputScreen.tsx
components/scenes/MultiChoiceScreen.tsx
components/scenes/ActionConfirmationScreen.tsx
components/scenes/DaySummaryScreen.tsx
components/scenes/CrisisScreen.tsx
components/scenes/HistoryScreen.tsx
```

Компоненты не считают продажи и конверсии.

---

## 10.42. Поддерживающие существующие компоненты

### `components/scenes/NarrativeScreen.tsx`

Оставить покадровый показ строк, но последняя кнопка должна вызывать `scene.action` через единый `onAction`, а не `advanceQueue`.

### `components/scenes/ResultScreen.tsx`

Оставить визуальный компонент результата. Источник данных - `state.lastOutcome`. Компонент не вычисляет delta самостоятельно.

### `components/scenes/GameHud.tsx`

Оставить день, банк и энергию. Во время первого и второго дня HUD также показывается после создания сессии.

Если state уже находится в final, HUD можно скрыть.

### `components/game/GameApp.tsx`

Только передаёт config в SceneEngine. Не хранит flow.

### `app/page.tsx`

Загружает config v2 через `loadGameConfig()`.

### `packages/game-engine/src/index.ts`

Обновить exports новых flow-модулей и типов. Удалить exports legacy-функций, если они больше не используются.

### `scripts/export-sessions.ts`

Проверить экспорт:

- schemaVersion;
- flow stage/step;
- launchPlan;
- audience;
- endingReason;
- dayReports.

Экспорт не должен падать на старых v1-сессиях. Для них добавить поле `legacy: true`.

### `lib/ai/report.ts`

ИИ по-прежнему только объясняет готовую диагностику.

В JSON для ИИ добавить:

- endingReason;
- launchPlan;
- summary dayReports;
- diagnostics.

Не передавать пользовательские строки в system prompt. Они остаются данными внутри JSON.

---

## 10.43. `app/globals.css`

Добавить классы для новых экранов.

Сохранить mobile-first ширину.

Обязательные состояния:

- recommended;
- disabled;
- warning;
- crisis;
- positive result;
- negative result;
- back button;
- input validation;
- sticky HUD.

Не менять графический стиль в рамках архитектурного этапа, кроме необходимого для новых компонентов.

---

# 11. Переходы по командам

## Интро

```text
intro_budget + advance_intro
→ intro_beach

intro_beach + advance_intro
→ day1_product_type
```

## День 1

```text
set_product_type
→ day1_product_name

set_product_name
→ day1_product_price

set_product_price
→ day1_sale_method

set_sale_method
→ day1_nurture

set_nurture
→ day1_entry_point

set_entry_point
→ day1_business_goal

advance_day1_goal
→ day1_dreams

set_dreams
→ day1_summary

complete_day_one
→ day2_intro, day = 2
```

## День 2

```text
advance_day2_intro
→ day2_channels

set_channels
→ day2_metrics

set_audience_metrics
→ day2_summary

complete_day_two
→ daily_intro, day = 3
```

## Обычный день

```text
daily_intro + advance
→ daily_intent

choose_intent
→ action_list

select_action
→ action_configuration или action_confirmation

configure_action
→ следующий config step или action_confirmation

confirm_action
→ action_process

acknowledge_action_process
→ action_result

acknowledge_action_result
→ pendingDecision или day_summary

resolve pendingDecision
→ следующий pendingDecision или day_summary

complete_day
→ daily_intro или final
```

---

# 12. Повторение действий

Игрок может повторять:

- сторис;
- рилсы;
- эфиры;
- вебинары;
- Telegram-прогрев;
- созвоны;
- продажи;
- отдых;
- советы, если repeat policy разрешает.

Каждое повторение:

- снова списывает дни;
- снова списывает энергию;
- снова списывает деньги;
- создаёт новый outcome;
- не повторяет старые экраны технически.

Повторение успешного действия:

- подставляет последний actionId;
- всё равно показывает confirmation;
- пользователь может изменить content type или destination;
- нельзя выполнять автоматически одним нажатием.

---

# 13. История решений

`dayReports` хранится в GameState.

Экран истории показывает по дням:

- действие;
- выбранную конфигурацию;
- результат;
- ключевое последующее решение.

История не должна строиться только из текстового `history`.


# 14. Тесты

Создать точные файлы.

## 14.1. `tests/unit/flow/initial-flow.test.ts`

Проверить:

- session starts on intro_budget;
- day1 full sequence;
- day1 completion sets day 2;
- day2 completion sets day 3;
- targets are zero before price;
- targets recalculate after price and dreams.

## 14.2. `tests/unit/flow/daily-flow.test.ts`

Проверить:

- daily intro;
- intent;
- action selection;
- configuration;
- confirmation;
- process screen;
- result;
- summary;
- next intro.

## 14.3. `tests/unit/flow/no-scene-queue.test.ts`

Архитектурный тест или статическая проверка:

- `SceneEngine.tsx` не содержит `queue`;
- не импортирует `buildPostActionScenes`;
- не импортирует `buildMainChoiceScene`.

## 14.4. `tests/unit/engine/inbound.test.ts`

Проверить:

- inbound creates pending decision;
- manual processing;
- partial processing;
- deferred once;
- second defer unavailable;
- loss without response;
- no temperature field.

## 14.5. `tests/unit/engine/repeat-policy.test.ts`

Проверить:

- never;
- unlimited;
- once per cohort;
- basic consultation upgrade;
- detailed consultation top-up;
- lower upgrade unavailable.

## 14.6. `tests/unit/engine/finish.test.ts`

Проверить:

- finish does not fast-forward;
- time finish;
- goal finish;
- manual finish;
- energy zero is not automatic finish;
- bank zero is not automatic finish.

## 14.7. `tests/unit/engine/resume.test.ts`

Проверить сериализацию:

- intro;
- day1;
- day2;
- action confirmation;
- action result;
- inbound decision;
- day summary;
- final.

## 14.8. `tests/e2e/game-flow-v2.spec.ts`

Полный happy path:

```text
onboarding
→ day1
→ day2
→ action
→ result
→ summary
→ next day
```

Проверить, что одинаковое главное меню не появляется дважды.

## 14.9. `tests/e2e/repeat-action.spec.ts`

Дважды выполнить контентное действие.

Проверить:

- два разных результата;
- ресурсы списаны дважды;
- день изменён;
- нет старого меню перед новым результатом.

## 14.10. `tests/e2e/inbound-flow.spec.ts`

Проверить:

- обычные входящие;
- mini game;
- defer;
- processing;
- потерю.

## 14.11. `tests/e2e/resume-flow.spec.ts`

Перезагрузить страницу на:

- day1 product price;
- day2 metrics;
- confirmation;
- process screen;
- result;
- inbound;
- summary;
- final.

Должен открыться тот же логический экран.

## 14.12. `tests/e2e/final-flow.spec.ts`

Проверить:

- день 30 сразу ведёт в финал;
- early goal choice;
- manual finish;
- lead form back returns to diagnosis.

---

# 15. Fixtures и balance simulator

## `tests/fixtures/scenarios.ts`

Текущий fixture создаёт полный старый SetupInput.

Обновить:

- base setup только profile;
- добавить helper, который выполняет команды дня 1 и 2;
- затем выполнять игровые действия.

Пример helper:

```ts
function completeInitialFlow(
  state: GameState,
  options: {
    productType: string;
    productPrice: number;
    channels: AudienceChannel[];
    reels: number;
    stories: number;
  }
): GameState
```

Или формировать полный список command fixtures.

## `scripts/balance-sim.ts`

Перед основными actions каждый scenario обязан пройти initial flow.

Симулятор не должен напрямую присваивать launchPlan в обход команд, кроме специально помеченного low-level test helper.

После удаления суперсил пересчитать baseline результаты, но не менять коэффициенты в рамках этого задания без отдельного решения.

---

# 16. Совместимость сохранений

Новая версия:

```ts
schemaVersion: 2
configVersion: '2.0.0'
```

Старые незавершённые state версии 1 не мигрировать автоматически.

Причина:

- product data меняет расположение;
- superpowers удаляются;
- flow отсутствует;
- lead model меняется;
- queue не была сохранена.

Поведение:

1. удалить локальный pointer;
2. показать сообщение о несовместимости;
3. предложить новую игру;
4. не падать с runtime error.

---

# 17. Порядок реализации

Работать строго по этапам.

## Этап 1. Документы и версии

- создать этот документ в `docs/game-flow-v2-tz.md`;
- обновить AGENTS;
- создать config v2;
- schemaVersion 2.

Коммит:

```text
docs: define game flow v2 source of truth
```

## Этап 2. Типы и initial state

- PlayerProfile;
- LaunchPlan;
- AudienceResources;
- FlowState;
- PendingAction;
- PendingDecision;
- ActionOutcome;
- DayReport;
- new GameState.

Коммит:

```text
refactor(engine): add canonical flow state v2
```

## Этап 3. Интро, день 1 и день 2

- команды;
- transitions;
- schemas;
- goals;
- tests.

Коммит:

```text
feat(flow): implement story-driven first two days
```

## Этап 4. Удаление scene queue

- resolver;
- SceneEngine rewrite;
- SceneContent;
- new generic screens;
- resume.

Коммит:

```text
refactor(ui): replace scene queue with state resolver
```

## Этап 5. Daily loop

- intents;
- groups;
- pending action;
- confirmation;
- outcome;
- summary;
- history.

Коммит:

```text
feat(flow): implement contextual daily action cycle
```

## Этап 6. Lead model without warmth

- remove temperature;
- explicit defer;
- inbound decision;
- sales;
- followup;
- mini-game.

Коммит:

```text
refactor(engine): replace lead warmth with explicit statuses
```

## Этап 7. Endings and final

- time;
- goal;
- energy crisis;
- bank notice;
- manual finish;
- diagnosis;
- lead form.

Коммит:

```text
feat(flow): implement deterministic endings and final report
```

## Этап 8. Cleanup

- delete script.ts;
- delete decisionFlow.ts;
- remove old config imports;
- remove stale types;
- remove dead CSS;
- update fixtures;
- run all checks.

Коммит:

```text
chore: remove legacy scene flow
```

---

# 18. Команды проверки

Использовать pnpm, потому что `package.json` закрепляет `pnpm@11.7.0`.

```bash
corepack enable
pnpm install

pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm validate:config
pnpm simulate:balance -- --runs 50000
pnpm db:validate
pnpm db:migrate:test
```

Не использовать инструкции `npm`, если pnpm доступен.

---

# 19. Definition of Done

Работа считается завершённой, только если выполнено всё:

- setup содержит только пол, имя, нишу;
- нет familyType;
- нет superpowers;
- день 1 является частью истории;
- день 2 является частью истории;
- рабочий цикл начинается с дня 3;
- в React нет queue сцен;
- текущий экран однозначно получается из GameState;
- результат действия появляется сразу после действия;
- после входящих нет двойного меню;
- после mini-game нет двойного меню;
- на 30-м дне нет устаревшего меню;
- resume возвращает на точный экран;
- нет temperature;
- нет decay;
- нет unprocessedWarm;
- нет текста про тёплого/холодного/горячего лида;
- defer работает один раз;
- energy 0 показывает кризис;
- bank 0 оставляет бесплатные действия;
- early goal даёт выбор;
- manual finish не перематывает дни;
- финальная форма возвращается на diagnosis;
- все тесты проходят;
- build проходит;
- config validation проходит;
- balance simulator не содержит invariant violations.

---

# 20. Самопроверка этого ТЗ

При повторной проверке текущего репозитория учтены следующие реальные проблемы:

1. В `SceneEngine.tsx` действительно существует `queue` и смешанное добавление сцен в начало и конец.
2. После обычной обработки входящих отдельно добавляется новое главное меню.
3. После mini-game отдельно добавляется новое главное меню.
4. Финальные сцены добавляются в конец существующей очереди.
5. Resume всегда создаёт обычное главное меню вместо восстановления текущего шага.
6. Setup содержит family, superpowers, продукт, мечты, каналы и охваты до старта истории.
7. Текущий `GameState.player` содержит данные, которые теперь должны быть разделены между profile, launchPlan и audience.
8. Текущая модель содержит `temperature`, `unprocessedWarm` и decay.
9. `finishGame()` сейчас перематывает состояние до 30-го дня даже при досрочном завершении.
10. `saveSession()` увеличивает DB stateVersion отдельно от state и всегда пишет playing.
11. `commandRequestSchema` принимает неизвестный payload.
12. `GameResult` не хранит полную диагностику и при чтении теряет mistakes и dreams.
13. `AGENTS.md` использует npm-команды, хотя package manager проекта — pnpm.
14. Старый документ требует superpowers и lead decay, поэтому не может оставаться главным источником требований.
15. Отдельная Prisma-миграция нужна только для расширения GameResult; FlowState сохраняется внутри существующего Json `currentState`.
16. Старые сохранения нельзя безопасно продолжить после изменения структуры, поэтому предусмотрено контролируемое прекращение совместимости.
17. Удаление температуры не означает удаление прогрева. Эти механики разделены явно.
18. Коэффициенты продаж, цены и длительности действий не должны произвольно меняться в рамках архитектурной переработки. Исключение — удаление бонусов суперсил, потому что сама механика суперсил отменена.
19. Экран `action_process` теперь имеет отдельную команду перехода и не является недостижимым.
20. `complete_day` не расходует дополнительный день: время уже списано при подтверждении действия.
21. Финализация не дублируется между `/commands` и `/finish`.
22. Новые Prisma-поля nullable, поэтому миграция применима к существующей базе.
23. Для реально существующего пользовательского выбора «база контактов» добавлен отдельный источник и action с конфигурируемой конверсией.

Если агент видит противоречие между этим документом и старым кодом, он должен менять код под этот документ, а не сохранять старое поведение ради обратной совместимости.

---

# 21. Дополнительные обязательные команды поиска перед завершением

Агент должен выполнить:

```bash
rg "queue|setQueue|pushScenes|advanceQueue" components lib
rg "buildMainChoiceScene|buildPostActionScenes|buildInitialPlanScenes" .
rg "familyType|familyOptions|getLegendText" .
rg "superpowers|hasSuperpower" .
rg "temperature|unprocessedWarm|decayCohort|config\.decay" .
rg "player\.productPrice|player\.productType|player\.dreams" .
rg "player\.averageReelViews|player\.averageStoryViews|player\.averageTelegramViews" .
rg "payload: z\.unknown" lib app
```

Ожидаемый результат:

- старые архитектурные символы отсутствуют в рабочем коде;
- старые player-пути отсутствуют;
- generic unknown payload отсутствует;
- допустимы только ссылки в migration notes или старом v1 config.

---

# 22. Что нельзя делать агенту

Запрещено:

- чинить цикл добавлением ещё одного `setQueue`;
- хранить flow только в React;
- вычислять продажи в компонентах;
- скрывать действия через `slice`;
- автоматически выбирать «правильный» путь за игрока;
- блокировать маркетингово плохие решения, если они технически выполнимы;
- возвращать выручку в игровой банк;
- считать стартовые 100 000 ₽ заработком;
- перематывать остаток месяца при ручном завершении;
- добавлять temperature под другим названием;
- использовать `Math.random`;
- менять коэффициенты без отдельной фиксации;
- удалять seeded randomness;
- сообщать об успешной заявке до подтверждения сервера;
- делать большой dashboard вместо последовательных экранов;
- оставлять одновременно старый и новый resolver.

---

# 23. Формат отчёта агента после реализации

Агент должен вернуть:

1. Список изменённых файлов.
2. Список созданных файлов.
3. Список удалённых файлов.
4. Краткое описание новой архитектуры.
5. Какие старые сохранения стали несовместимы.
6. Какие коэффициенты изменились из-за удаления суперсил.
7. Результаты каждой команды проверки.
8. Результат balance simulator.
9. Известные ограничения.
10. Ссылку на commit или PR.

Если какая-либо проверка не пройдена, нельзя писать, что задача завершена.
