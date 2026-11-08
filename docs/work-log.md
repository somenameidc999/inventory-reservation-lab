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

**Initial environment.** The local setup and browser workflows ran with native PostgreSQL and Redis. Docker Compose configuration validation passed. The initial verification ended before the container images finished downloading.

## Docker verification

Codex built and ran the Next.js production app in Docker with Node.js 24.22.2, PostgreSQL 16.15, and Redis 7.4.12. A temporary Compose override added the app container and a PostgreSQL socket for the existing integration tests. Chrome ran the two browser tests from the host against the app container. Both passed. A direct PostgreSQL query confirmed one Field Kit reservation and zero units available. Redis reported 29 seconds remaining on the report cache key.

The reference and the candidate ran the same seven integration tests from a container against a separate database in the PostgreSQL container.

| Implementation | Lock evidence | Observed outcome | Suite |
| --- | --- | --- | --- |
| Reference | `pg_blocking_pids(224)` included Alice's session `223` | Alice received `reserved`. Bob received `out_of_stock`. PostgreSQL stored one reservation with zero stock. | 7 passed, 0 failed |
| Candidate | `pg_blocking_pids(229)` included Alice's session `228` | Both requests received `reserved`. PostgreSQL stored two reservations with zero stock. | 6 passed, 1 failed |

The candidate failed the last-unit assertion. Codex removed the temporary containers and volumes after the checks.

The repository now includes the Docker app and the isolated eval runner. Codex followed the Docker instructions from a clean clone. Both browser tests passed against the Compose app. The reference exited with code `0` and seven passing tests. The patched candidate exited with code `1` and failed only the last-unit test. The eval observed the lock wait in both runs and read one committed reservation for the reference and two for the candidate.
