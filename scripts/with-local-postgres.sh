#!/bin/sh
set -eu

for binary in initdb pg_ctl; do
    if ! command -v "$binary" >/dev/null 2>&1; then
        printf '%s\n' "PostgreSQL executable '$binary' must be on PATH." >&2
        exit 1
    fi
done

test_dir=$(mktemp -d /tmp/inventory-lab.XXXXXX)
data_dir="$test_dir/data"

cleanup() {
    if [ -f "$data_dir/postmaster.pid" ]; then
        if ! pg_ctl -D "$data_dir" -m fast -w -t 15 stop >/dev/null; then
            printf '%s\n' "Could not stop disposable PostgreSQL. Kept $test_dir." >&2
            return 1
        fi
    fi
    rm -rf "$test_dir"
}

trap cleanup 0
trap 'exit 130' INT
trap 'exit 143' TERM

initdb -D "$data_dir" --username=inventory_lab --no-locale --encoding=UTF8 \
    --auth-local=trust --auth-host=reject >/dev/null
if ! pg_ctl -D "$data_dir" -l "$test_dir/postgresql.log" \
    -o "-h '' -k $test_dir -p 5432" -w -t 15 start >/dev/null; then
    cat "$test_dir/postgresql.log" >&2
    exit 1
fi

if [ "$#" -eq 0 ]; then
    set -- node --test test/reservations.test.ts
fi

INVENTORY_TEST_SOCKET="$test_dir" \
    DATABASE_URL="postgresql://inventory_lab@localhost/postgres?host=$test_dir&sslmode=disable" \
    "$@"
