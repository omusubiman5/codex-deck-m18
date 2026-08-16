---
format: 1920x1080
duration: 170s
message: "M18の18ボタンが、そのままCodex Microの操作パネルになる"
arc: フック → 課題 → 概念の提示 → 接続構成 → キー割当（上段・中段・下段） → 2つの導入方式 → 導入手順 → ライセンス → CTA
audience: Codex Desktopを使う開発者。M18もCodex Deckも知らない状態で見る
mode: collaborative
music: none
language: ja
arc_structure: concept-explainer with process
---

## Frame 1 — フック：ショートカットではない

- scene: 黒地に「ショートカットを送るだけ？」の大きな和文が組み上がり、最後の一語だけがティールに反転する
- voiceover: "ストリームデッキ風のデバイスは、ふつうキーボードショートカットを送るだけです。これは、そこが違います。"
- duration: 9s
- transition_in: cut
- status: built
- src: compositions/frames/01-hook.html
- type: hook
- persuasion: Common-belief vs reality（対比）
- beat: 意外性＋認識（surprise + recognition）
- blueprint: kinetic-type-beats

narrativeRole: 「物理デバイス＝マクロツール」という前提を最初の3秒で壊し、この動画が何を説明するのかの隙間を作る。
keyMessage: このデバイスはショートカットを送っているのではない。

## Frame 2 — 課題：手元に状態が届かない

- scene: 3枚のキーが並ぶが、どれも同じ灰色で無表情。右にCodex側のタスク一覧が動いているのに、キーは変わらない
- voiceover: "ショートカットでは、エージェントが今考えているのか、答え待ちなのかは分かりません。手元には、状態が届きません。"
- duration: 10s
- transition_in: crossfade
- status: built
- src: compositions/frames/02-problem.html
- type: pain_point
- persuasion: Counterexample（うまくいかない場合を先に見せる）
- beat: もどかしさ（recognition + friction）
- blueprint: kinetic-type-beats

narrativeRole: 「入力は送れても状態は返ってこない」という一方通行の欠落を、視覚的な無変化で体感させる。
keyMessage: マクロは一方通行で、Codexの状態を持って来られない。

## Frame 3 — 正体：Codex Deck M18

- scene: プロジェクト名がロックアップとして組み上がり、下に「Codex Micro 操作デバイス／OSS」のラベルが並ぶ
- voiceover: "Codex Deck M18は、M18というデバイスを、Codex Microの操作パネルに変えるOSSです。ショートカットに翻訳するのではなく、Codex Desktopに直接つながります。"
- duration: 13s
- transition_in: crossfade
- status: built
- src: compositions/frames/03-intro.html
- type: product_intro
- persuasion: Distillation（一行への圧縮）
- beat: 方向づけ（orientation）
- blueprint: logo-assemble-lockup

narrativeRole: 主役（＝この考え方）に名前を与え、動画の主張を1行で置く。
keyMessage: M18をCodex Microのネイティブ操作パネルにするOSSである。

## Frame 4 — 接続構成：4段のチェーン

- scene: 上から Codex Desktop → Codex Deckプラグイン → VSD Craft → M18 の4段が順に降りて接続され、各段の間に通信方式のラベルが灯る
- voiceover: "つなぎ方は、四段のチェーンです。Codex Desktop、Codex Deckプラグイン、VSD Craft、そしてM18。ローカルのCDP経由で、Micro自身が使うイベントと状態を読み書きします。"
- duration: 14s
- transition_in: push-slide UP
- status: built
- src: compositions/frames/04-chain.html
- type: feature_showcase
- persuasion: Causal chain（A→B→C）
- beat: 理解（comprehension）
- blueprint: spatial-pan-stations

narrativeRole: 「直接つながる」を具体的な4層の経路として見せ、以降のキー説明の土台を作る。
keyMessage: プラグインがCDPでCodexに接続し、USB側はVSD Craftが担う。

## Frame 5 — 面の全体：15キー＋下段3ボタン

