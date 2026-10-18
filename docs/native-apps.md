# The iPhone and Android apps

The apps are the same web app, wrapped with [Capacitor](https://capacitorjs.com). The web app is
bundled inside, so there is one codebase for web, iOS and Android. The only native code is one tiny
plugin that plays the alarm sounds so that other apps' audio (Spotify...) is **ducked** (lowered
and restored) instead of paused.

## What lives where

| Thing                        | Where                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| The app (Svelte)             | `src/`                                                                                                                  |
| Alarm sound definitions      | `src/lib/sounds.ts` (notes, one source of truth)                                                                        |
| Alarm WAV files for the apps | `static/sounds/*.wav` (made by `npm run sounds:render`)                                                                 |
| JS side of the native plugin | `src/lib/nativeAudio.ts` (+ `alarm.ts`)                                                                                 |
| iOS plugin (Swift)           | `ios/App/App/AudioDuckingPlugin.swift`, registered in `MyViewController.swift`                                          |
| Android plugin (Java)        | `android/app/src/main/java/com/simonekittenz/dilationtimer/AudioDuckingPlugin.java`, registered in `MainActivity.java` |
| App id / name                | `capacitor.config.ts` (`com.simonekittenz.dilationtimer`)                                                              |
| Icon + launch screen art     | `assets/` (made by `npm run icons`)                                                                                     |

In a browser the alarm is played live with Web Audio. Inside an app it is played natively from the
WAV files. If the native plugin ever fails, the app falls back to Web Audio instead of going silent.

## Commands

```bash
npm run ios            # build for the app, copy into the iOS project, open Xcode
npm run android        # same for Android, opens Android Studio
npm run cap:sync       # build + copy into both projects without opening anything
npm run sounds:render  # re-make the WAV files after changing src/lib/sounds.ts (needs Chrome)
npm run icons          # re-make the app icons + launch screens from the bunny
```

Run `npm run ios` / `npm run android` again after **every** change to the web app: the apps carry
their own copy of it, and only `cap:sync` refreshes that copy.

## iPhone (your own phone, free)

You need a Mac, Xcode (free from the Mac App Store, big download), and a USB cable.

1. Open Xcode once so it finishes installing. Then **Xcode → Settings → Accounts → +** and sign in
   with your Apple ID.
2. `npm run ios`. Xcode opens the project.
3. Click **App** (blue icon, top of the left sidebar) → target **App** → **Signing & Capabilities**.
   Tick _Automatically manage signing_ and choose your **Team** (your name, "Personal Team").
   If it says the bundle identifier is not available, add something to the end of it
   (e.g. `com.simonekittenz.dilationtimer2`).
4. Plug in the iPhone, unlock it, tap **Trust**. On the phone turn on
   **Settings → Privacy & Security → Developer Mode** (it restarts the phone).
5. At the top of Xcode pick your iPhone and press **▶ Run**. The first build takes a few minutes.
6. First time only, on the phone: **Settings → General → VPN & Device Management** → your Apple ID →
   **Trust**. Then open the app.

With a free Apple ID the app **stops opening after 7 days**. Plug in and press ▶ again to renew it
(your data is kept). A paid developer account ($99/year) lasts a year and allows TestFlight.

## Android: first-time setup notes

Things that tripped us up, so they don't again:

- **Install Android Studio properly.** Drag _Android Studio_ from the downloaded `.dmg` into
  _Applications_ **in Finder**, then eject the `.dmg`. Opening it from the disk image gives
  "The application cannot be started right from a DMG file". (The "Android Developers" app in
  `~/Applications/Chrome Apps` is only a Chrome shortcut to the website.)
- **The Android SDK is a separate download** that Android Studio's first-run setup installs. If you
  are asked to "Select SDKs" with just a path box, the SDK is missing: use
  **Android Studio → Settings → Languages & Frameworks → Android SDK** and install
  _Android 16 (API 36)_, or point it at `~/Library/Android/sdk` once it exists.
- **Use Java 21 for Gradle.** The project compiles for Java 21 and Gradle 8.14 is not certified for
  newer Java than 24, but newer Android Studios bundle Java 25. In Android Studio:
  **Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK**, pick a 21 (use
  _Download JDK…_ if none is listed).
- **Building without Android Studio** (needs a JDK 21 and the SDK at `~/Library/Android/sdk`):

  ```bash
  cd android
  JAVA_HOME=<path to a JDK 21> ./gradlew assembleDebug
  # the app is android/app/build/outputs/apk/debug/app-debug.apk
  ```

## Android (give it to a friend, free)

You need Android Studio (free; it brings its own Java and the Android tools).

1. `npm run android`. Android Studio opens the `android` folder and syncs (first time: slow).
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**. When done, click **locate**. The file is
   `android/app/build/outputs/apk/debug/app-debug.apk`.
