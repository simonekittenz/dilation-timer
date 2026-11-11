import ActivityKit
import SwiftUI
import WidgetKit

private let pink = Color(red: 1.0, green: 0.31, blue: 0.60)
private let softPink = Color(red: 1.0, green: 0.94, blue: 0.96)
private let ink = Color(red: 0.36, green: 0.16, blue: 0.28)

@available(iOS 16.2, *)
struct SessionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SessionActivityAttributes.self) { context in
            LockScreenView(state: context.state, isStale: context.isStale)
                .activityBackgroundTint(softPink)
                .activitySystemActionForegroundColor(pink)
        } dynamicIsland: { context in
            let shown = Shown(state: context.state, isStale: context.isStale)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(shown.title)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ClockText(state: context.state, isStale: context.isStale, font: .title3)
                        .frame(maxWidth: 90, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(shown.text)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: "timer")
                    .foregroundStyle(pink)
            } compactTrailing: {
                ClockText(state: context.state, isStale: context.isStale, font: .caption)
                    .frame(maxWidth: 52, alignment: .trailing)
            } minimal: {
                Image(systemName: "timer")
                    .foregroundStyle(pink)
            }
            .keylineTint(pink)
        }
    }
}

/// What to say right now: the planned words, or, once a countdown has run out, what comes after it.
@available(iOS 16.2, *)
private struct Shown {
    let title: String
    let text: String
    let clockOver: Bool

    init(state: SessionActivityAttributes.ContentState, isStale: Bool) {
        let over = state.clock == "down" && (isStale || state.at <= Date())
        clockOver = over
        if over && !state.afterTitle.isEmpty {
            title = state.afterTitle
            text = state.afterText
        } else {
            title = state.title
            text = state.text
        }
    }
}

@available(iOS 16.2, *)
private struct LockScreenView: View {
    let state: SessionActivityAttributes.ContentState
    let isStale: Bool

    var body: some View {
        let shown = Shown(state: state, isStale: isStale)
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: "timer")
                .font(.title2)
                .foregroundStyle(pink)
            VStack(alignment: .leading, spacing: 2) {
                Text(shown.title)
                    .font(.headline)
                    .foregroundStyle(ink)
                    .lineLimit(1)
                Text(shown.text)
                    .font(.subheadline)
                    .foregroundStyle(ink.opacity(0.7))
                    .lineLimit(2)
            }
            Spacer(minLength: 8)
            ClockText(state: state, isStale: isStale, font: .title)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}

/// The clock. The phone ticks it by itself: nothing here needs the app to be running.
@available(iOS 16.2, *)
private struct ClockText: View {
    let state: SessionActivityAttributes.ContentState
    let isStale: Bool
    let font: Font

    var body: some View {
        switch state.clock {
        case "down":
            if isStale || state.at <= Date() {
                EmptyView()
            } else {
                Text(timerInterval: Date()...state.at, countsDown: true, showsHours: false)
                    .font(font.weight(.heavy))
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(pink)
            }
        case "up":
            Text(state.at, style: .timer)
                .font(font.weight(.heavy))
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .foregroundStyle(pink)
        default:
            EmptyView()
        }
    }
}
