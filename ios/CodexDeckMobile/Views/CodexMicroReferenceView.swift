import SwiftUI

struct CodexMicroReferenceView: View {
  @Environment(DashboardStore.self) private var store
  @State private var tab: CodexMicroTab = .control

  var body: some View {
    @Bindable var store = store
    TabView(selection: $tab) {
      CodexMicroControlScreen()
        .tag(CodexMicroTab.control)
        .tabItem { Label("Control", systemImage: "switch.2") }
      CodexMicroPaletteScreen()
        .tag(CodexMicroTab.palette)
        .tabItem { Label("Palette", systemImage: "square.grid.3x3.fill") }
      CodexMicroUsageScreen()
        .tag(CodexMicroTab.usage)
        .tabItem { Label("Usage", systemImage: "chart.line.uptrend.xyaxis") }
      CodexMicroHostsScreen()
        .tag(CodexMicroTab.hosts)
        .tabItem { Label("Hosts", systemImage: "desktopcomputer") }
    }
    .tint(CodexReferenceTheme.blue)
    .preferredColorScheme(.light)
    .sheet(isPresented: $store.showingSettings) { SettingsView() }
    .sheet(isPresented: $store.showingAttentionCenter) { AttentionCenterView() }
    .sheet(item: $store.presentedAgentReference) { reference in
      AgentDetailView(reference: reference)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
  }
}

private enum CodexMicroTab: Hashable {
  case control, palette, usage, hosts
}

private enum CodexReferenceTheme {
  static let navy = Color(red: 0.015, green: 0.105, blue: 0.17)
  static let canvas = Color(red: 0.965, green: 0.97, blue: 0.975)
  static let border = Color(red: 0.84, green: 0.86, blue: 0.88)
  static let ink = Color(red: 0.045, green: 0.075, blue: 0.12)
  static let secondary = Color(red: 0.32, green: 0.36, blue: 0.41)
  static let green = Color(red: 0.11, green: 0.58, blue: 0.16)
  static let purple = Color(red: 0.45, green: 0.17, blue: 0.88)
  static let blue = Color(red: 0.047, green: 0.35, blue: 0.98)
  static let orange = Color(red: 1, green: 0.53, blue: 0.04)
  static let red = Color(red: 0.89, green: 0.18, blue: 0.18)
  static let gray = Color(red: 0.61, green: 0.64, blue: 0.68)

  static func statusColor(_ status: String, selected: Bool = false) -> Color {
    if selected { return blue }
    if ["working", "thinking"].contains(status) { return purple }
    if ["approval", "awaiting-approval", "awaiting-response"].contains(status) { return orange }
    if status == "error" { return red }
    if ["off", "empty", "unavailable"].contains(status) { return gray }
    return green
  }

  static func statusTitle(_ status: String, selected: Bool = false) -> String {
    if selected { return "選択中" }
    if ["working", "thinking"].contains(status) { return "動作中" }
    if ["approval", "awaiting-approval", "awaiting-response"].contains(status) { return "承認待ち" }
    if status == "error" { return "エラー" }
    if ["off", "empty", "unavailable"].contains(status) { return "停止中" }
    if ["unread", "complete", "completed", "done"].contains(status) { return "完了" }
    return "準備完了"
  }
}

private struct CodexReferenceHeader: View {
  @Environment(DashboardStore.self) private var store
  let title: String

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "chevron.left.forwardslash.chevron.right")
        .font(.title2.weight(.bold))
      Text(title)
        .font(.title3.weight(.bold))
      Spacer()
      HStack(spacing: 5) {
        Circle()
          .fill(store.connectedCount > 0 ? CodexReferenceTheme.green : CodexReferenceTheme.red)
          .frame(width: 8, height: 8)
        Text(store.connectedCount > 0 ? "ready" : "offline")
          .font(.caption.weight(.bold))
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(.white.opacity(0.13), in: Capsule())
    }
    .foregroundStyle(.white)
    .padding(.horizontal, 16)
    .frame(height: 58)
    .background(CodexReferenceTheme.navy)
  }
}

private struct CodexReferenceHostPicker: View {
  @Environment(DashboardStore.self) private var store

