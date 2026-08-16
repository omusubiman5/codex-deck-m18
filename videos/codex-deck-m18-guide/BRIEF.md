---
workflow: faceless-explainer
flow: automation
storyboard: yes
message: "M18の18ボタンが、そのままCodex Microの操作パネルになる"
destination: youtube
aspect: 1920x1080
language: ja
audience: Codex Desktopを使う開発者。M18やCodex Deckを知らない人にも伝わること
length: 150s
angle: concept-howto
---

## Intent

Codex Deck M18（OSSリポジトリ `codex-deck-m18`）が何をするライブラリなのかを、初見の開発者にわかりやすく説明する動画。
「キーボードショートカットのマクロツールではなく、Codex Micro本体の機能を物理キーから直接叩く」という点を核に、
接続構成 → 15キーの割当 → Agent状態表示 → 下段3ボタン → 2つの導入方式（VSD Craft推奨／フルOSS）→ 導入コマンドまでを順に見せる。
尺は「わかりやすさ優先・尺は問わず」との指定のため、詰め込みすぎない範囲で約2分30秒を目安とする。

## Assets

- public/keys/*.png — リポジトリ HEAD の `static/imgs/actions/` にある実配布ボタン画像（Codex Micro 15面 + Codex Tools 15面）。キー割当シーンとステータスシーンの主役。
- public/sheets/*.png — `static/imgs/sheets/` のシート画像。面全体の俯瞰カットに使用。
- public/product/m18-product.png — M18本体の製品写真（ユーザー提供のAmazon掲載画像）。オープニングとクロージング。
- public/bgm.mp3 — ユーザー指定BGM「風の木琴」。全編の音楽ベッド。

## Customizations

- ナレーション：IRODORI-TTS（日本語ローカルTTS）。HeyGen/Kokoroは使用しない。
- BGM：HeyGen音楽ライブラリではなくユーザー提供の `風の木琴 (1).mp3` を使用。
- デザイン：`C:\Users\HOMEA\Documents\Downloads\DESIGN.md`（Mizunoデザイン仕様）を**レイアウト規範**として採用
  （タイポ階層、フラットなカード、shadow最小、border-radius 3px、tag pillは30px、余白スケール 3/5/7/18/24/48px、
  本文 line-height 1.67、palt不使用、Roboto + Hiragino Kaku Gothic ProN / Noto Sans JP チェーン）。
  ただし配色はM18/Codex側へ置換（ダーク基調 + M18のティール、Mizuno Blue #001489 は使用しない）。
- 15キーグリッド、Agent状態色、下段3ボタンの図解を必ず含める（ユーザー明示要求：画像・画面イメージ・ボタン構成を使う）。

## Notes

- 非公式OSSである旨（OpenAI／M18メーカーの公式製品ではない）を動画内で明示する。
- ボタン画像は現在のワーキングツリーでは削除済みのため、`git show HEAD:...` で取り出して `public/` に配置する。
- ライセンス構成（MIT / GPL-3.0-only アダプター / MPL-2.0 mirajazz）は1カットで触れる程度に留める。
- Linuxは対象外。macOSはVSD Craft方式のみ。
