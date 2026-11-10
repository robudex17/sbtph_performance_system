# SBTPH Performance Hub

Employee performance / leaderboard system. **Sales** is the original department and is in production. **None-sales** departments (csd, collection, purchasing, gom, hradmin; more later) are being added on top of it.

The owner (Rogmer) built this project and wants to understand every part of it. Explain in plain terms, keep changes small and reviewable, and follow the existing patterns.

## Layout

- `backend/` Express + mysql2, JWT auth, socket.io, MinIO/S3 images, exceljs exports, jest tests. Entry: `src/server.js`, app: `src/app.js`, routes in `src/routes`, logic in `src/controllers`, access checks in `src/middleware`.
- `frontend/` Nuxt 3 + Pinia + Tailwind. `baseURL` is `/sbtph_performance_system/`. Per-department `layouts/`, `config/<dept>Menu.js`, `pages/<dept>/`, shared `middleware/`.
- `database/` `leaderboard.sql` (base schema) and `migrations/` (new SQL goes here, one dated file per change).
- `infra/` deploy material (docker, orchestration, `single-server-on-prim-deploy/README.md`). `docs/` architecture PDFs.
- `important_note.txt` and `backend/notes.txt` hold the owner's own notes (table naming plans).

## Commands

- Backend (`cd backend`): `npm run dev` (nodemon), `npm start`, `npm run test:evaluation` (jest, runs in band).
- Frontend (`cd frontend`): `npm run dev`, `npm run build`. Never use `nuxt generate`: the Nuxt server must run (image proxy route in `frontend/server/routes/api/images/`).

## Working rules (agreed with the owner)

- **Never edit sales code** (sales components, pages, stores, controllers). Sales works in production and will be refactored later, together. Build a separate none-sales version instead (`NoneSales*Component`, `useNoneSalesFeedbackQuestions.js`, `stores/feedback_none_sales.js`, ...).
- **Do not run SQL, create tables or rename tables unless asked.** The owner creates tables and rows in their own database and wants to learn first (the `csd_*` -> `evaluation_*` table rename is postponed; it exists in commit a59546f and can be cherry-picked back). Put any SQL in `database/migrations/`.
- **The owner decides commits and pushes.** Do not commit or push unless asked.
- Never put secrets, `.env` values, IPs or passwords in code or docs.
- **Keep this file current.** When a change alters the folder structure, commands, conventions, roles/levels, deploy steps or open work listed here, update this file in the same change. Keep it to stable facts; day-to-day state does not belong here.

## Conventions

- None-sales data is one row per employee per month, month stored as `YYYY-MM` in a column called `year_month`. It is a **reserved word in MariaDB: always backtick it**. Sales uses separate `month` / `year` columns. Sales and none-sales use separate tables (`absences2`, `tardiness2`, `memo2`, `none_sales_performance`, `feedback_by_members`, `feedback_by_heads`, `feedback_by_admin`, `feedback_by_nonesales_qa`; sales keeps `feedback`, `feedback_by_qa`, ...).
- Pages shared by all departments use the `department-layout` middleware (layout comes from `?department_code`, otherwise from the user's token). A new department = one line in that map + `config/<dept>Menu.js` + a layout.
- Menu visibility (`allowedRoles` / `allowedLevels` / `excludedRoles` through `useAccessControl`) is UI only. **The backend must also check** (`middleware/evaluation_access.js`, `leadership_access.js`, `qa_access.js`, `allowedAdmins`).
- Backend evaluation code is in `controllers/evaluation/` (neutral names, see its README). Old `/api/csd_...` urls are kept as aliases; the new ones are `/api/evaluation/...`.
- After changing what goes into the login token (`generate_token.js`, `employees_login_controller.js`) users must log in again.
- Planned renames (see `important_note.txt`): `standardusers` -> `admin_users`, `role` -> `system_role_name`.

## Roles and levels (short)

- admin / poweruser: view-only for leadership evaluation (may not evaluate); Excel exports are admin/poweruser only.
- GOM (level 15): view-only everywhere like poweruser, can switch departments, evaluates his direct reports like any other head.
- Leadership evaluators: levels 15 / 10 / 9 / 8. Forms differ per position (`backend/src/config/leadership_tasks.js`, `tasksFor`).
- CSD & Collections Quality Analyst / Trainer (position id 8, level 9) gives a QA score to staff of level 8 and below; matched by position name (`QA_POSITION_NAME` in `frontend/config/departments.js` and `backend/src/middleware/qa_access.js`).
- Team leader leaderboard levels are 7 and 8 (never 9).
- View of the whole department (manager's view of one department, for a person whose level does not give it): a row in `evaluation_view_access` (employee + department code). The login puts the list in the token (`view_all_departments`), so log in again after a change. Rules: `controllers/evaluation/visibility_rules.js`.
- Evaluation submit/review: level 10 manager row = Submit All; write routes are locked after submit (`middleware/evaluation_lock.js`).

## Deploy (pm2 test server, Ubuntu)

- Frontend on port 3000, backend on 8080, run with pm2 (`sbtph-web`, `sbtph-api`; use unique names on a shared server, never `pm2 restart all`).
- `frontend/.env` `NUXT_PUBLIC_*` values are baked in at **build time**: rebuild after any change. Runtime values (`BACKEND_INTERNAL_URL`, `NITRO_PORT`) go to the pm2 environment (`ecosystem.config.cjs`).
- Redeploy: `git pull`, `npm ci` if packages changed, **run the new SQL migration first**, `npm run build` in frontend, `pm2 restart sbtph-web sbtph-api`.
- Test server has its own database and its own MinIO bucket, separate from production.
- Pictures not showing: check `/api/images/sbtlogo.png` on 8080, then on 3000 (proxy), then the browser Network tab (old full URLs in the database, or `NUXT_IMAGE_BASE_URL` missing at build).

## Open / planned work

Effective-dated scoring rules (a new set of rows with a start month; closed months never change), bonus period average (6 months, free start/end month), Data Uploading and IT departments, collection/purchasing completion, thin per-department pages instead of aliases. Translation and quarterly requests are paused by the managers.

Planned deployment target: Kubernetes (in addition to the current pm2 setup). Starting material is in `infra/docker/` and `infra/container_orchestration/`. Keep the app deployable both ways: no hard-coded hosts or ports, configuration through environment variables (remember `NUXT_PUBLIC_*` are baked in at frontend build time), and images must come from the object store, not local disk.

## Git

Local branch `master`; remotes: `new_origin` = `sbtph_performance_system` (current), `origin` = old `abc_performance_system`. One branch per change (`feature/...`, `fix/...`, `refactor/...`).

## Notes for Claude

Detailed history and decisions are kept in the owner's local Claude memory (not in git). On a new machine this file is the starting point; ask the owner for current state before assuming the open items above are still open.
