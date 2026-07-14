# Definition of Done / Release Checklist

## Active v3 Flow
- [ ] Setup collects only gender, name, niche, and superpower.
- [ ] Product, price, dream, reflection, preparation, advice, rest, active stage, report, final diagnosis work in order.
- [ ] Active stage requires ad, warmup, and sales selection before start.
- [ ] Prepared permanent tools persist across loops; prepared ads are consumable.
- [ ] Past attempts are collapsed by default and expand by attempt.
- [ ] Active stage has no distracting top scene image.
- [ ] Terminal conditions are enforced after v3 actions: day 30, goal reached, energy/bank exhausted.
- [ ] Terminal active-stage report leads to final results, not back to reflection.

## Engine
- [ ] Game calculations stay in `packages/game-engine`.
- [ ] No `Math.random()` in game calculations.
- [ ] Money and energy are charged exactly once per command.
- [ ] Revenue does not increase bank.
- [ ] Applications mean warmed interested leads in v3.
- [ ] Manual answers save existing applications from loss; they do not rerun lead-to-application conversion.
- [ ] Sales floors, superpowers, and advice bonuses are applied consistently in engine and displayed conversion hints.
- [ ] Autopurchases, site/webinar direct purchases, and manual sales use non-overlapping application pools.
- [ ] All ad/warmup/sales/superpower conversion combinations are covered by the v3 conversion matrix test.
- [ ] Invariants pass for unit scenarios and balance simulation.

## Final Diagnosis
- [ ] Final status is based on target sales or target revenue.
- [ ] v3 diagnostics use `v3.stageReports`, not only legacy cohorts.
- [ ] Custom dream title and price appear correctly in final results.
- [ ] Bottlenecks identify traffic, warmup, processing, sales, or energy when relevant.
- [ ] AI report never changes calculated metrics.
- [ ] Fallback report works without OpenAI credentials.
- [ ] Final tabs are visible and usable on mobile.

## Lead Form
- [ ] User can reach lead form from final diagnosis via `Получить разбор`.
- [ ] Lead API accepts only finished sessions.
- [ ] PII fields are encrypted before storage.
- [ ] Webhook uses HMAC, retries transient failures, and does not fake success.
- [ ] Missing webhook/encryption env fails truthfully.
- [ ] Back from form returns to diagnosis without losing report.

## Backend
- [ ] Commands are atomic and idempotent.
- [ ] Optimistic concurrency returns current state on conflict.
- [ ] Session access uses the session cookie.
- [ ] Production readiness checks `DATABASE_URL`, `LEAD_WEBHOOK_URL`, `LEAD_WEBHOOK_SECRET`, and `LEAD_ENCRYPTION_KEY`.
- [ ] Backup and restore scripts are tested against a disposable database.

## QA / Deploy
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm validate:config`
- [ ] `pnpm simulate:balance -- --runs 50000`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`
- [ ] 320px, common mobile, and desktop layouts checked.
- [ ] Full path to final diagnosis and lead form covered by e2e.
- [ ] Production healthcheck is green.