  private var hosts: [CodexHost] {
    Dictionary(grouping: store.nodes.values.compactMap(\.host), by: \.hostId)
      .compactMap { $0.value.first }
      .sorted { $0.platform.rawValue > $1.platform.rawValue }
  }

  var body: some View {
    HStack(spacing: 8) {
      ForEach(hosts, id: \.hostId) { host in
        Button {
          store.selectHost(host)
        } label: {
          Label(
            host.platform.displayName,
            systemImage: host.platform == .win32 ? "desktopcomputer" : "laptopcomputer")
            .font(.subheadline.weight(.bold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .foregroundStyle(store.selectedHost?.hostId == host.hostId ? .white : CodexReferenceTheme.ink)
            .background(
              store.selectedHost?.hostId == host.hostId
                ? CodexReferenceTheme.blue : Color.white,
              in: RoundedRectangle(cornerRadius: 7, style: .continuous))
        }
        .buttonStyle(.plain)
      }
      if hosts.isEmpty {
        Text("接続されたホストがありません")
          .font(.subheadline)
          .foregroundStyle(CodexReferenceTheme.secondary)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 10)
      }
    }
  }
}

private struct CodexReferenceSection<Content: View>: View {
  let title: String
  let detail: String?
  let content: Content

  init(_ title: String, detail: String? = nil, @ViewBuilder content: () -> Content) {
    self.title = title
    self.detail = detail
    self.content = content()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .firstTextBaseline) {
        Text(title).font(.headline.weight(.black))
        if let detail { Text(detail).font(.caption).foregroundStyle(CodexReferenceTheme.secondary) }
        Spacer()
      }
      content
    }
  }
}

private struct ReferenceCardModifier: ViewModifier {
  func body(content: Content) -> some View {
    content
      .background(Color.white, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
          .stroke(CodexReferenceTheme.border, lineWidth: 1)
      }
      .shadow(color: .black.opacity(0.045), radius: 3, y: 2)
  }
}

private extension View {
  func referenceCard() -> some View { modifier(ReferenceCardModifier()) }
}

private struct CodexMicroControlScreen: View {
  @Environment(DashboardStore.self) private var store
  private let columns = Array(repeating: GridItem(.flexible(), spacing: 7), count: 3)
  private let actions: [ReferenceMicroAction] = [
    .init(id: "FAST", slot: "ACT06", label: "実行", color: CodexReferenceTheme.blue),
    .init(id: "APPR", slot: "ACT07", label: "承認", color: CodexReferenceTheme.orange),
    .init(id: "REJ", slot: "ACT08", label: "却下", color: CodexReferenceTheme.red),
    .init(id: "SPLIT", slot: "ACT09", label: "分割", color: CodexReferenceTheme.purple),
    .init(id: "MIC", slot: "ACT10_ACT11", label: "マイク", color: CodexReferenceTheme.blue),
    .init(id: "CODEX", slot: "ACT12", label: "Codex", color: CodexReferenceTheme.blue),
  ]

  var body: some View {
    VStack(spacing: 0) {
      CodexReferenceHeader(title: "Codex Micro")
      ScrollView {
        VStack(spacing: 18) {
          CodexReferenceHostPicker()
          HStack {
            Text("最終更新")
            Spacer()
            Text(store.connectedCount > 0 ? "接続中（\(store.connectedCount)台）" : "未接続")
          }
          .font(.caption)
          .foregroundStyle(CodexReferenceTheme.secondary)

          CodexReferenceSection("AGENTS", detail: "動的スロット") {
            LazyVGrid(columns: columns, spacing: 8) {
              ForEach(0..<6, id: \.self) { index in
                ReferenceAgentCard(index: index, agent: store.agents.first { $0.id == index })
              }
            }
          }

          CodexReferenceSection("MICRO ACTIONS", detail: "動的アクション") {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 5), count: 6), spacing: 5) {
              ForEach(actions) { action in
                Button {
                  Task { await store.pressAction(action.slot) }
                } label: {
                  VStack(spacing: 4) {
                    Text(action.id)
                      .font(.system(size: 10, weight: .black))
                      .lineLimit(1)
                      .minimumScaleFactor(0.65)
                    Text(action.label).font(.system(size: 8, weight: .semibold))
                  }
                  .foregroundStyle(.white)
                  .frame(maxWidth: .infinity, minHeight: 52)
                  .background(action.color, in: RoundedRectangle(cornerRadius: 7))
                }
                .buttonStyle(.plain)
              }
            }
          }

          CodexReferenceSection("JOYSTICK / REASONING", detail: "動的コントロール") {
            HStack(spacing: 8) {
              ReferenceJoystick()
              ReferenceReasoning()
            }
          }
        }
        .padding(14)
      }
      .background(CodexReferenceTheme.canvas)
    }
  }
}

