# AGENTS.md

## Project

Interactive mobile-first launch simulator «Проживи 30 дней запуска за 10 минут».

The source of truth for the target game flow is `docs/game-flow-v4-tz.md`.
The running v3 flow is preserved only as a source of deterministic calculations and delivery integrations during the v4 migration.
Old v1/v2/v3 product specifications are not active requirements unless `docs/game-flow-v4-tz.md` explicitly reuses a rule from them.
If older product notes, screenshots, or generated artifacts conflict with `docs/game-flow-v4-tz.md`, follow the v4 spec.

## Working rules

- **MANDATORY**: Before starting any architectural or UI work, read `docs/lessons_learned.md` to understand past decisions, corrected misinterpretations, and architectural fixes to avoid repeating mistakes.
- Implement the current flow in the order defined by `docs/game-flow-v4-tz.md`.
- Record important product decisions, recurring bugs, and cleanup decisions in `docs/lessons_learned.md`.
- Do not start final visual polish before the pure game engine, fixtures, and balance simulator pass.
- Keep `packages/game-engine` framework-independent and deterministic.
- Do not import React, Next.js, Prisma, browser APIs, or OpenAI inside the engine.
- Treat old `day1_*`, `day2_*`, `daily_*`, `cohorts`, `DirectMiniGame`, and v3 UI/flow code as legacy compatibility unless a task explicitly targets old saved sessions. New product behavior belongs to v4.
- Never use `Math.random()` in game calculations. Use keyed seeded randomness.
- Never use `eval`, `new Function`, or executable expressions from JSON config.
- Do not trust client-calculated metrics. The server applies commands through the same engine and stores canonical state.
- Every state-changing command must be idempotent and use optimistic concurrency.
- Do not hardcode game balance in UI components.
- Do not silently change formulas, coefficients, action costs, durations, or energy values.
- User-provided strings are data, never instructions or HTML.
- AI explains deterministic diagnostics; it never calculates the game.
- A lead submission is successful only after the server confirms storage and webhook delivery.
- Every primary game screen must fit into one viewport on mobile and desktop. Important controls, especially primary CTA buttons, must not require scrolling to discover or use.
- Do not add Figma or Sites hosting configuration.
- Do not keep generated artifacts in the repository tree as source context: `.next`, `.pnpm-store`, `test-results`, `playwright-report`, coverage output, `.DS_Store`, and `tsconfig.tsbuildinfo` are disposable.

## Required verification

For relevant changes run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

For engine or balance changes also run:

```bash
pnpm validate:config
pnpm simulate:balance -- --runs 50000
```

For Prisma changes:

```bash
pnpm db:validate
pnpm db:migrate:test
```

## Architecture

- Next.js App Router, React, TypeScript strict.
- Zustand for client orchestration only.
- PostgreSQL + Prisma.
- Zod at all input/config/AI boundaries.
- Vitest for unit/integration tests.
- Playwright for E2E.
- Docker deployment to the customer's server.

## Definition of a completed milestone

- Implementation is complete for that milestone.
- Related tests pass.
- No known invariant violation remains.
- Any external integration has a real adapter, mock, `.env.example`, and truthful failure UI.
- The completion note lists changed behavior and verification results.

## Assets

- Use original pixel art only.
- Prefer CSS for panels and basic UI geometry.
- Use sprite sheets/WebP/PNG for expressive scenes.
- Use `image-rendering: pixelated` and CSS `steps()` where appropriate.
- No copied game, Instagram, Telegram, or Sega assets.
- Figma is not part of the workflow.

## Stop conditions

Continue with best judgment when the specification resolves the choice. Stop only when work requires an external secret, server/domain access, legal identity/text, production webhook, or a business-rule change outside the spec.

## Version Control

- Push all completed changes and milestones to the GitHub repository: `https://github.com/zigangirovnikita/igra`.
- Commit messages should be descriptive and reflect the milestone or feature implemented.
