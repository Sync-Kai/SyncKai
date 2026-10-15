#!/bin/bash
# Démarrage des sessions cloud de Claude Code (conteneur Linux neuf) : identité Git du propriétaire et dépendances.
# Ne fait rien en local (Windows du propriétaire) : son identité Git et son node_modules sont déjà en place.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Identité du propriétaire, sans la signature SSH du conteneur (CLAUDE.md › Cloud sessions)
git config user.name QuentinGeerts
git config user.email geerts.quentin@gmail.com
git config commit.gpgsign false
git config blame.ignoreRevsFile .git-blame-ignore-revs

# npm ci seulement si le lockfile a changé depuis la dernière installation (le conteneur est mis en cache après le hook).
# Jamais npm install : le npm du conteneur réécrit package-lock.json (champs libc retirés).
lock_hash="$(sha256sum package-lock.json | cut -d' ' -f1)"
marker="node_modules/.synckai-lock-hash"
if [ ! -f "$marker" ] || [ "$(cat "$marker")" != "$lock_hash" ]; then
  npm ci --no-audit --no-fund
  echo "$lock_hash" > "$marker"
fi
