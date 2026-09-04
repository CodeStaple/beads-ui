#!/usr/bin/env bash
# Move beads between a local bd workspace and the GitHub-hosted JSONL database.
#
#   bd-sync.sh pull   GitHub -> local bd   (bd import)
#   bd-sync.sh push   local bd -> GitHub   (bd export)
#   bd-sync.sh diff   show what pull would change
#
# Reads GITHUB_* from .env.local next to this script's parent directory.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$here/.env.local"
[ -f "$env_file" ] || { echo "missing $env_file" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "$env_file"; set +a

: "${GITHUB_OWNER:?}" "${GITHUB_REPO:?}"
branch="${GITHUB_BRANCH:-beads-db}"
path="${GITHUB_PATH:-.beads/issues.jsonl}"
slug="$GITHUB_OWNER/$GITHUB_REPO"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fetch() {
  gh api "repos/$slug/contents/$path?ref=$branch" --jq '.content' \
    | tr -d '\n' | base64 -d > "$tmp/remote.jsonl"
}

case "${1:-}" in
  pull)
    fetch
    echo "fetched $(wc -l < "$tmp/remote.jsonl" | tr -d ' ') beads from $slug@$branch"
    bd import -i "$tmp/remote.jsonl"
    ;;
  diff)
    fetch
    bd import --dry-run -i "$tmp/remote.jsonl"
    ;;
  push)
    bd export -o "$tmp/local.jsonl"
    echo "exported $(wc -l < "$tmp/local.jsonl" | tr -d ' ') beads from the local workspace"
    sha="$(gh api "repos/$slug/contents/$path?ref=$branch" --jq '.sha' 2>/dev/null || true)"
    args=(-f "message=bd: export from $(hostname -s)"
          -f "content=$(base64 < "$tmp/local.jsonl" | tr -d '\n')"
          -f "branch=$branch")
    [ -n "$sha" ] && args+=(-f "sha=$sha")
    gh api "repos/$slug/contents/$path" -X PUT "${args[@]}" --jq '.commit.sha'
    ;;
  *)
    sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