- scene: M18の輪郭が引かれ、5列×3行のLCDキーグリッドが実キー画像で埋まり、下に3つの物理ボタンが点る
- voiceover: "M18のLCDキーは十五個。上からエージェント六個、アクション六個、そしてナビゲーション三個です。"
- duration: 12s
- transition_in: zoom-through
- status: built
- src: compositions/frames/05-layout.html
- type: feature_showcase
- persuasion: Frame-then-fill（器を示してから埋める）
- beat: 全体把握（orientation + comprehension）
- blueprint: grid-card-assemble
- asset_candidates: public/keys/*.png — 実配布のキー画像15枚（Codex Micro面）

narrativeRole: これから3つの段を順に説明するための「舞台」を一度に見せ、以降のフレームはこの同じ盤面の上で進む。
keyMessage: 15キーは6＋6＋3の三段構成で、下段に物理ボタンが3つある。

## Frame 6 — 上段：Agent 1〜6

- scene: 同じ盤面のまま上段6キーだけが持ち上がり、右にCodexのタスク一覧が並んで線でつながる
- voiceover: "上段の六個は、Codex SettingsのMicroで選んだエージェントにそのままつながります。今開いているタスクと、手元のキーが同期します。"
- duration: 12s
- transition_in: push-slide LEFT
- status: built
- src: compositions/frames/06-agents.html
- type: feature_showcase
- persuasion: Progressive disclosure（段を一つずつ開く）
- beat: 理解（comprehension）
- blueprint: grid-card-assemble
- asset_candidates: public/keys/micro-01..06-agent-*.png — Agent 1〜6のキー画像

narrativeRole: 上段の役割を確定させ、次フレームの「状態表示」の主語を用意する。
keyMessage: 上段6キーはCodex側で選ばれたAgentと1対1で同期する。

## Frame 7 — 状態表示：色が状態

- scene: Agent 1のキーが中央に大きく置かれ、縁のリング色が 白→青→緑→橙→赤 と切り替わり、横に和文ラベルが積み上がる
- voiceover: "キーの縁の色が、状態です。白は待機、青は作業中、緑は完了未読、オレンジは入力待ち、赤はエラー。"
- duration: 14s
- transition_in: crossfade
- status: built
- src: compositions/frames/07-status.html
- type: benefit_highlight
- persuasion: Progressive disclosure ＋ Demonstration（実物の色を順に見せる）
- beat: 「なるほど」（aha）
- blueprint: fixed-anchor-cycle
- asset_candidates: public/keys/micro-01-agent-1-status-*.png — 6状態の実キー画像

narrativeRole: Frame 2で作った「状態が届かない」欠落を、ここで具体的に埋める。動画の最大の見せ場。
keyMessage: 状態はキーの縁色として物理的に見える。

## Frame 8 — 中段：ACT06〜ACT12

- scene: 中段6キーが並び、FAST／APPR／REJ／SPLIT／MIC／CODEX のラベルが一つずつ下に付く
- voiceover: "中段の六個は、Fast、Approve、Reject、Fork、Dictation、Send。Codex Microがそのまま持っている操作です。"
- duration: 12s
- transition_in: push-slide LEFT
- status: built
- src: compositions/frames/08-actions.html
- type: feature_showcase
- persuasion: Numbered enumeration（並列の6項目）
- beat: 前進感（momentum）
- blueprint: grid-card-assemble
- asset_candidates: public/keys/micro-07..12-*.png — アクション6キーの画像

narrativeRole: 中段の中身を列挙し、次フレームの「これはマクロではない」という反転の材料を置く。
keyMessage: 中段はCodex Microの主要アクション6つに対応する。

## Frame 9 — スロットであってマクロではない

- scene: 「FAST」ラベルの下の中身が ACT06 という枠に変わり、Codex側の設定を変えると枠の中身が差し替わる
- voiceover: "これは名前を埋め込んだマクロではなく、アクションスロットです。Codex側で割り当てを変えると、表示も動作も付いてきます。"
- duration: 11s
- transition_in: crossfade
- status: built
- src: compositions/frames/09-slots.html
- type: benefit_highlight
- persuasion: Common-belief vs reality（マクロという誤解の否定）
- beat: 納得（conviction）
- blueprint: panel-edit-live-sync

narrativeRole: Frame 1のフックをここで回収する。「ショートカットではない」の具体的な証拠。
keyMessage: キーは固定マクロではなく、Codexの割当に追従するスロットである。

## Frame 10 — 下段：Plan・Back・Forward

- scene: 下段3キーが並び、Joystickの上・左・右の方向記号が重なる
- voiceover: "下段の三個は、Plan、Back、Forward。ジョイスティックの上、左、右にあたります。"
- duration: 9s
- transition_in: push-slide LEFT
- status: built
- src: compositions/frames/10-nav.html
- type: feature_showcase
- persuasion: Anchoring on a familiar referent（方向キーへの接続）
- beat: 平常（clarity）
- blueprint: grid-card-assemble
- asset_candidates: public/keys/micro-13..15-joystick-*.png — ナビ3キーの画像

narrativeRole: 15キーの三段目を閉じ、盤面の説明を完了させる。
keyMessage: 下段3キーはナビゲーション（Plan／Back／Forward）。

## Frame 11 — 本体下の3ボタンは方式で変わる

- scene: 画面が縦に2分割。左「VSD Craft＝シーンシフト」、右「フルOSS＝環境アクション1〜3」。下の3ボタンだけが両側で光る
- voiceover: "本体下の三つの物理ボタンは、導入方式で役割が変わります。VSD Craftではシーン切り替え、フルOSS構成では環境アクション一から三です。"
- duration: 13s
- transition_in: crossfade
- status: built
- src: compositions/frames/11-bottom-row.html
- type: feature_showcase
- persuasion: Comparison of two options（同じ物理ボタンの二つの意味）
- beat: 識別（clarity + focus）
- blueprint: comparison-split

narrativeRole: 唯一「方式で挙動が変わる」箇所を先に切り出し、次の導入方式の話へ橋を架ける。
keyMessage: 下段3ボタンだけは方式によって意味が違う。

## Frame 12 — 2枚目の面：Codex Tools

- scene: 盤面がもう一枚めくれ、Codex Tools 15面が実キー画像で埋まる。Reasoning／New Task／使用量／DIFF／Browser／Settingsに印
- voiceover: "面はもう一枚あります。Codex Tools。Reasoning、New Task、使用量、DIFF、ブラウザ、Settings。Windowsでは、会議パネルも追加できます。"
- duration: 13s
- transition_in: push-slide UP
- status: built
- src: compositions/frames/12-tools.html
- type: feature_showcase
- persuasion: Rule of three ＋ 列挙
- beat: 広がり（fascination）
- blueprint: grid-card-assemble
- asset_candidates: public/sheets/codex-tools-actions.png — Codex Tools 15面の一覧シート

narrativeRole: 「15キーで足りるのか」という当然の疑問に、シーン切り替えという答えを返す。
keyMessage: 面を切り替えれば操作対象は15キーに縛られない。

## Frame 13 — 導入は2通り

- scene: 左右2枚のパネル。左＝VSD Craft（推奨・Windows/macOS・VSD Craft必須）、右＝M18直接接続（フルOSS・Windows）
- voiceover: "導入は二通り。VSD Craft経由なら、WindowsとMacの両方で動きます。追加のプロプライエタリ製品を使わないフルOSS構成は、Windows向けです。"
- duration: 14s
- transition_in: crossfade
- status: built
- src: compositions/frames/13-two-paths.html
- type: benefit_highlight
- persuasion: Comparison of two options
- beat: 判断（clarity + resolve）
- blueprint: comparison-split

narrativeRole: 視聴者が自分の環境でどちらを選ぶかを決められるようにする。
keyMessage: 推奨はVSD Craft方式、フルOSSを望むなら直接接続方式。

## Frame 14 — 導入手順は3行

- scene: ターミナル面に npm ci → npm run validate:vsd-craft → インストーラ実行 の3行が順にタイプされ、最後に「dist-vsd-craft ✓」が点る
- voiceover: "手順は短いです。npm ci、npm run validate、そしてインストーラを実行。プラグインを先にビルドしてから入れます。"
- duration: 13s
- transition_in: zoom-through
- status: built
- src: compositions/frames/14-install.html
- type: social_proof
- persuasion: Demonstration（実際のコマンドを見せる）
- beat: 自信（confidence）
- blueprint: prompt-type-submit-generate

narrativeRole: 「難しそう」を潰す。実物のコマンドが短いことが証拠になる。
keyMessage: 導入は3コマンド相当で、事前ビルドが必要という一点だけ守ればよい。

## Frame 15 — OSSとしての立ち位置

- scene: 3つのライセンス札（MIT／GPL-3.0-only／MPL-2.0）が並び、その下に「非公式プロジェクト」の但し書きが引かれる
- voiceover: "このプロジェクトはオープンソースです。TypeScript側はMIT、M18アダプターはGPL-3.0。公式製品ではありません。"
- duration: 11s
- transition_in: crossfade
- status: built
- src: compositions/frames/15-license.html
- type: branding
- persuasion: Citation / source（事実の明示）
- beat: 誠実さ（clarity）
- blueprint: titlecard-reveal

narrativeRole: 非公式であることとライセンス境界を、視聴者が誤解する前に明示する。
keyMessage: OSSであり、OpenAIやメーカーの公式製品ではない。

## Frame 16 — CTA

- scene: 盤面全体が一度点灯し、中央に「手元のM18を、Codexの操作パネルに」＋GitHubリポジトリ名が残る
- voiceover: "手元のM18を、Codexの操作パネルに。リポジトリはGitHubで公開しています。"
- duration: 9s
- transition_in: crossfade
- status: built
- src: compositions/frames/16-cta.html
- type: cta
- persuasion: Callback（フックの盤面に戻る）
- beat: 決意（resolve）
- blueprint: kinetic-type-beats

narrativeRole: 冒頭の「ショートカットではない」に対する回答として盤面を最後にもう一度見せ、行き先を示す。
keyMessage: 試す場所はGitHubのリポジトリ。
