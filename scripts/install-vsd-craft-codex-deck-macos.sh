#!/bin/zsh
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  print -u2 "Codex Deck: this installer is for macOS only."
  exit 1
fi

script_dir="${0:A:h}"
root="${script_dir:h}"
plugin_source="$root/dist-vsd-craft/com.simeo.codex-deck.sdPlugin"
plugin_root="$HOME/Library/Application Support/HotSpot/StreamDock/plugins"
plugin_target="$plugin_root/com.simeo.codex-deck.sdPlugin"
state_root="$HOME/Library/Application Support/CodexDeck"
backup_root="$state_root/backups"
launcher="$root/release/codex-deck-launcher-macos/start-codex-deck.sh"

node_candidate=""
node_candidates=()
if command -v node >/dev/null 2>&1; then node_candidates+=("$(command -v node)"); fi
node_candidates+=(/opt/homebrew/bin/node /usr/local/bin/node)
for candidate in "$HOME"/.nvm/versions/node/*/bin/node(N); do
  node_candidates+=("$candidate")
done
for candidate in "${node_candidates[@]}"; do
  [[ -x "$candidate" ]] || continue
  version="$($candidate --version 2>/dev/null)" || continue
  major="${${version#v}%%.*}"
  if [[ "$major" == <-> && "$major" -ge 20 ]]; then
    node_candidate="$candidate"
    break
  fi
done
if [[ -z "$node_candidate" ]]; then
  print -u2 "Codex Deck: Node.js 20 or newer is required to build the VSD Craft plugin."
  exit 1
fi

vsd_app=""
for candidate in "/Applications/VSD Craft.app" "$HOME/Applications/VSD Craft.app" "/Applications/StreamDock.app" "$HOME/Applications/StreamDock.app"; do
  if [[ -d "$candidate" ]]; then
    vsd_app="$candidate"
    break
  fi
done
if [[ -z "$vsd_app" ]]; then
  print -u2 "Codex Deck: VSD Craft was not found. Install the official macOS app first."
  exit 1
fi
vsd_name="${vsd_app:t:r}"

cd "$root"
"$node_candidate" scripts/build.mjs
"$node_candidate" scripts/build-launcher.mjs
"$node_candidate" scripts/build-vsd-craft.mjs
"$node_candidate" scripts/validate-vsd-craft.mjs

if [[ ! -d "$plugin_source" || ! -f "$plugin_source/manifest.json" ]]; then
  print -u2 "Codex Deck: the VSD Craft plugin build is incomplete."
  exit 1
fi

if pgrep -x "$vsd_name" >/dev/null 2>&1; then
  osascript -e "tell application \"$vsd_name\" to quit"
  for _ in {1..50}; do
    pgrep -x "$vsd_name" >/dev/null 2>&1 || break
    sleep 0.1
  done
  if pgrep -x "$vsd_name" >/dev/null 2>&1; then
    print -u2 "Codex Deck: VSD Craft did not quit. Close it and run this installer again."
    exit 1
  fi
fi

mkdir -p "$plugin_root" "$backup_root"
if [[ -e "$plugin_target" ]]; then
  timestamp="$(date +%Y%m%d-%H%M%S)"
  backup="$backup_root/com.simeo.codex-deck.sdPlugin-$timestamp"
  mv "$plugin_target" "$backup"
  print "Backed up existing plugin: $backup"
fi

staging="$plugin_root/.com.simeo.codex-deck.sdPlugin.new.$$"
trap 'rm -rf -- "$staging"' EXIT
ditto "$plugin_source" "$staging"
mv "$staging" "$plugin_target"
trap - EXIT

if [[ ! -x "$launcher" ]]; then chmod 755 "$launcher"; fi
"$launcher" install
open "$vsd_app"

print "Installed Codex Deck for VSD Craft: $plugin_target"
print "Codex Deck macOS watcher installed. VSD Craft has been started."