private struct ReferenceMicroAction: Identifiable {
  let id: String
  let slot: String
  let label: String
  let color: Color
}

private struct ReferenceAgentCard: View {
  @Environment(DashboardStore.self) private var store
  let index: Int
  let agent: RoutedAgent?

  var body: some View {
    Button {
      if let agent { Task { await store.activate(agent) } }
    } label: {
      VStack(alignment: .leading, spacing: 8) {
        HStack(spacing: 6) {
          Text("\(index + 1)").font(.title3.weight(.black))
          Text(agent?.title ?? "未割当")
            .font(.system(size: 14, weight: .bold))
            .lineLimit(1)
          Spacer(minLength: 2)
          if agent?.selected == true {
            Image(systemName: "checkmark.circle.fill")
              .foregroundStyle(CodexReferenceTheme.blue)
          }
        }
        HStack {
          ReferenceStatusPill(status: agent?.status ?? "off", selected: agent?.selected == true)
          Spacer()
          Text(agent?.contextUsedPercent.map { "\(Int($0.rounded()))%" } ?? "0%")
            .font(.caption.weight(.bold)).monospacedDigit()
        }
        ProgressView(value: min(max((agent?.contextUsedPercent ?? 0) / 100, 0), 1))
          .tint(CodexReferenceTheme.statusColor(agent?.status ?? "off", selected: agent?.selected == true))
        Text(agent?.originPlatform.displayName ?? "—")
          .font(.caption2)
          .foregroundStyle(CodexReferenceTheme.secondary)
      }
      .foregroundStyle(CodexReferenceTheme.ink)
      .padding(10)
      .frame(maxWidth: .infinity, minHeight: 116, alignment: .topLeading)
      .referenceCard()
    }
    .buttonStyle(.plain)
    .disabled(agent == nil)
  }
}

private struct ReferenceStatusPill: View {
  let status: String
  let selected: Bool

  var body: some View {
    let color = CodexReferenceTheme.statusColor(status, selected: selected)
    Label(CodexReferenceTheme.statusTitle(status, selected: selected), systemImage: statusSymbol)
      .font(.caption2.weight(.bold))
      .foregroundStyle(color)
      .padding(.horizontal, 7)
      .padding(.vertical, 4)
      .background(color.opacity(0.11), in: RoundedRectangle(cornerRadius: 4))
      .overlay { RoundedRectangle(cornerRadius: 4).stroke(color.opacity(0.35)) }
  }

  private var statusSymbol: String {
    if selected { return "checkmark.circle.fill" }
    if ["working", "thinking"].contains(status) { return "bolt.fill" }
    if ["approval", "awaiting-approval", "awaiting-response"].contains(status) { return "hand.raised.fill" }
    if status == "error" { return "exclamationmark.triangle.fill" }
    if ["off", "empty", "unavailable"].contains(status) { return "minus.circle.fill" }
    return "checkmark.circle.fill"
  }
}

private struct ReferenceJoystick: View {
  @Environment(DashboardStore.self) private var store

  var body: some View {
    VStack(spacing: 6) {
      Text("Joystick").font(.subheadline.weight(.bold))
      Button { Task { await store.pressJoystick("up") } } label: { Image(systemName: "arrow.up") }
      HStack(spacing: 22) {
        Button { Task { await store.pressJoystick("left") } } label: { Image(systemName: "arrow.left") }
        Button { Task { await store.pressJoystick("right") } } label: { Image(systemName: "arrow.right") }
      }
      Button { Task { await store.pressJoystick("down") } } label: { Image(systemName: "arrow.down") }
      Text("ACTIVE").font(.caption2.weight(.black)).foregroundStyle(CodexReferenceTheme.blue)
    }
    .buttonStyle(.bordered)
    .frame(maxWidth: .infinity, minHeight: 160)
    .referenceCard()
  }
}

