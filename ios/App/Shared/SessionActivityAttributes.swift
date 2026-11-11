import ActivityKit
import Foundation

/// What the app tells the lock screen about a running session. This file is compiled into both the app
/// (which starts and updates the Live Activity) and the widget extension (which draws it).
///
/// Everything is an absolute time, never "seconds left", so the phone can keep the clock running by itself
/// while the app is asleep.
@available(iOS 16.2, *)
struct SessionActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var text: String
        /// "down": counts down to `at`. "up": counts up from `at`. "none": no clock.
        var clock: String
        var at: Date
        /// Shown instead once a countdown has run out (the activity is then "stale"), for instance
        /// "Time to switch". Empty means keep showing the same thing.
        var afterTitle: String
        var afterText: String
    }

    var name: String
}
