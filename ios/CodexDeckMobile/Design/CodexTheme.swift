import SwiftUI
import UIKit

enum CodexTheme {
  static let canvas = adaptive(
    light: UIColor(red: 0.945, green: 0.95, blue: 0.955, alpha: 1),
    dark: UIColor(red: 0.035, green: 0.045, blue: 0.062, alpha: 1))
  static let panel = adaptive(
    light: UIColor(red: 0.88, green: 0.895, blue: 0.91, alpha: 1),
    dark: UIColor(red: 0.13, green: 0.15, blue: 0.18, alpha: 1))
  static let key = adaptive(
    light: UIColor(white: 0.98, alpha: 0.96),
    dark: UIColor(red: 0.18, green: 0.20, blue: 0.23, alpha: 0.96))
  static let ink = adaptive(
    light: UIColor(red: 0.08, green: 0.09, blue: 0.10, alpha: 1),
    dark: UIColor(red: 0.94, green: 0.95, blue: 0.97, alpha: 1))
  static let secondary = adaptive(
    light: UIColor(red: 0.40, green: 0.43, blue: 0.47, alpha: 1),
    dark: UIColor(red: 0.62, green: 0.66, blue: 0.72, alpha: 1))
  static let control = Color(red: 0.075, green: 0.085, blue: 0.10)
  static let green = Color(red: 0.18, green: 0.83, blue: 0.44)
  static let blue = Color(red: 0.13, green: 0.53, blue: 0.98)
  static let purple = Color(red: 0.45, green: 0.17, blue: 0.88)
  static let selection = blue
  static let orange = Color(red: 1.0, green: 0.61, blue: 0.13)
  static let red = Color(red: 1.0, green: 0.27, blue: 0.36)
  static let unavailable = Color(red: 0.61, green: 0.64, blue: 0.68)

  private static func adaptive(light: UIColor, dark: UIColor) -> Color {
    Color(uiColor: UIColor { traits in traits.userInterfaceStyle == .dark ? dark : light })
  }

  static func statusColor(_ status: String) -> Color {
    if ["working", "thinking"].contains(status) { return purple }
    if ["approval", "awaiting-approval", "awaiting-response"].contains(status) { return orange }
    if ["unread", "complete", "completed", "done"].contains(status) { return green }
    if status == "error" { return red }
    if ["off", "empty", "unavailable"].contains(status) { return unavailable }
    return green
  }
}

struct CodexBackdrop: View {
  @Environment(\.colorScheme) private var colorScheme
  let accent: Color

  var body: some View {
    ZStack {
      LinearGradient(
        colors: colorScheme == .dark
          ? [Color(red: 0.025, green: 0.033, blue: 0.048), CodexTheme.canvas, Color(red: 0.055, green: 0.075, blue: 0.10)]
          : [Color.white, CodexTheme.canvas, Color(red: 0.91, green: 0.94, blue: 0.97)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing)
      Circle()
        .fill(accent.opacity(colorScheme == .dark ? 0.18 : 0.1))
        .frame(width: 330, height: 330)
        .blur(radius: 72)
        .offset(x: 170, y: -300)
      Circle()
        .fill(CodexTheme.green.opacity(colorScheme == .dark ? 0.1 : 0.055))
        .frame(width: 260, height: 260)
        .blur(radius: 68)
        .offset(x: -180, y: 360)
    }
  }
}

extension View {
  @ViewBuilder
  func codexGlassSurface(
    cornerRadius: CGFloat,
    tint: Color? = nil,
    interactive: Bool = false
  ) -> some View {
    if #available(iOS 26.0, *) {
      if let tint {
        if interactive {
          glassEffect(
            .regular.tint(tint).interactive(), in: .rect(cornerRadius: cornerRadius))
        } else {
          glassEffect(.regular.tint(tint), in: .rect(cornerRadius: cornerRadius))
        }
      } else if interactive {
        glassEffect(.regular.interactive(), in: .rect(cornerRadius: cornerRadius))
      } else {
        glassEffect(.regular, in: .rect(cornerRadius: cornerRadius))
      }
    } else {
      background(
        .ultraThinMaterial,
        in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
      )
      .overlay {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
          .stroke(.white.opacity(0.72), lineWidth: 1)
      }
    }
  }
}

struct CodexGlassGroup<Content: View>: View {
  let spacing: CGFloat
  private let content: Content

  init(spacing: CGFloat, @ViewBuilder content: () -> Content) {
    self.spacing = spacing
    self.content = content()
  }

  @ViewBuilder
  var body: some View {
    if #available(iOS 26.0, *) {
      GlassEffectContainer(spacing: spacing) { content }
    } else {
      content
    }
  }
}

struct HardwareKeyStyle: ButtonStyle {
  @Environment(\.colorScheme) private var colorScheme
  var tint: Color = CodexTheme.ink

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundStyle(tint)
      .frame(maxWidth: .infinity, minHeight: 62)
      .background(
        RoundedRectangle(cornerRadius: 20, style: .continuous)
          .fill(CodexTheme.key.opacity(configuration.isPressed ? 0.72 : 1))
          .shadow(color: .white.opacity(colorScheme == .dark ? 0.12 : 0.9), radius: 0, x: 0, y: -2)
          .shadow(
            color: .black.opacity(configuration.isPressed ? 0.08 : 0.16),
            radius: configuration.isPressed ? 2 : 8, y: configuration.isPressed ? 1 : 5)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 20, style: .continuous)
          .stroke(.white.opacity(colorScheme == .dark ? 0.18 : 0.72), lineWidth: 1)
      )
      .scaleEffect(configuration.isPressed ? 0.97 : 1)
      .animation(.snappy(duration: 0.15), value: configuration.isPressed)
  }
}

struct SectionLabel: View {
  let title: String
  let detail: String?

  init(_ title: String, detail: String? = nil) {
    self.title = title
    self.detail = detail
  }

  var body: some View {
    HStack(alignment: .firstTextBaseline) {
      Text(title.uppercased())
        .font(.caption.weight(.bold))
        .tracking(1.5)
        .foregroundStyle(CodexTheme.secondary)
      Spacer()
      if let detail { Text(detail).font(.caption).foregroundStyle(.secondary) }
    }
  }
}
