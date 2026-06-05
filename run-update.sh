#!/bin/bash
set -e

error_handler() {
  echo "Error occurred in run-update.sh at line $1" >&2
}
trap 'error_handler $LINENO' ERR

cd /home/oharato/workspace/sectorflow-jp

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  source "$NVM_DIR/nvm.sh"
else
  echo "Error: nvm.sh not found!" >&2
  exit 1
fi

echo "Using Node: $(node -v)"
echo "Using NPM: $(npm -v)"

npm ci

node update.js

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

git add public/data.json public/data.js

if ! git diff --cached --quiet; then
  echo "Changes detected. Committing and pushing..."
  git commit -m "chore: auto-update stock data [skip ci]"
  git push
else
  echo "No data changes detected. Skipping commit."
fi
