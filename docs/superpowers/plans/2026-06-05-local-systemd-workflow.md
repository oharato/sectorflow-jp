# Local systemd Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the daily stock scraping script, commit and push changes on weekdays at 16:00 JST using a local systemd user service and timer.

**Architecture:** A wrapper bash script handles the Node/NVM environment setup, dependency installation, scraping execution, and conditional git pushing. A systemd user-level service invokes this script, controlled by a systemd user-level timer scheduled for JST weekdays.

**Tech Stack:** Bash, systemd, Node.js (via NVM), Git, GitHub CLI (gh)

---

### Task 1: Create the wrapper shell script

**Files:**
- Create: `/home/oharato/workspace/sectorflow-jp/run-update.sh`

- [ ] **Step 1: Write the wrapper script code**
  Create `/home/oharato/workspace/sectorflow-jp/run-update.sh` with the following content:
  ```bash
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
  ```

- [ ] **Step 2: Make the script executable**
  Run: `chmod +x /home/oharato/workspace/sectorflow-jp/run-update.sh`
  Expected: Command exits successfully with no output.

- [ ] **Step 3: Test execute the script manually**
  Run: `/home/oharato/workspace/sectorflow-jp/run-update.sh`
  Expected: Output showing NVM Node version, npm ci installing dependencies, "Fetching sector indices...", and ending with "No data changes detected. Skipping commit." (since there is no fresh data diff) or successful commit/push if data changed.

- [ ] **Step 4: Commit**
  Run: `git add /home/oharato/workspace/sectorflow-jp/run-update.sh && git commit -m "feat: add run-update.sh wrapper script"`
  Expected: Git commit completes successfully.

---

### Task 2: Create the systemd user service file

**Files:**
- Create: `/home/oharato/.config/systemd/user/sectorflow-update.service`

- [ ] **Step 1: Write the systemd user service configuration**
  Create the directory if it doesn't exist: `mkdir -p /home/oharato/.config/systemd/user/`
  Write the following content into `/home/oharato/.config/systemd/user/sectorflow-update.service`:
  ```ini
  [Unit]
  Description=Sectorflow JP Auto Update Service
  After=network.target

  [Service]
  Type=oneshot
  WorkingDirectory=/home/oharato/workspace/sectorflow-jp
  ExecStart=/home/oharato/workspace/sectorflow-jp/run-update.sh
  StandardOutput=journal
  StandardError=journal

  [Install]
  WantedBy=default.target
  ```

- [ ] **Step 2: Verify file existence**
  Run: `ls -la /home/oharato/.config/systemd/user/sectorflow-update.service`
  Expected: File exists and contains the correct INI configuration.

---

### Task 3: Create the systemd user timer file

**Files:**
- Create: `/home/oharato/.config/systemd/user/sectorflow-update.timer`

- [ ] **Step 1: Write the systemd user timer configuration**
  Write the following content into `/home/oharato/.config/systemd/user/sectorflow-update.timer`:
  ```ini
  [Unit]
  Description=Run Sectorflow JP Auto Update scheduled task

  [Timer]
  # Run at 16:00 (JST) Monday through Friday (matching cron: '0 7 * * 1-5' UTC)
  OnCalendar=Mon..Fri 16:00:00
  # Run immediately at boot if the last scheduled run was missed
  Persistent=true

  [Install]
  WantedBy=timers.target
  ```

- [ ] **Step 2: Verify file existence**
  Run: `ls -la /home/oharato/.config/systemd/user/sectorflow-update.timer`
  Expected: File exists and contains the correct timer configuration.

---

### Task 4: Register and enable systemd timer

**Files:**
- Modify: none (runs commands)

- [ ] **Step 1: Reload systemd user daemon**
  Run: `systemctl --user daemon-reload`
  Expected: Command exits successfully with no output.

- [ ] **Step 2: Enable the systemd timer**
  Run: `systemctl --user enable sectorflow-update.timer`
  Expected: Output showing symlink creation in `~/.config/systemd/user/timers.target.wants/`.

- [ ] **Step 3: Start the systemd timer**
  Run: `systemctl --user start sectorflow-update.timer`
  Expected: Command exits successfully.

- [ ] **Step 4: Verify active timers**
  Run: `systemctl --user list-timers --all`
  Expected: `sectorflow-update.timer` is listed in the active timers table with next execution time showing next weekday at 16:00 JST.

---

### Task 5: Verify the execution of the systemd service

**Files:**
- Modify: none (runs commands)

- [ ] **Step 1: Manually trigger the service**
  Run: `systemctl --user start sectorflow-update.service`
  Expected: Service starts and runs the wrapper script. It might take a few seconds to run npm ci and update.js.

- [ ] **Step 2: Check execution logs**
  Run: `journalctl --user -u sectorflow-update.service -n 50 --no-pager`
  Expected: Log output showing "Using Node: v24.13.0", "npm ci", "Fetching sector indices from JPX...", and "No data changes detected. Skipping commit." or similar successful output.

- [ ] **Step 3: Confirm service status**
  Run: `systemctl --user status sectorflow-update.service`
  Expected: Status shows "inactive (dead)" but with "Result: success" since it is a `oneshot` service.
