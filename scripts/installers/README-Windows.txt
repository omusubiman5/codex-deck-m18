Codex Deck for VSD Craft - Windows

The plugin manages the Codex connection using VSD Craft's bundled Node runtime.
On VSD Craft startup it starts Codex if absent. No separate bridge shortcut is required.
To recover a connection, select any Codex key in VSD Craft and use
"Codex 接続" > "接続・復旧" in its settings. A required Codex restart asks for
confirmation before closing tasks. Disconnected usage values are hidden.

1. Extract this ZIP completely.
2. Double-click "Install Codex Deck.cmd".

If VSD Craft is missing, the script can download its current MSI directly from
the official VSDinside server. It verifies the Authenticode signature and
expected publisher before opening the vendor installer. The official app is
never copied into this community archive.

The installer closes VSD Craft, disables the conflicting legacy "Codex Deck
M18" startup entry, backs up an existing Codex Deck plugin under
%LOCALAPPDATA%\CodexDeck\backups, installs the bundled plugin, and restarts VSD
Craft. A disabled startup shortcut is preserved under
%LOCALAPPDATA%\CodexDeck\disabled-startup. This community package does not
contain the official VSD Craft app.

The scripts are not code-signed. Verify the archive SHA-256 value against the
SHA256SUMS.txt file published with the GitHub release before running it.
