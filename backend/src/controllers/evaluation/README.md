# The evaluation engine

One engine for the monthly evaluation of **CSD, Collection, Purchasing and HR & Admin** (the none-sales departments). The same tables, the same
scoring, the same screens. What is different between the departments is **configuration**, not copied code.

## Where things are

| Folder | What it is |
|---|---|
| `controllers/evaluation/` (this folder) | the engine |
| `controllers/csd/` | only what is really CSD: the performance metrics and the email reports |
| `controllers/common/` | the basics shared by every none-sales department: employees, login, teams, managers, positions, departments, images, none-sales feedback / attendance / performance |
| `controllers/system_users/` | the admin users of the system (NOT the HR & Admin department) |
| `routes/evaluation/`, `routes/csd/`, `routes/common/`, `routes/system_users/` | the routes of the folders above |
| `middleware/` | `evaluation_access` (who changes / reads the evaluation), `evaluation_lock` (submitted and resigned), `leadership_access`, `qa_access`, `feedback_access`, `auth` |
| `config/leadership_tasks.js` | the leadership forms |
| `tests/evaluation/` | the tests of the rules (no database needed): `npm run test:evaluation` |

The sales code (`sales_*`) is separate and not part of this engine.

## The files of the engine

| File | Job |
|---|---|
| `evaluation_controller.js` | builds the evaluation of a month (`generateCsdEvaluation`), submit / review, the typed metrics |
| `metrics_queries.js` | the SQL of the evaluation and the metrics |
| `month_snapshot.js` | the employees as they were in a month (assignment and employment of that month) |
| `performance_resolver.js` | typed or computed Performance, the average of the subordinates, the submit order and the review lock of the CSD & Collection Manager |
| `leadership_scores.js`, `leadership_controller.js` | the leadership evaluation (the questionnaire) and its score |
| `received_feedback.js`, `qa_feedback_controller.js` | the feedback of the QA, the immediate head and the members |
| `leaderboard_controller.js` / `_export.js` | the scores (`scoreEmployee`), the leaderboard and its Excel |
| `agent_performance_controller.js` / `_export.js` | Agent Monthly / Yearly and their Excel |
| `team_performance_controller.js` | Team Monthly / Yearly |
| `department_scope.js` | the departments, who may use which one, the staff that is not evaluated |
| `visibility_rules.js` | who sees which rows and details |

## How a request flows
route (`routes/evaluation`) → middleware (token, access, lock) → controller → `generateCsdEvaluation` (the SQL of one month) →
`applyComputedPerformance` → `attachLeadership` → `attachReceivedFeedback` → `scoreEmployee` → the answer.
Every request has `?department=csd|collection|purchasing|hradmin` (`readDepartment` checks that the user may use it).

## Where to change what
- **A new department:** add its code to `DEPARTMENTS` and `DEPARTMENT_LABELS` in `department_scope.js`, a menu and a view on the frontend
  (`frontend/config/departmentViews.js`), and the `departments` row in the database.
- **Which Performance is typed or computed (per department, per month):** `RULES` in `performance_resolver.js`. A rule applies from its month on,
  the older months keep the rule they had.
- **Who sees what:** `visibility_rules.js`. Who may read or change the evaluation: `middleware/evaluation_access.js`.
- **View of the whole department:** a person can be given the manager's view (rows, details, team pages) of one department only, by a row in `department_performance_viewers` (person + department code). The login puts the departments in the token (`viewer_departments`, read by `controllers/common/department_viewers.js`), so the person logs in again after a change. The title, forms, Performance and feedback of the person do not change.
- **The weights, the score tables, the rating names:** the database tables (`evaluation_criteria`, `csd_performance_score`, `result_ratings`...).
- **The leadership forms:** `config/leadership_tasks.js` (`tasksFor`).
- **A person that is not evaluated:** `EXCLUDED_POSITIONS` in `department_scope.js`.

## Rules to remember
- A month that is submitted, and a resigned employee, can not be changed (`middleware/evaluation_lock.js`).
- The CSD & Collection Manager is submitted last (everybody under him must be submitted) and nobody under him can be reviewed while he is
  submitted (`performance_resolver.js`).
- The leadership evaluations and the feedback are confidential: only the giver reads and changes them; admin and poweruser only view.
- Averages of the Performance have 5 decimals, the final rating 4.

## The urls
The addresses of the engine are under `/api/evaluation/...`:

| Address | What |
|---|---|
| `/evaluation/records/:eval_type[/:employee_id]` | the evaluation of the month (read, add, change, delete a metric) |
| `/evaluation/status/:employee_id` | submit (POST) and review (DELETE) |
| `/evaluation/leaderboard/:scope`, `/evaluation/leaderboard_export/:scope` | the leaderboard and its Excel |
| `/evaluation/agent_performance/...`, `/evaluation/agent_performance_export/...` | Agent Monthly / Yearly and their Excel |
| `/evaluation/team_performance/...` | Team Monthly / Yearly |
| `/evaluation/qa_feedback` | the feedback of the Quality Analyst |
| `/evaluation/custom_range[/:employee_id]`, `/evaluation/custom_range_export[/:employee_id]` | the Custom Range: the average of the submitted months between `start_date` and `end_date` (YYYY-MM, 12 months at most), filter `employee_status=all\|hired\|resigned`; admin, poweruser and the GOM (`custom_range_controller.js`, `month_range.js`) |
| `/leadership_evaluations` | the leadership evaluation (it had a neutral name already) |

The first addresses (`/csd_evaluation`, `/csd_evaluation_status`, `/csd_leaderboard`, `/csd_leaderboard_export`, `/csd_agent_performance`,
`/csd_agent_performance_export`, `/csd_team_performance`, `/csd_qa_feedback`) still answer: every route of `routes/evaluation` has both. They are
kept so that an old frontend that is still open keeps working.
**Remove the old address of each route when the servers run the new frontend.**
The CSD only routes keep their names (`/csd_performance_metrics`, the email reports).

## Names that look like CSD but are not
Some functions (`generateCsdEvaluation`) and the tables (`csd_evaluation_status`, `csd_performance_score`) still have `csd` in the name although
they serve all the none-sales departments. They are left as they are on purpose: renaming a table also changes the database and every query.

