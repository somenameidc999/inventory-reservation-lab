#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ ! -f "$1" ] || [ ! -r "$1" ]; then
    printf '%s\n' 'Usage: sh evaluation/grade-patch.sh PATH_TO_PATCH' >&2
    printf '%s\n' '{"status":"invalid_patch","reason":"Provide one readable patch file."}'
    exit 2
fi

repo_dir=$(CDPATH='' cd "$(dirname "$0")/.." && pwd)
compose() {
    docker compose -f "$repo_dir/compose.yaml" "$@"
}

if ! compose build eval >&2; then
    printf '%s\n' '{"status":"unverified","reason":"Docker could not build the eval image."}'
    exit 2
fi

eval_exit=0
report=$(compose run --rm -T --no-deps eval node evaluation/grade-patch.mjs < "$1") || eval_exit=$?
if [ -z "$report" ]; then
    printf '%s\n' '{"status":"unverified","reason":"The eval exited before producing a grade."}'
    exit 2
fi

printf '%s\n' "$report"
case $eval_exit in
    0|1) exit "$eval_exit" ;;
    *) exit 2 ;;
esac
