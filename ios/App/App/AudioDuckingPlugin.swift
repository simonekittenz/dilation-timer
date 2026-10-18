import Capacitor
import AVFoundation

/// Plays the alarm sounds from files bundled with the web app and, while they play, makes other
/// apps' audio (Spotify, podcasts...) quieter instead of pausing it. When the alarm ends the other
/// audio comes back to full volume by itself.
///
/// The sound is played natively, not by the web view, because the web view manages its own audio
/// session and could undo the ducking.
@objc(AudioDuckingPlugin)
public class AudioDuckingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioDuckingPlugin"
    public let jsName = "AudioDucking"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var player: AVAudioPlayer?
    private var loopTimer: Timer?
    private let finishObserver = FinishObserver()

    private struct Request {
        let url: URL
        let volume: Float
    }

    /// Plays a bundled sound once. Resolves as soon as it has started.
    @objc func play(_ call: CAPPluginCall) {
        guard let request = request(from: call) else { return }
        DispatchQueue.main.async {
            self.cancelLoop()
            do {
                try self.start(request)
                call.resolve()
            } catch {
                call.reject("Couldn't play the alarm sound", nil, error)
            }
        }
    }

    /// Plays a sound now and again every `intervalMs` until stop().
    @objc func loop(_ call: CAPPluginCall) {
        guard let request = request(from: call) else { return }
        let interval = max(0.5, Double(call.getInt("intervalMs") ?? 2500) / 1000.0)
        DispatchQueue.main.async {
            self.cancelLoop()
            do {
                try self.start(request)
                self.loopTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
                    _ = try? self?.start(request)
                }
                call.resolve()
            } catch {
                call.reject("Couldn't play the alarm sound", nil, error)
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.cancelLoop()
            self.player?.stop()
            self.player = nil
            self.endDucking()
            call.resolve()
        }
    }

    // MARK: - Helpers

    /// Checks the sound name (only simple names, so a bad value can't point at other files),
    /// finds the file, and rejects the call itself if something is wrong.
    private func request(from call: CAPPluginCall) -> Request? {
        guard let name = call.getString("sound"),
              name.range(of: "^[a-z0-9-]+$", options: .regularExpression) != nil,
              let url = Bundle.main.url(forResource: name, withExtension: "wav", subdirectory: "public/sounds")
        else {
            call.reject("Unknown alarm sound")
            return nil
        }
        let volume = Float(min(1.0, max(0.0, call.getDouble("volume") ?? 1.0)))
        return Request(url: url, volume: volume)
    }

    private func start(_ request: Request) throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [.duckOthers])
        try session.setActive(true)

        let next = try AVAudioPlayer(contentsOf: request.url)
        next.volume = request.volume
        next.delegate = finishObserver
        finishObserver.onFinish = { [weak self] in
            // hand the audio back as soon as a sound ends; the next repeat asks for it again
            self?.endDucking()
        }
        next.prepareToPlay()
        player?.stop()
        player = next
        next.play()
    }

    private func cancelLoop() {
        loopTimer?.invalidate()
        loopTimer = nil
    }

    /// Lets the other app's audio return to normal volume.
    private func endDucking() {
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }
}

private final class FinishObserver: NSObject, AVAudioPlayerDelegate {
    var onFinish: (() -> Void)?

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        onFinish?()
    }
}
