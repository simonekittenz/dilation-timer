import SwiftUI
import WidgetKit

/// The widget extension only has the session's Live Activity: on the lock screen and in the Dynamic Island.
@main
struct SessionWidgetBundle: WidgetBundle {
    var body: some Widget {
        SessionLiveActivity()
    }
}
