CODEX DECK LAUNCHER

1. Install Node.js 20 or newer.
2. Double-click "Start Codex Deck.cmd" instead of launching Codex normally.
3. Keep that Codex session open while using the Stream Deck plugin.

If Codex is already running from this launcher, running it again reuses the
existing debug session instead of closing and reopening Codex. Use
`Start-CodexDeck.ps1 -ForceRestart` only when you explicitly want a clean
restart.

If Codex was started normally without a debug port, the launcher leaves that
session untouched and exits with instructions. Save all work and use
`-ForceRestart` only when you explicitly accept restarting every Codex task.

Recommended: run `Start-CodexDeck.ps1 -InstallStartup` once. This installs a
durable private launcher copy under `%LOCALAPPDATA%\CodexDeck\launcher` plus a
single hidden background watcher that stays active after Windows sign-in. It
detects Codex restarts and app updates, removes stale bridge data, and reuses a
healthy bridge. It never restarts an unbridged Codex session automatically.

Installing the watcher never restarts an already-open normal Codex session.
After you next close Codex normally, launch it through Codex Deck to create the
loopback bridge. Windows logins and Codex updates do not grant restart permission.

Remove the watcher with `Start-CodexDeck.ps1 -UninstallStartup`. Diagnostics
are written to `%LOCALAPPDATA%\CodexDeck\watcher.log`.

Optional Mac pairing: after configuring the relay on the Mac, run
`Configure-CodexDeckRelay.ps1 -MacAddress 127.0.0.1 -SshHost <Mac SSH alias>`.
Paste the token into the hidden prompt instead of placing it on the command
line. The watcher keeps this dedicated SSH relay tunnel alive and
does not reuse Codex desktop's remote-CLI SSH process. Restart the Stream Deck
plugin, not Codex. Remove the relay with `-Disable`.

Optional iPhone node on the same Wi-Fi: run
`Configure-CodexDeckMobile.ps1 -Local`, reload only the Codex Deck Stream Deck
plugin, and scan the opened QR code with the iPhone Camera. Nearby mode binds
only to the selected private LAN address, uses pinned TLS, and advertises only
non-secret Bonjour metadata. If Windows asks, allow Node.js on Private networks
only. Disable it with `Configure-CodexDeckMobile.ps1 -Local -Disable`.

For control away from home, keep the separate Tailscale path: run
`Configure-CodexDeckMobile.ps1`, configure private Tailscale Serve as described
in docs/IOS.md, and enter its wss:// URL and printed token in the app. Disable
that listener with `Configure-CodexDeckMobile.ps1 -Disable`.

This is an unofficial compatibility bridge and may need an update after a Codex
desktop release.
