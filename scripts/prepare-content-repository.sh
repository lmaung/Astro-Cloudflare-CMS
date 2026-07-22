#!/bin/sh
set -eu

content_dir="${CONTENT_REPO_PATH:-../astro-boilerplate-cms-content}"
content_repo="${CONTENT_REPO_URL:-https://github.com/lmaung/Astro-Cloudflare-CMS-content.git}"
content_ref="${CONTENT_REF:-main}"

if [ -d "$content_dir/.git" ]; then
  echo "Using existing sibling content repository at $content_dir"
  exit 0
fi

if [ -e "$content_dir" ]; then
  echo "Content path exists but is not a Git repository: $content_dir" >&2
  exit 1
fi

echo "Fetching content repository ref: $content_ref"
if [ -n "${GITHUB_TOKEN:-}" ]; then
  GIT_ASKPASS="$(dirname "$0")/git-askpass.sh" GIT_TERMINAL_PROMPT=0 git clone --filter=blob:none --no-checkout "$content_repo" "$content_dir"
  GIT_ASKPASS="$(dirname "$0")/git-askpass.sh" GIT_TERMINAL_PROMPT=0 git -C "$content_dir" fetch --depth=1 origin "$content_ref"
else
  git clone --filter=blob:none --no-checkout "$content_repo" "$content_dir"
  git -C "$content_dir" fetch --depth=1 origin "$content_ref"
fi
git -C "$content_dir" checkout --detach FETCH_HEAD
