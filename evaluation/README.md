# Sample evaluation

This sample grades an AI-authored candidate for the reservation operation. Codex authored the candidate and the reference. The candidate is a teaching fixture for an evidence-based review. The score covers RES-01 and RES-02 because the [candidate patch](candidate.patch) changes only the reservation operation.

## Result

**Candidate score 2/4.** The double booking fails the RES-01 acceptance gate.

| Criterion | Score | Observed evidence |
| --- | --- | --- |
| [RES-01](../docs/rubric.md) | 0/2 | PostgreSQL reported Bob waiting on Alice. Both requests returned `reserved`. Two rows persisted with zero units left. |
| [RES-02](../docs/rubric.md) | 2/2 | The failed insert left one unit and no reservation. A valid retry succeeded. |

```text
pg_blocking_pids(85839) included Alice's session 85838
Observed Alice=reserved, Bob=reserved, reservations=2, available=0
pass 6
fail 1
```

## Defect and correction

The candidate reads `available` before acquiring the write lock. Both requests read `1`. Bob waits for Alice's write to commit, then sets stock to the same precomputed value of `0` and inserts another reservation. The database's stock constraint allows zero, so it cannot detect the second reservation. A test that checks only the final stock value would miss the defect.

The [reference correction](../src/reservations.ts) makes `available > 0` part of the update and inserts a reservation only when the update changes a row. After Alice commits, PostgreSQL checks the condition against her committed row. Bob receives `out_of_stock` and only Alice's reservation persists. The corrected suite passes all seven integration tests.

The test proves the observed last-unit schedule against real PostgreSQL. It does not measure contention at scale or cover multi-item reservations.

## Reproduce

From a clean checkout, create a disposable worktree and run the shared suite with the candidate patch. Expect one failing test. Reverse the patch and run the same command again. Expect seven passing tests.

```sh
candidate_dir=$(mktemp -d)
git worktree add --detach "$candidate_dir" HEAD
git -C "$candidate_dir" apply evaluation/candidate.patch
(cd "$candidate_dir" && npm ci && npm test)
git -C "$candidate_dir" apply -R evaluation/candidate.patch
(cd "$candidate_dir" && npm test)
git worktree remove --force "$candidate_dir"
```
