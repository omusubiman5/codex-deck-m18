# VSD Craft＋M18 macOS導入手順

## 対象

macOS 13以降で、メーカー標準のVSD Craftを使ってVSD Inside M18からmacOS版Codex Desktopを操作します。Linuxは対象外です。

## 維持される構成

- 15個のLCDキーはCodex Deckアクションを表示・実行する。
- 下部3物理ボタンはVSD Craft標準のシーン切替に使う。
- 必須45操作を15件ずつ収めた3シーンの役割はWindows版と同じ。
- M18のUSB通信、シーン、LCD転送はVSD Craftへ任せる。
- Codex Desktopとの接続は上流Codex DeckのmacOS watcherとローカルCDPを使う。

## 前提

1. macOS版Codex Desktopをインストールする。
2. VSD公式サイトからmacOS版VSD Craftをインストールする。
3. Node.js 20以上をインストールする。
4. M18をMacへ直接USB接続する。

VSD Craftから求められた場合だけ、システム設定の「プライバシーとセキュリティ」でアクセシビリティ、オートメーション、ファイルアクセスを許可します。

## インストール

リポジトリのルートで実行します。

```zsh
chmod +x scripts/install-vsd-craft-codex-deck-macos.sh
./scripts/install-vsd-craft-codex-deck-macos.sh
```

スクリプトは次を行います。

1. Codex DeckとVSD Craft用プラグインをビルド・検証する。
2. 起動中のVSD Craftへ通常終了を依頼する。
3. 既存プラグインを`~/Library/Application Support/CodexDeck/backups`へ保存する。
4. 新しいプラグインをVSD Craft標準のプラグイン保存先へ配置する。
5. Codex接続用LaunchAgentをインストールする。
6. VSD Craftを起動する。

VSD Craft本体、M18ファームウェア、Codex Desktopは変更しません。

## VSD Craftでの設定

Windows版と同じCodex DeckアクションをVSD Craft標準UIから配置します。下部3物理ボタンにはCodexアクションを置かず、各シーンで次のScene Shiftを設定します。

- 左：シーン1（Agent／Navigation／Host／Usage）
- 中央：シーン2（公式キー前半15件）
- 右：シーン3（公式キー後半15件）

シーン設定はVSD Craftが管理するため、Windowsの設定ファイルをMacへ直接コピーせず、Mac上の標準UIで作成します。

## 検証

1. VSD Craftのアクション一覧に`Codex Deck`が表示される。
2. Agent 1をLCDへ置くと状態画像が表示される。
3. AgentキーとCodex MicroアクションがmacOS版Codexへ届く。
4. 下部3ボタンが3シーンを直接切り替える。
5. 45操作が3面へ重複なく配置されている。

macOS実機とM18を接続した最終確認が終わるまでは、macOS対応を「実機検証済み」とは扱いません。