private struct ReferenceReasoning: View {
  @Environment(DashboardStore.self) private var store

  var body: some View {
    VStack(spacing: 12) {
      Text("Reasoning").font(.subheadline.weight(.bold))
      Image(systemName: "brain.head.profile.fill")
        .font(.system(size: 40))
        .foregroundStyle(CodexReferenceTheme.purple)
      HStack {
        Button { Task { await store.trigger(.reasoning(direction: "decrease")) } } label: { Image(systemName: "minus") }
        Button { Task { await store.pressEncoder() } } label: { Text("DEEP").font(.caption.weight(.black)) }
        Button { Task { await store.trigger(.reasoning(direction: "increase")) } } label: { Image(systemName: "plus") }
      }
      .buttonStyle(.bordered)
      Text("自動推論を実行").font(.caption2).foregroundStyle(CodexReferenceTheme.secondary)
    }
    .frame(maxWidth: .infinity, minHeight: 160)
    .referenceCard()
  }
}

private enum ReferencePaletteCategory: String, CaseIterable, Identifiable {
  case all = "すべて"
  case action = "アクション"
  case navigation = "ナビゲーション"
  case development = "開発"
  case other = "その他"
  var id: String { rawValue }
}

private struct CodexMicroPaletteScreen: View {
  @Environment(DashboardStore.self) private var store
  @State private var category: ReferencePaletteCategory = .all
  @State private var selectedID = "FAST"
  @State private var archiveConfirmation = false
  private let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 5)

  private var keys: [KeycapDefinition] {
    KeycapCatalog.all.filter { category == .all || paletteCategory($0.id) == category }
  }

  var body: some View {
    VStack(spacing: 0) {
      CodexReferenceHeader(title: "公式 Keycap 30")
      ScrollView {
        VStack(spacing: 14) {
          Picker("カテゴリ", selection: $category) {
            ForEach(ReferencePaletteCategory.allCases) { Text($0.rawValue).tag($0) }
          }
          .pickerStyle(.segmented)

          HStack {
            Text("公式 KEYCAP PALETTE").font(.headline.weight(.black))
            Spacer()
            Text("30キー").font(.caption.weight(.bold))
          }

          LazyVGrid(columns: columns, spacing: 7) {
            ForEach(keys) { key in
              Button { selectedID = key.id } label: {
                VStack(spacing: 3) {
                  Text(key.id).font(.caption.weight(.black)).lineLimit(1).minimumScaleFactor(0.7)
                  Text(shortName(key.name)).font(.system(size: 9, weight: .bold)).lineLimit(1)
                }
                .foregroundStyle(paletteTextColor(key.id))
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(paletteColor(key.id), in: RoundedRectangle(cornerRadius: 6))
                .overlay {
                  RoundedRectangle(cornerRadius: 6)
                    .stroke(selectedID == key.id ? CodexReferenceTheme.blue : Color.clear, lineWidth: 3)
                }
              }
              .buttonStyle(.plain)
            }
          }

          if let selected = KeycapCatalog.definition(for: selectedID) {
            VStack(alignment: .leading, spacing: 10) {
              HStack {
                VStack(alignment: .leading, spacing: 2) {
                  Text(selected.id).font(.title2.weight(.black)).foregroundStyle(paletteColor(selected.id))
                  Text(selected.name).font(.headline)
                }
                Spacer()
                Image(systemName: selected.symbol).font(.title2).foregroundStyle(CodexReferenceTheme.green)
              }
              Divider()
              LabeledContent("カテゴリ", value: paletteCategory(selected.id).rawValue)
              LabeledContent("用途", value: selected.name)
              LabeledContent("互換性", value: "Windows / Mac")
              Button {
                if selected.id == "DEL" { archiveConfirmation = true }
                else { Task { await store.trigger(.keycap(id: selected.id)) } }
              } label: {
                Label("選択したキーを実行", systemImage: "play.fill")
                  .frame(maxWidth: .infinity)
              }
              .buttonStyle(.borderedProminent)
            }
            .padding(14)
            .referenceCard()
          }
        }
        .padding(14)
      }
      .background(CodexReferenceTheme.canvas)
    }
    .confirmationDialog("選択中のチャットをアーカイブしますか？", isPresented: $archiveConfirmation) {
      Button("アーカイブ", role: .destructive) { Task { await store.trigger(.keycap(id: "DEL")) } }
    }
  }

  private func shortName(_ name: String) -> String { name.split(separator: " ").first.map(String.init) ?? name }
}

