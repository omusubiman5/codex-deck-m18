Codex Deck for VSD Craft - Windows

1. Extract this ZIP completely.
2. Double-click "Install Codex Deck.cmd".

If VSD Craft is missing, the script can download its current MSI directly from
the official VSDinside server. It verifies the Authenticode signature and
expected publisher before opening the vendor installer. The official app is
never copied into this community archive.

The installer closes VSD Craft, backs up an existing Codex Deck plugin under
%LOCALAPPDATA%\CodexDeck\backups, installs the bundled plugin, and restarts
VSD Craft. This community package does not contain the official VSD Craft app.

The scripts are not code-signed. Verify the archive SHA-256 value against the
SHA256SUMS.txt file published with the GitHub release before running it.
