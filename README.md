# Dilation timer 🎀

A cute, pink timer for dilation sessions. It knows the WIH International Hospital schedule,
shows today's routine from your surgery date, counts each dilator down, and tells you when it's time
to switch to the next one.

> This is a personal tool, not medical advice. Always follow the instructions of your own clinic.

**Use it:** <https://dilation-timer.vercel.app> (in the browser, or added to your home screen)
**Android app:** download it from the start page at the same address.
**iPhone app:** not in the App Store; it's built from this repo with Xcode (see [`docs/native-apps.md`](docs/native-apps.md)).

## What it does

- **Follows your schedule.** Day 1 is your surgery date. Today shows the routine for that day, the
  rest week, and a morning / evening schedule. Two ready-made programs, **WIH standard** and **WIH
  with size 5**, and everything in them (phases, days, dilators, minutes) can be edited.
- **First-run setup.** Asks which program you follow and your surgery date, then shows the week you're
  in so you can check it looks right.
- **Session timer.** You start each session yourself. Pause, add or remove a minute, or skip ahead
  to the next dilator. A soft chime warns you 10 seconds before the end.
- **A gentle switch.** When a timer ends there's a quiet window to swap dilators. If you haven't
  pressed "I switched" by then, a soft nudge repeats. **+ 1 min** gives you a little longer for that
  one switch, and **Chill out, I'm on it!** quiets the nudging for another window.
- **The last dilator needs no nagging.** A fanfare plays, the session logs itself, and the screen clears.
- **Custom session.** Short on time? Pick a length with a slider (or **1 hour** / **2 hours**) and the
  dilators to use. Today's routine is stretched or squeezed to fit, in blocks of 5 minutes (dilators
  already at 5 minutes stay at 5), and you can edit it before you start.
- **History** of finished and skipped sessions, **backup and restore** to a file, and a bunny or kitty
  to keep you company.
- **Sounds that don't startle.** Rounded, old-school tones, a few soft pings and a fanfare, a volume slider
  that goes all the way to off. In the apps the alarm only _lowers_ other audio (like Spotify), it
  doesn't pause it.
- **Locked-screen alerts (apps only).** When the app is in the background or the phone is locked, the
  phone's own alarm clock shows a notification when a timer ends, then gentle reminders. Settings has a
  "Send a test". A web page can't do this, so the browser version needs the screen on during a session.
  (Tried on Android; the iPhone app uses the same code but hasn't been tried.)
- **Daily reminders (apps only).** Pick a time for each session (morning, evening or once a day) and
  the phone reminds you on the days that have one. The reminder has buttons to start the session, be
  reminded again in 30 minutes, or turn that one off. Set up from a small button on Today, or in Settings.

## Privacy

There is no server and no account. Everything (settings, schedule, history, the running session) is
stored on your device, in the browser's local storage, under the key `dilation-timer:v1`. "Save backup"
writes it to a file you keep. The only thing the Android app ever asks the network for is whether a
newer version has been published (`/release.json`). The website (not the apps) counts page views
anonymously with Vercel Web Analytics: no cookies, only the page, country, device and browser, and it
honours Do Not Track. It is set up in `src/lib/analytics.ts`, which never runs in the apps. See the
app's `/privacy` page for the wording users see.

## Running it

You need Node.js (a recent version) and npm.

```bash
npm install
npm run dev      # http://localhost:5173
```

| Command                                   | What it does                                                   |
| ----------------------------------------- | -------------------------------------------------------------- |
| `npm test`                                | Unit tests (Vitest)                                            |
| `npm run check`                           | Type and Svelte checks                                         |
| `npm run format` / `npm run format:check` | Prettier                                                       |
| `npm run build`                           | Production build of the website into `build/`                  |
| `npm run sounds:render`                   | Re-make the alarm WAV files after changing `src/lib/sounds.ts` |
| `npm run icons`                           | Re-make the app icons and launch screens                       |
| `npm run android` / `npm run ios`         | Build for the app and open Android Studio / Xcode              |
| `npm run apk`                             | Build, sign and publish the Android app (see below)            |
| `npm run aab`                             | The Google Play version of the app (see below)                 |
| `npm run store:assets`                    | Pictures for the Play listing (icon, banner, screenshots)      |
| `npm run apk:debug`                       | A debuggable test build of the Android app, for emulators      |

## How it's built

[SvelteKit](https://svelte.dev/docs/kit) with Svelte 5, built as a static site and wrapped for iOS and
Android with [Capacitor](https://capacitorjs.com). One codebase serves the website, the installable web
app and both phone apps. The only native code is a tiny plugin that plays the alarm and lowers other
apps' audio.

```
src/
  routes/            the screens: Today, History, Settings, Custom session, Welcome
  lib/
    session.ts       the timer's rules (pure, driven by saved timestamps)
    schedule.ts      which phase and which sessions a date has
    defaults.ts      the WIH programs
    customSession.ts stretching a routine to fit a chosen time
    store.svelte.ts  app state, saved to local storage
    sounds.ts        the alarm notes (one source for the web and the app sound files)
    notifications.ts locked-screen alerts and reminders; backgroundAlerts.ts and reminders.ts plan them
    update.ts        "is there a newer Android app?"
static/              icons, alarm sounds, the Android app download
android/  ios/       the Capacitor projects, plus the native audio plugin
scripts/             sound, icon and Android build scripts
docs/                notes on the apps
```

Timers are worked out from saved start times, not by counting seconds, so they stay right when the
page sleeps or the app is closed and reopened.

## Releasing

- **Website:** push to `main`; Vercel builds and deploys it.
- **Android app:** `npm run apk` builds the release app, signs it, checks it, and puts it in
  `static/downloads/` together with `src/lib/appRelease.json`. Commit both and push. The version goes up
  once per release (the script works out whether the current one is already published), and installed
  apps then offer the update themselves.
- **Google Play:** `npm run aab` builds the bundle to upload, signed with a separate upload key. The
  account steps, form answers and listing text are in [`docs/play-store.md`](docs/play-store.md). The
  privacy policy the listing needs is the app's own `/privacy` page.
- **Signing key:** the release key lives **outside** this folder, in `~/.dilation-timer-signing`. Keep a
  backup of that whole folder: without it nobody can update the app. Details are in
  [`docs/native-apps.md`](docs/native-apps.md#signing).

More about the phone apps (setup, testing on an emulator, how the alarm and ducking work, the
screen-off findings) is in [`docs/native-apps.md`](docs/native-apps.md).

## Good to know

- The iPhone app's code has only been syntax-checked. It has never been built or run on a phone.
- No licence has been chosen for this project yet.