private func paletteCategory(_ id: String) -> ReferencePaletteCategory {
  if ["FAST", "APPR", "REJ", "SPLIT", "MIC", "CODEX", "DEL", "NEW"].contains(id) { return .action }
  if ["NAV", "DWN", "FOLD", "UPL", "APPS"].contains(id) { return .navigation }
  if ["BUG", "OAI", "TERM", "DIFF", "PLAY", "GIT", "BRCH", "MRG", "PR", "LAB"].contains(id) { return .development }
  return .other
}

private func paletteColor(_ id: String) -> Color {
  if ["FAST", "MIC", "CODEX", "NAV", "LAB", "TIME", "PR", "APPS"].contains(id) { return CodexReferenceTheme.blue }
  if ["APPR", "GIT"].contains(id) { return CodexReferenceTheme.orange }
  if ["REJ", "BUG", "DEL"].contains(id) { return CodexReferenceTheme.red }
  if ["SPLIT", "MRG", "MAGIC", "MIND+", "MIND-"].contains(id) { return CodexReferenceTheme.purple }
  if ["OAI", "DIFF", "BRCH", "FOLD"].contains(id) { return Color(red: 0.05, green: 0.55, blue: 0.55) }
  if ["NEW", "PLAY"].contains(id) { return CodexReferenceTheme.green }
  return Color(red: 0.9, green: 0.91, blue: 0.92)
}

private func paletteTextColor(_ id: String) -> Color {
  ["TERM", "DWN", "PAINT", "PARTY", "SETUP", "UPL"].contains(id) ? CodexReferenceTheme.ink : .white
}

private enum ReferenceUsageMode: String, CaseIterable, Identifiable {
  case automatic = "自動"
  case fiveHour = "5時間"
  case weekly = "週間"
  case other = "その他"
  var id: String { rawValue }
}

private struct CodexMicroUsageScreen: View {
  @Environment(DashboardStore.self) private var store
  @State private var mode: ReferenceUsageMode = .automatic
  @State private var resetHolding = false

  private var usage: UsageSnapshot? { store.usageSource?.snapshot.usage }
  private var visibleWindows: [UsageWindow] {
    guard let usage else { return [] }
    switch mode {
    case .automatic: usage.windows
    case .fiveHour: usage.windows.filter { $0.kind == "five-hour" }
    case .weekly: usage.windows.filter { $0.kind == "weekly" }
    case .other: usage.windows.filter { !["five-hour", "weekly"].contains($0.kind) }
    }
  }

  var body: some View {
    VStack(spacing: 0) {
      CodexReferenceHeader(title: "利用状況 ＆ 制限")
      ScrollView {
        VStack(alignment: .leading, spacing: 14) {
          Text("使用量モード").font(.headline.weight(.black))
          Picker("使用量モード", selection: $mode) {
            ForEach(ReferenceUsageMode.allCases) { Text($0.rawValue).tag($0) }
          }
          .pickerStyle(.segmented)

          if visibleWindows.isEmpty {
            ContentUnavailableView("利用状況がありません", systemImage: "chart.bar.xaxis")
              .frame(maxWidth: .infinity, minHeight: 220)
          } else {
            ForEach(visibleWindows) { window in
              ReferenceUsageCard(window: window, host: store.usageSource?.host)
            }
          }

          VStack(alignment: .leading, spacing: 9) {
            Text("Rate Limit Reset（上限リセット）")
              .font(.headline.weight(.black))
              .foregroundStyle(CodexReferenceTheme.red)
            Label(
              resetHolding ? "そのまま保持してください" : "1.2秒長押しで実行",
              systemImage: resetHolding ? "hand.tap.fill" : "exclamationmark.triangle.fill")
              .font(.headline.weight(.black))
              .foregroundStyle(.white)
              .frame(maxWidth: .infinity, minHeight: 58)
              .background(CodexReferenceTheme.red, in: RoundedRectangle(cornerRadius: 7))
              .scaleEffect(resetHolding ? 0.985 : 1)
              .contentShape(RoundedRectangle(cornerRadius: 7))
              .onLongPressGesture(
                minimumDuration: 1.2, maximumDistance: 20,
                pressing: { resetHolding = $0 }
              ) {
                Task { await store.resetRateLimit() }
              }
            Text("長押しが完了するまでResetコマンドは送信されません")
              .font(.caption)
              .foregroundStyle(CodexReferenceTheme.red)
              .frame(maxWidth: .infinity, alignment: .center)
          }
        }
        .padding(14)
      }
      .background(CodexReferenceTheme.canvas)
    }
  }
}