3. Send that file to your friend (WhatsApp, Telegram, Drive, email, USB. AirDrop does not work).
4. On her phone: tap the file. Android asks to allow _Install unknown apps_ for the app she
   opened it from. Allow it, then **Install**. If Play Protect says it does not recognise the app,
   tap **More details → Install anyway**.

To update her: build a new APK **on the same computer** and send it; it installs over the old one
and keeps her data. (A different computer signs it differently and she would have to uninstall
first, which erases her data. Have her use **Settings → Save backup** before that.)

## Testing Android without a phone

Android Studio's _Device Manager_ can create a virtual phone. From the command line, with the SDK
installed: `sdkmanager emulator "system-images;android-35;google_apis;arm64-v8a"`, create it with
`avdmanager create avd -n dilation-test -k "system-images;android-35;google_apis;arm64-v8a"`, boot it
with `emulator -avd dilation-test`, then `adb install -r app-debug.apk`. `adb shell dumpsys audio`
shows whether the app holds audio focus ("may duck") while a sound plays.

## The alarm with the screen off

An app's own timers and sounds cannot be trusted once the screen is off: a real phone puts the web
page to sleep within seconds, and Android refuses the audio-focus request, so music is not ducked. So
the apps hand the job to the phone's alarm clock instead (`@capacitor/local-notifications`,
`src/lib/notifications.ts`, `src/lib/backgroundAlerts.ts`).

- When the app goes to the background, `planBackgroundAlerts` works out from the saved session what
  should happen (an alert at the exact end of the timer, then a reminder a minute apart, up to 8, once
  the switch window has passed; the last dilator gets a single "All done" alert). They are scheduled
  with `allowWhileIdle`, so they fire even in deep sleep.
- When the app comes back to the front they are all cancelled, and the app takes over again. While
  it is in the background its own sounds are silenced, so nothing rings twice.
- Android uses one notification channel per sound (`bg_ping`, `bg_nudge`, `bg_done`, copied into
  `res/raw` by `npm run sounds:render`), plus a silent channel for volume 0. Android fixes a channel's
  sound once it exists, so bump the `-v1` suffix in `notifications.ts` whenever a sound changes.
- Permissions: `POST_NOTIFICATIONS` is asked for the first time a session starts (or with "Turn on" in
  Settings, which also has "Send a test", fired 10 seconds later so the phone can be locked).
  `USE_EXACT_ALARM` is declared so timing is exact without a settings detour.
- A notification sound does not duck other audio the way the in-app alarm does; that is Android's
  normal behaviour for notifications.

Verified on an Android 15 virtual phone with the screen off and Doze forced on: the alert arrived within
2 seconds of the timer ending, the reminder followed, the right sound was on each channel, and opening
the app cleared them. **Not yet tried on a real phone or on iPhone.** Some makers (Samsung, Xiaomi,
Oppo) kill background apps harder than stock Android; if alerts are late there, turn off battery
optimisation for the app. iPhone uses the same code with its normal notification sound.

## Offering the Android app on the website

The website has a start page (`/welcome`) where new visitors choose between downloading the Android
app and using the web version, and where the limits of the web version are explained. It is shown once
to brand-new visitors on the website only. Anyone with saved data, an installed web app, or the
Android/iOS app never sees it, and Settings has a link back to it.

To publish a new version of the Android app:

```bash
npm run apk          # builds the app and copies it to static/downloads/Dilation-timer.apk
git add -A && git commit -m "New Android app build" && git push   # Vercel then serves the new file
```

`npm run apk` also writes `src/lib/appRelease.json` (size, version, date, SHA-256) which the start page
shows, and a test checks that the file and that information agree. Do this after any change to the
web app that you want the Android app to have, and bump `versionName` / `versionCode` in
`android/app/build.gradle` first if people should be able to tell versions apart.

Things to know:

- The file is **debug-signed** with the debug key on the computer that built it. An update only
  installs over the old app if it is signed with the same key, so always build on the same Mac.
  Before many people depend on it, create a proper release key (Android Studio:
  _Build → Generate Signed App Bundle / APK_) and keep that keystore safe: if it is lost, people must
  uninstall (losing their data) to update.
- Every build adds about 6 MB to the git history, so publish when something worth sharing changed.
  (GitHub Releases would avoid that if it ever matters.)
- The web app's offline cache skips `/downloads/` and `/sounds/`, and the app's own build removes
  `build/downloads`, so the file is never downloaded by accident or packed inside itself.

## Moving your data from the web app to the app

The app is a separate "browser" from the web app, so it starts empty. In the web app use
**Settings → Save backup**, send the file to the phone (AirDrop / Files), then in the app use
**Settings → Restore backup**.

## Checking the ducking works (needs a real phone)

Play Spotify, open the app, **Settings → 🔔 Test**. Spotify should get quieter during each ping, then
return to normal in the quiet gaps. Please report back if it pauses instead, or is silent.

## Changing a sound

Edit the notes in `src/lib/sounds.ts`, run `npm run sounds:render`, commit the new WAVs, then
`npm run cap:sync`. The web app and the apps always share the same notes.
