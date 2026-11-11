import ActivityKit
import Capacitor

/// The running session on the lock screen and in the Dynamic Island, as a Live Activity (iOS 16.2+; on older
/// iPhones it quietly does nothing). The widget extension draws it; this plugin starts, updates and ends it.
///
/// The JavaScript side is the same one the Android app uses (`src/lib/sessionNotice.ts`), so it has the
/// same two methods. iOS only lets an app start a Live Activity while it is in the front, so the app keeps
/// it up to date as the session goes along, and the phone ticks the clock by itself once the app is away.
@objc(SessionNoticePlugin)
public class SessionNoticePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SessionNoticePlugin"
    public let jsName = "SessionNotice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise)
    ]

    /// Starts the Live Activity, or updates the one that is up.
    @objc func show(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        guard let title = call.getString("title"), !title.isEmpty else {
            call.reject("A title is needed")
            return
        }
        // the person can turn Live Activities off for the app in iOS Settings: nothing wrong with that
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve()
            return
        }
        let state = SessionActivityAttributes.ContentState(
            title: title,
            text: call.getString("text") ?? "",
            clock: call.getString("clock") ?? "none",
            at: Date(timeIntervalSince1970: (call.getDouble("at") ?? 0) / 1000.0),
            afterTitle: call.getString("afterTitle") ?? "",
            afterText: call.getString("afterText") ?? ""
        )
        // when a countdown runs out the activity turns "stale" by itself, which swaps in the words for after it
        let expires = call.getDouble("expiresInMs") ?? 0
        let staleDate: Date? = expires > 0 ? Date().addingTimeInterval(expires / 1000.0) : nil
        let content = ActivityContent(state: state, staleDate: staleDate)

        Task {
            if let existing = Activity<SessionActivityAttributes>.activities.first {
                await existing.update(content)
                call.resolve()
                return
            }
            do {
                _ = try Activity.request(
                    attributes: SessionActivityAttributes(name: "Dilation timer"),
                    content: content,
                    pushType: nil
                )
                call.resolve()
            } catch {
                call.reject("Couldn't start the Live Activity", nil, error)
            }
        }
    }

    /// Takes the Live Activity down.
    @objc func hide(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        Task {
            for activity in Activity<SessionActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }
}