private struct ReferenceUsageCard: View {
  let window: UsageWindow
  let host: CodexHost?

  var body: some View {
    let tint = window.remainingPercent <= 20 ? CodexReferenceTheme.red
      : window.kind == "weekly" ? CodexReferenceTheme.orange : CodexReferenceTheme.green
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Circle().fill(tint).frame(width: 10, height: 10)
        Text(usageTitle).font(.headline.weight(.black))
        Spacer()
        Text("\(Int(window.remainingPercent.rounded()))%")
          .font(.title3.weight(.black)).monospacedDigit()
      }
      ProgressView(value: min(max(window.remainingPercent / 100, 0), 1)).tint(tint)
      LabeledContent("使用量", value: "\(Int(window.usedPercent.rounded()))%")
      LabeledContent("期間", value: durationTitle)
      LabeledContent("リセット", value: resetTitle)
      LabeledContent("ホスト", value: host?.platform.displayName ?? "—")
    }
    .font(.caption)
    .padding(14)
    .referenceCard()
  }

  private var usageTitle: String {
    switch window.kind {
    case "five-hour": "5時間ウィンドウ"
    case "weekly": "週次ウィンドウ"
    default: "その他（カスタム）"
    }
  }
  private var durationTitle: String {
    window.windowDurationMins.map { "\(Int($0))分" } ?? "—"
  }
  private var resetTitle: String {
    window.resetsAt.map { Date(timeIntervalSince1970: $0 / 1000).formatted(date: .numeric, time: .shortened) } ?? "—"
  }
}

private struct CodexMicroHostsScreen: View {
  @Environment(DashboardStore.self) private var store
  @State private var showingSettings = false
  @State private var testingProfileID: UUID?
  @State private var testMessage: String?

  var body: some View {
    VStack(spacing: 0) {
      CodexReferenceHeader(title: "ホスト ＆ 設定")
      ScrollView {
        VStack(alignment: .leading, spacing: 16) {
          Text("ターゲット切替").font(.headline.weight(.black))
          CodexReferenceHostPicker()

          CodexReferenceSection("ホスト／プロフィール一覧") {
            VStack(spacing: 7) {
              ForEach(store.profiles) { profile in
                ReferenceHostRow(profile: profile)
              }
            }
          }

          if let host = store.selectedHost {
            ReferenceSelectedHostCard(host: host)
          }

          CodexReferenceSection("設定とアクション") {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
              ReferenceHostAction(title: "テーマ切替", symbol: "circle.lefthalf.filled") { showingSettings = true }
              ReferenceHostAction(title: "通知設定", symbol: "bell") { showingSettings = true }
              ReferenceHostAction(title: "再読み込み", symbol: "arrow.clockwise") { reconnectSelected() }
              ReferenceHostAction(title: "接続テスト", symbol: "wave.3.right.circle") { testSelected() }
            }
          }

          if let testMessage {
            Label(testMessage, systemImage: "info.circle.fill")
              .font(.caption.weight(.semibold))
              .foregroundStyle(CodexReferenceTheme.secondary)
          }

          Button("接続・セキュリティ・表示の詳細設定") { showingSettings = true }
            .buttonStyle(.borderedProminent)
            .frame(maxWidth: .infinity)
        }
        .padding(14)
      }
      .background(CodexReferenceTheme.canvas)
    }
    .sheet(isPresented: $showingSettings) { SettingsView() }
  }

  private func selectedProfile() -> NodeProfile? {
    guard let hostID = store.selectedHost?.hostId else { return nil }
    return store.profiles.first { store.nodes[$0.id]?.host?.hostId == hostID }
  }

  private func reconnectSelected() {
    guard let profile = selectedProfile() else { return }
    store.reconnect(profile)
    testMessage = "再接続を要求しました"
  }

  private func testSelected() {
    guard let profile = selectedProfile() else { return }
    testingProfileID = profile.id
    Task {
      do {
        let result = try await store.testConnection(profile)
        testMessage = "接続成功：\(result.elapsedMilliseconds) ms"
      } catch {
        testMessage = error.localizedDescription
      }
      testingProfileID = nil
    }
  }
}

