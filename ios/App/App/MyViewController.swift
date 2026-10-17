import UIKit
import Capacitor

/// Capacitor's view controller, with our own native plugin registered on it.
class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AudioDuckingPlugin())
    }
}
