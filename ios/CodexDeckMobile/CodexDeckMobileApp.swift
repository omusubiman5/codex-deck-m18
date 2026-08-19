import SwiftUI

@main
struct CodexDeckMobileApp: App {
  @Environment(\.scenePhase) private var scenePhase
  @State private var store = DashboardStore()
  @State private var discovery = LocalNodeDiscovery()

  init() {
    WidgetBackgroundRefresh.register()
    AttentionNotificationService.shared.activate()
  }

  var body: some Scene {
    WindowGroup {
      CodexMicroReferenceView()
        .environment(store)
        .environment(discovery)
        .task {
          discovery.start()
          await store.start()
          await store.handlePendingWidgetCommand()
        }
        .onOpenURL { store.handleURL($0) }
        .onReceive(NotificationCenter.default.publisher(for: .codexAttentionOpened)) { note in
          guard let reference = note.userInfo?["reference"] as? AgentReference else { return }
          store.showingSettings = false
          store.showingAttentionCenter = false
          Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(220))
            store.presentAgent(reference)
          }
        }
        .onChange(of: discovery.nodes) { _, nodes in store.updateNearbyEndpoints(nodes) }
        .onChange(of: scenePhase) { _, phase in
          switch phase {
          case .active:
            Task { await store.handlePendingWidgetCommand() }
          case .background:
            WidgetBackgroundRefresh.schedule()
          default:
            break
          }
        }
    }
  }
}
