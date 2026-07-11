# Deployment and recovery

Copy `.env.example` to `.env.staging`, replace every secret and set PostgreSQL variables. Start staging with `docker compose -f compose.staging.yaml up -d --build`. The app applies committed Prisma migrations before startup.

Create daily backups with `DATABASE_URL=... ./scripts/backup-db.sh`. The script keeps 14 days by default. Test recovery against a disposable database with `DATABASE_URL=... ./scripts/restore-db.sh backups/<file>.dump`, then run healthchecks and a smoke game. Never test restore against production.

Before deployment run lint, typecheck, unit/integration tests, config validation, 50,000 balance simulations, production build and Playwright. Balance changes must include before/after policy results and must never be hidden inside UI code.