private struct ReferenceHostRow: View {
  @Environment(DashboardStore.self) private var store
  let profile: NodeProfile

  var body: some View {
    let status = store.nodes[profile.id] ?? NodeStatus()
    Button {
      if let host = status.host { store.selectHost(host) }
    } label: {
      HStack(spacing: 10) {
        Image(systemName: status.host?.platform == .darwin ? "laptopcomputer" : "desktopcomputer")
          .frame(width: 22)
        VStack(alignment: .leading, spacing: 2) {
          Text(status.host?.hostName ?? profile.name).font(.subheadline.weight(.bold))
          Text(status.detail ?? profile.connectionMode.rawValue)
            .font(.caption2).foregroundStyle(CodexReferenceTheme.secondary).lineLimit(1)
        }
        Spacer()
        Circle().fill(hostStateColor(status.state)).frame(width: 8, height: 8)
        Text(hostStateTitle(status.state)).font(.caption2.weight(.bold))
        if store.selectedHost?.hostId == status.host?.hostId {
          Text("現在のホスト")
            .font(.system(size: 8, weight: .black))
            .foregroundStyle(CodexReferenceTheme.blue)
        }
      }
      .foregroundStyle(CodexReferenceTheme.ink)
      .padding(11)
      .referenceCard()
    }
    .buttonStyle(.plain)
  }
}

private struct ReferenceSelectedHostCard: View {
  @Environment(DashboardStore.self) private var store
  let host: CodexHost

  private var status: NodeStatus? {
    store.nodes.values.first { $0.host?.hostId == host.hostId }
  }

  var body: some View {
    CodexReferenceSection("選択中ホストのセッション情報") {
      VStack(alignment: .leading, spacing: 8) {
        LabeledContent("ホスト名", value: host.hostName)
        LabeledContent("接続状態", value: hostStateTitle(status?.state ?? .offline))
        LabeledContent("最終更新", value: status?.lastSnapshotReceivedAt?.formatted(date: .omitted, time: .standard) ?? "未受信")
        LabeledContent("Codexバージョン", value: host.codexVersion ?? "不明")
        LabeledContent("実行環境", value: host.platform.displayName)
        LabeledContent("Relay", value: status?.bridgeKind ?? "未通知")
      }
      .font(.caption)
      .padding(14)
      .referenceCard()
    }
  }
}

private struct ReferenceHostAction: View {
  let title: String
  let symbol: String
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      VStack(spacing: 6) {
        Image(systemName: symbol).font(.title3)
        Text(title).font(.caption.weight(.bold))
      }
      .foregroundStyle(CodexReferenceTheme.ink)
      .frame(maxWidth: .infinity, minHeight: 70)
      .referenceCard()
    }
    .buttonStyle(.plain)
  }
}

private func hostStateColor(_ state: NodeConnectionState) -> Color {
  switch state {
  case .ready: CodexReferenceTheme.green
  case .connecting, .degraded: CodexReferenceTheme.orange
  case .offline: CodexReferenceTheme.red
  }
}

private func hostStateTitle(_ state: NodeConnectionState) -> String {
  switch state {
  case .ready: "ready"
  case .connecting: "接続中"
  case .degraded: "要確認"
  case .offline: "offline"
  }
}
