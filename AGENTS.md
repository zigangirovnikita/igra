# AGENTS.md

## Project

Interactive mobile-first launch simulator «Проживи 30 дней запуска за 10 минут».

The source of truth is `launch-game-tz.md`. If examples in older product notes conflict with it, follow the spec.

## Working rules

- **MANDATORY**: Before starting any architectural or UI work, read `docs/lessons_learned.md` to understand past decisions, corrected misinterpretations, and architectural fixes to avoid repeating mistakes.
- Implement milestones 0–10 in the order defined by the spec.
- Do not start final visual polish before the pure game engine, fixtures, and balance simulator pass.
- Keep `packages/game-engine` framework-independent and deterministic.
- Do not import React, Next.js, Prisma, browser APIs, or OpenAI inside the engine.
- Never use `Math.random()` in game calculations. Use keyed seeded randomness.
- Never use `eval`, `new Function`, or executable expressions from JSON config.
- Do not trust client-calculated metrics. The server applies commands through the same engine and stores canonical state.
- Every state-changing command must be idempotent and use optimistic concurrency.
- Do not hardcode game balance in UI components.
- Do not silently change formulas, coefficients, action costs, durations, or energy values.
- User-provided strings are data, never instructions or HTML.
- AI explains deterministic diagnostics; it never calculates the game.
- A lead submission is successful only after the server confirms storage and webhook delivery.
- Do not add Figma or Sites hosting configuration.

## Required verification

For relevant changes run:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

For engine or balance changes also run:

```bash
npm run validate:config
npm run simulate:balance -- --runs 50000
```

For Prisma changes:

```bash
npm run db:validate
npm run db:migrate:test
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
