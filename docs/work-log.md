# Work log

## Milestone 1. Reserve the last unit

**Human contribution.** The project owner chose a conditional update for the single-item reservation. They asked for a PostgreSQL lock observation so the test would demonstrate overlapping writes.

**AI assistance.** Codex explained the transaction behavior and drafted the brief, rubric, reference implementation, integration tests, and local test runner. Codex also ran the checks below.

**Verified outcome.** With Node.js 22.22.3 and PostgreSQL 16.13, `npm ci` and `npm run typecheck` exited successfully. `npm test` reported 2 passed, 0 failed.

- [RES-01](assignment.md#res-01-reserve-the-last-unit) The test observed that `pg_blocking_pids(47053)` included session `47052`. Bob was waiting on Alice. Alice reserved the unit, Bob received `out_of_stock`, and the database stored one reservation for Alice with zero units remaining. Session IDs change on each run.
- [RES-02](assignment.md#res-02-roll-back-a-failed-reservation) PostgreSQL rejected an unknown user with foreign key error `23503`. The database still showed one available unit and no reservation. A valid retry succeeded.
- **Regression check.** In a temporary copy, Codex removed `AND available > 0` and reran the suite. The test still observed Bob waiting on Alice. Bob then hit check constraint error `23514` instead of returning `out_of_stock`. The race test failed and the rollback test passed.

**Human review.** The project owner scored a hypothetical submission 1/2 on RES-01. The submission used `Promise.all` and showed correct results and stored rows. The project owner identified the missing evidence of overlap and proposed observing a PostgreSQL lock wait for full credit.

## Full local reference

The project owner asked Codex to proceed through the remaining scope before discussing the AI trainer role. Codex implemented the browser workflows, authentication, permission checks, inventory administration, and reporting. Codex wrote and ran the sample evaluation. The project owner's review contribution above applies to the race evidence criterion.

**Verified outcome.** On PostgreSQL 16.13, all seven integration tests passed on Node.js 22 and 26. Type checking and the Next.js production build passed. Both browser tests passed with Redis 8.10.3 and with Redis configured on an unused port. The browser sent a captured admin action as staff. The action returned a permission error, and the attempted item did not appear in inventory. A local Redis read showed 30 seconds remaining on a new report cache key.

**Evaluation outcome.** The AI-authored candidate scored 2/4 on the two reservation criteria. The same integration suite passed six tests and failed the last-unit test. PostgreSQL recorded two reservations after both requests reported success. The conditional update in the reference passed all seven tests. The [sample evaluation](../evaluation/README.md) explains the defect and how to reproduce it.

**Environment limits.** The local setup and the browser workflows ran with native PostgreSQL and Redis. Docker Compose configuration validation passed. The container images did not finish downloading during verification, so the Docker alternative was not run.
