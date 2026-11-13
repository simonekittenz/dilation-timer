import ActivityKit
import SwiftUI
import WidgetKit

private let pink = Color(red: 1.0, green: 0.31, blue: 0.60)
/// The lock screen card is a deep rose with plain white writing: white on this is about 6:1, which stays
/// readable over any wallpaper, where pink on pale pink (the first version) nearly vanished.
private let rose = Color(red: 0.72, green: 0.13, blue: 0.37)

@available(iOS 16.2, *)
struct SessionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SessionActivityAttributes.self) { context in
            LockScreenView(state: context.state, isStale: context.isStale)
                .activityBackgroundTint(rose)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let shown = Shown(state: context.state, isStale: context.isStale)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    SessionMascot(kind: shown.mascot, mood: shown.mood, size: 36)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ClockText(state: context.state, isStale: context.isStale, font: .title3, color: pink)
                        .frame(maxWidth: 90, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(shown.title)
                            .font(.headline)
                            .lineLimit(1)
                        Text(shown.text)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                SessionMascot(kind: shown.mascot, mood: shown.mood, size: 24)
            } compactTrailing: {
                ClockText(state: context.state, isStale: context.isStale, font: .caption, color: pink)
                    .frame(maxWidth: 52, alignment: .trailing)
            } minimal: {
                SessionMascot(kind: shown.mascot, mood: shown.mood, size: 22)
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
    let mascot: String
    let mood: String

    init(state: SessionActivityAttributes.ContentState, isStale: Bool) {
        let over = state.clock == "down" && (isStale || state.at <= Date())
        clockOver = over
        mascot = state.mascot ?? "bunny"
        if over && !state.afterTitle.isEmpty {
            title = state.afterTitle
            text = state.afterText
            mood = state.afterMood ?? state.mood ?? "happy"
        } else {
            title = state.title
            text = state.text
            mood = state.mood ?? "happy"
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
            SessionMascot(kind: shown.mascot, mood: shown.mood, size: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(shown.title)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                Text(shown.text)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.92))
                    .lineLimit(2)
            }
            .layoutPriority(1)
            Spacer(minLength: 8)
            // a count-up clock would stretch across the whole row and squeeze the words: keep it to its own width
            ClockText(state: state, isStale: isStale, font: .title2, color: .white)
                .frame(maxWidth: 104, alignment: .trailing)
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
    let color: Color

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
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .foregroundStyle(color)
            }
        case "up":
            Text(state.at, style: .timer)
                .font(font.weight(.heavy))
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .foregroundStyle(color)
        default:
            EmptyView()
        }
    }
}
