# Assignment brief

A small equipment storeroom lets staff reserve a unit of a stocked item. Two staff members can request the same item at the same time. A successful reservation must consume one unit and record which staff member reserved it.

## Scope

Implement a local browser application using Next.js, TypeScript, Tailwind CSS, PostgreSQL, and Redis. Use synthetic accounts and stock. Staff and administrators can view inventory and reserve one unit per request. Administrators can add equipment, increase stock, and read a report.

### AUTH-01. Sign in and sign out

1. Valid demo credentials start a session and let the account use the workspace.
2. Invalid credentials return the same error for an unknown username or an incorrect password.
3. A user without a valid session cannot access workspace pages or actions.
4. Sign-out revokes the session on the server. Reusing an expired or revoked token does not grant access.

### PERM-01. Enforce permissions on the server

1. The server uses the signed-in identity for reservation writes and history reads. One user cannot read another user's reservation history.
2. A staff account cannot create equipment, restock equipment, or read a stock report, including when a cached report exists.
3. A staff account that submits an admin action directly sees a permission error. The request leaves inventory unchanged.

### INV-01. Manage available stock

1. Signed-in accounts can see item identifiers, names, and live quantities.
2. An administrator can add a unique item identifier and a nonempty name with starting stock from 0 to 1,000,000 units.
3. An administrator can restock an existing item by a positive whole number. The resulting quantity cannot exceed 1,000,000.
4. Invalid quantities, invalid identifiers, and duplicate item identifiers leave the affected inventory unchanged. An item identifier has at most 40 lowercase letters, digits, or hyphens and starts with a letter or digit.

### RES-01. Reserve the last unit

The fixture includes an item with one available unit and two distinct staff members. When two valid requests overlap for that item:

1. Exactly one request returns a successful reservation.
2. The other request returns a recognizable out-of-stock result.
3. The database stores exactly one reservation for the successful request.
4. The item's available quantity is zero.

Provide an integration test that demonstrates the requests overlapped at the reservation write. Include the observed evidence and assert both results and the persisted rows.

### RES-02. Roll back a failed reservation

When stock is available but the reservation insert fails:

1. The request reports a failure.
2. The available quantity stays at its original value.
3. The failed request leaves no reservation record.
4. A subsequent valid request can reserve the unit.

Provide an integration test that causes a database insert to fail and checks the resulting state.

### RPT-01. Report stock and reservations

1. An administrator sees available units and total committed reservations for each item.
2. Redis may serve a report snapshot for up to 30 seconds. The page shows the generation time and source.
3. The report reads PostgreSQL when Redis is unavailable. Inventory and reservation operations continue to use live PostgreSQL data.

## Exclusions

The reservation concurrency requirement covers one existing item and one unit per request. An unknown item with a valid identifier receives the same result as an item with zero stock. Multi-item transactions, cancellation, reservation expiry, request deduplication, inventory deletion, account registration, password reset, login rate limiting, and production hosting are outside the exercise. The application has one storeroom and no tenant boundary.
