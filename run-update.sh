#!/bin/bash
set -eo pipefail

error_handler() {
  echo "Error occurred in run-update.sh at line $1" >&2
}
trap 'error_handler $LINENO' ERR

cd "$(dirname "$0")"

# Pull remote updates to prevent push conflicts
git pull --rebase

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
else
  echo "Error: nvm.sh not found!" >&2
  exit 1
fi

echo "Using Node: $(node -v)"
echo "Using NPM: $(npm -v)"

# Optimized install that avoids modifying package-lock.json and speeds up execution
npm install --no-save --no-audit --no-fund --prefer-offline

node update.js

# Safeguard: Ensure staging area is clean before adding data files
# to prevent committing developer's manual work-in-progress.
if ! git diff --cached --quiet; then
  echo "Error: Git staging area is not clean. Aborting auto-update to prevent committing staged WIP." >&2
  exit 1
fi

git add public/data.json public/data.js public/history/

if ! git diff --cached --quiet; then
  echo "Changes detected. Committing and pushing..."
  GIT_AUTHOR_NAME="github-actions[bot]" \
  GIT_AUTHOR_EMAIL="github-actions[bot]@users.noreply.github.com" \
  GIT_COMMITTER_NAME="github-actions[bot]" \
  GIT_COMMITTER_EMAIL="github-actions[bot]@users.noreply.github.com" \
  git commit --no-gpg-sign -m "chore: auto-update stock data [skip ci]"
  git push
else
  echo "No data changes detected. Skipping commit."
fi
