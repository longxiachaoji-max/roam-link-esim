#!/bin/bash
# Install dependencies in Claude Code cloud sessions so lint/build/tests
# and the bundled Next.js docs (node_modules/next/dist/docs) are available.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
export PUPPETEER_SKIP_DOWNLOAD=1
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm install --no-audit --no-fund
