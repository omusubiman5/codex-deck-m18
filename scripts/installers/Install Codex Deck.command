#!/bin/zsh
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  print -u2 "Codex Deck: this installer is for macOS only."
  exit 1
fi

bundle_root="${0:A:h}"
official_download_page="https://www.vsdinside.com/pages/download"
official_macos_installer="https://download.vsdinside.com/streamdock/mac/VSD-Craft-Installer_Mac.pkg"
plugin_source="$bundle_root/plugin/com.simeo.codex-deck.sdPlugin"
manifest="$plugin_source/manifest.json"
launcher_source="$bundle_root/launcher-macos"
plugin_root="$HOME/Library/Application Support/HotSpot/StreamDock/plugins"
plugin_target="$plugin_root/com.simeo.codex-deck.sdPlugin"
state_root="$HOME/Library/Application Support/CodexDeck"
backup_root="$state_root/backups"
launcher_target="$state_root/launcher-macos"

[[ -f "$manifest" ]] || { print -u2 "Codex Deck: bundled plugin is incomplete."; exit 1; }
[[ -f "$launcher_source/start-codex-deck.sh" ]] || { print -u2 "Codex Deck: bundled macOS launcher is incomplete."; exit 1; }
sdk_version="$(/usr/bin/plutil -extract SDKVersion raw -o - "$manifest" 2>/dev/null || true)"
code_path="$(/usr/bin/plutil -extract CodePathMac raw -o - "$manifest" 2>/dev/null || true)"
[[ "$sdk_version" == "1" && "$code_path" == "bin/plugin.mjs" ]] || {
  print -u2 "Codex Deck: bundled plugin is not a valid VSD Craft package."
  exit 1
}

vsd_app=""
for candidate in "/Applications/VSD Craft.app" "$HOME/Applications/VSD Craft.app" "/Applications/StreamDock.app" "$HOME/Applications/StreamDock.app"; do
  if [[ -d "$candidate" ]]; then vsd_app="$candidate"; break; fi
done
if [[ -z "$vsd_app" ]]; then
  print -n "VSD Craft is not installed. Download and open the official signed installer now? [y/N] "
  read -r answer
  if [[ "${answer:l}" != "y" && "${answer:l}" != "yes" ]]; then
    open "$official_download_page"
    print -u2 "Codex Deck: installation cancelled; the official download page was opened."
    exit 1
  fi
  official_pkg="${TMPDIR:-/tmp}/VSD-Craft-Installer_Mac-$$.pkg"
  trap 'rm -f -- "$official_pkg"' EXIT
  print "Downloading VSD Craft from its official distribution server..."
  /usr/bin/curl --fail --location --show-error --output "$official_pkg" "$official_macos_installer"
  /usr/sbin/pkgutil --check-signature "$official_pkg" >/dev/null || {
    print -u2 "Codex Deck: official VSD Craft package signature verification failed."
    exit 1
  }
  print "The official Apple-signed package was verified. Complete installation in Installer, then run Codex Deck again."
  open -W "$official_pkg"
  exit 0
fi
vsd_name="${vsd_app:t:r}"

if pgrep -x "$vsd_name" >/dev/null 2>&1; then
  osascript -e "tell application \"$vsd_name\" to quit"
  for _ in {1..50}; do
    pgrep -x "$vsd_name" >/dev/null 2>&1 || break
    sleep 0.1
  done
  pgrep -x "$vsd_name" >/dev/null 2>&1 && {
    print -u2 "Codex Deck: close VSD Craft and run the installer again."
    exit 1
  }
fi

mkdir -p "$plugin_root" "$backup_root"
plugin_staging="$plugin_root/.com.simeo.codex-deck.sdPlugin.installing.$$"
launcher_staging="$state_root/.launcher-macos.installing.$$"
trap 'rm -rf -- "$plugin_staging" "$launcher_staging"' EXIT
ditto "$plugin_source" "$plugin_staging"
ditto "$launcher_source" "$launcher_staging"
chmod 755 "$launcher_staging/start-codex-deck.sh" "$launcher_staging/Start Codex Deck.command"

timestamp="$(date +%Y%m%d-%H%M%S)"
if [[ -e "$plugin_target" ]]; then mv "$plugin_target" "$backup_root/com.simeo.codex-deck.sdPlugin-$timestamp"; fi
if [[ -e "$launcher_target" ]]; then mv "$launcher_target" "$backup_root/launcher-macos-$timestamp"; fi
mv "$plugin_staging" "$plugin_target"
mv "$launcher_staging" "$launcher_target"
trap - EXIT

"$launcher_target/start-codex-deck.sh" install
open "$vsd_app"
print "Installed Codex Deck for VSD Craft: $plugin_target"
