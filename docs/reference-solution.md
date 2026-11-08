# Reference solution

## Conditional update

The [reservation operation](../src/reservations.ts) updates the inventory row only when the item has stock. PostgreSQL locks the row as part of the update. Under `READ COMMITTED` isolation, a competing update waits for the first transaction to finish. After the first transaction commits, PostgreSQL checks the condition against the updated row. If stock is zero, the second update affects zero rows and the operation returns `out_of_stock`. [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)

The decrement and reservation insert share one transaction. The operation reports success after commit. If the insert fails, rollback undoes the decrement. The schema also rejects negative stock as a separate safeguard. A missing item with a valid identifier produces the same zero-row result as an item with zero stock.

## Observing the race

The [integration test](../test/reservations.test.ts) uses three connections. The observer takes a lock on the reservations table so Alice's insert must wait after her update acquires the inventory row lock. The observer confirms that Alice is waiting, then the test starts Bob's request. The observer uses `pg_blocking_pids` to confirm that Bob is waiting on Alice. The test releases the table lock and checks the request results and committed rows. [PostgreSQL session information functions](https://www.postgresql.org/docs/16/functions-info.html)

The table lock belongs to the test. It lets both requests use the real reservation operation and gives the observer time to see the contested write. The polling deadline makes a missing lock wait fail the test. A separate test sends a synthetic user identifier that violates the reservation's foreign key. This makes the insert fail after the update and lets the test verify rollback.

## Identity and permissions

The [authentication service](../src/auth.ts) checks salted password hashes with scrypt. The browser receives a random session token in an HTTP-only, SameSite cookie. PostgreSQL stores a digest of the token and its expiry. Each protected request resolves the user's current role from PostgreSQL. Signing out deletes the corresponding session.

The server action derives the reservation owner from the session. The history query filters on that owner. Admin pages and actions check the current role, and the stock management and report services repeat the check before reading or writing. These checks matter because a client can send a server action request directly. [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)

## Report cache

The [reporting service](../src/reporting.ts) uses one aggregate query to read committed stock and reservation counts. The [Redis adapter](../src/report-cache.ts) caches the aggregate for 30 seconds. This can save repeated joins and counts when administrators reload or share the report. The report shows the source and generation time so readers can distinguish a snapshot from a fresh query. The project has no production traffic data to quantify the benefit.

The cache holds aggregate data and stays outside the reservation path. If Redis times out, the service reads PostgreSQL. A report can lag behind inventory by up to 30 seconds. The cache uses expiration instead of write-driven invalidation so cache availability cannot affect a reservation. Use a separate cache namespace when multiple independent demo databases share a Redis server.
