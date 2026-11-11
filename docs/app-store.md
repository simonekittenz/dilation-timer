# Putting the iPhone app on TestFlight and the App Store

Everything that can be prepared in the project is ready. What is left needs **your** Apple account, so it
is a checklist. TestFlight comes first: it puts the real app on real iPhones (yours and friends') before
anyone at Apple reviews the store listing.

Apple's pages change often, so where a button below looks different, trust App Store Connect.

## What is ready

| Thing                             | Where                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| An app that builds and starts     | `npm run ios:check` builds it for the simulator and looks inside (checked on Xcode 27, iOS 27 simulator)                |
| An archive that signs and uploads | `npm run ios:archive` (an .ipa on your disk) and `npm run ios:testflight` (uploaded). Both need the account below       |
| A dry run without an account      | `npm run ios:archive -- --unsigned` makes the archive without signing, to prove that part works                         |
| The app's version                 | The same as Android (`src/lib/appRelease.json`). The build number is the number of commits, so it always goes up        |
| Privacy manifest, encryption flag | `ios/App/App/PrivacyInfo.xcprivacy` (no tracking, no data collected) and `ITSAppUsesNonExemptEncryption = false`        |
| iPhone only                       | The app is for iPhone (an iPad runs it in the iPhone's size). That means no iPad screenshots are needed                 |
| Privacy policy page               | https://dilation-timer.vercel.app/privacy                                                                               |
| Screenshots                       | `npm run store:assets:ios` (with `npm run dev` running) writes six 1320 × 2868 pictures to `~/Desktop/App-Store-assets` |
| Listing text and the form answers | below                                                                                                                   |

The app id is `com.simonekittenz.dilationtimer`, the same as on Android. Version 1.0 of the iPhone app does
not exist: the first upload uses the current version number (see `appRelease.json`).

## 1. The developer account

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/enroll/) as an
   **Individual**: US$99 a year, with an identity check that can take a day or two. You need an Apple
   Account with two-factor authentication.
2. **Think about what is public.** On the App Store your _seller name_ is your legal name (as an
   individual). To show a different name you would enroll as an organisation, which needs a D-U-N-S number.
   The _support URL_ and the _contact email_ you give are public too.
3. Note your **Team ID**: developer.apple.com → Account → Membership details (ten letters and digits).

## 2. Create the app in App Store Connect

You do not need to register the bundle ID by hand: the first signed build does it (Xcode registers it as
`XC com simonekittenz dilationtimer`). You also do not need an iPhone plugged in: signing happens when the
build is exported, with a distribution certificate and an App Store profile that Xcode creates, and that
never needs a registered device.

[App Store Connect](https://appstoreconnect.apple.com) → **Apps → + → New App**: platform iOS, name
`Dilation timer`, primary language English (U.K.), bundle ID `com.simonekittenz.dilationtimer` from the list
(run `npm run ios:archive` once first if it is not there yet), SKU `dilation-timer`, full access. If it
asks you to accept an agreement first, accept it (a banner at the top of App Store Connect). Free apps need
no tax or bank details.

## 3. Let the Mac sign and upload

The simplest way is to open Xcode once → **Settings → Accounts → +** and sign in with your Apple Account.
Then put your Team ID where the scripts find it (outside the project, next to the Android keys):

```bash
mkdir -p ~/.dilation-timer-signing
echo 'APPLE_TEAM_ID=ABCDE12345' > ~/.dilation-timer-signing/ios.env
```

To upload without Xcode being signed in (or from a script), make an **App Store Connect API key** instead:
App Store Connect → Users and Access → Integrations → **App Store Connect API → +**, role **App Manager**.
Download the `.p8` file (Apple lets you do this **once**), keep it in `~/.dilation-timer-signing/`, and add
three lines to `ios.env`:

```
ASC_KEY_PATH=/Users/you/.dilation-timer-signing/AuthKey_XXXXXXXXXX.p8
ASC_KEY_ID=XXXXXXXXXX
ASC_ISSUER_ID=00000000-0000-0000-0000-000000000000
```

Back that folder up like the Android keys (see [`native-apps.md`](native-apps.md#signing)). Never commit
it; it lives outside the project on purpose.

## 4. The first upload

```bash
npm run ios:check        # does it build and start? (no account needed)
npm run ios:testflight   # builds, signs, uploads
```

The first signed run lets Xcode create the distribution certificate and profile by itself
(`-allowProvisioningUpdates`). Without the app from step 2 in App Store Connect, the upload stops with
"App record ... not found"; the build itself is fine. After a few minutes of processing at Apple (you get an email) the build
shows up under **App Store Connect → your app → TestFlight**. If it says "Missing Compliance", the
encryption question was not picked up; answer **No** (the app uses no encryption of its own).

Each upload needs a new build number; the script makes sure of that. A new _version_ is the same as for
Android: `npm run apk` raises it (see [`native-apps.md`](native-apps.md#versions-and-update-notices)).

## 5. TestFlight

- **You and other people in your App Store Connect team** (up to 100): TestFlight → Internal Testing →
  create a group → add yourself. Install the TestFlight app on your iPhone, accept the invitation, install.
  No review is needed.
- **Friends** (up to 10,000): External Testing → create a group → add the build → add testers by email or
  a public link. The first build goes through a short **Beta App Review** (usually about a day).
  TestFlight builds expire after 90 days; just upload a newer one.

### What to try on a real iPhone

The iPhone app uses the same code as Android, but it has **never been on a real iPhone**. Please check:

1. Setup: choose a program, a date, answer the streak question. Start a session, let a timer run out.
2. **Allow notifications** when asked. Lock the phone during a timer: the alert must arrive on time, then
   the gentle repeats. Open the app and they must disappear.
3. Settings → 🔔 Test, then lock the phone and wait ten seconds.
4. Play music (Spotify), start a session: the music should get quieter for each ping and come back after.
5. Daily reminders: set one for a few minutes ahead, lock the phone, tap its buttons.
6. Settings → Save backup: the iPhone share sheet must open, and Restore must read the file again.
7. The screen stays on during a session (the app asks iOS for this itself). Both light and dark mode. The notch and the home bar do not cover
   anything.
8. Nothing here should mention Android or a download: the app never shows the website's start page.

The app carries a small second target, the **SessionWidget** extension for the Live Activity. Its App ID
(`com.simonekittenz.dilationtimer.SessionWidget`) and profile are created by the first signed export, so
that run may take a little longer and will add the App ID to your Apple account. Nothing extra is needed in
App Store Connect. Also try: start a session, lock the phone, and check the timer on the lock screen.

Known differences from Android: an iPhone has no notification channels, so alerts and reminders use the
normal notification sound (the loud alarm sound only plays while the app is open), and iOS keeps at most 64
waiting notifications, which the app stays well under (a test checks it). Alerts do not break through a
Focus mode unless the person allows the app in that Focus.

## 6. The App Store listing

When TestFlight looks good, in App Store Connect → your app → the version page.

### The forms

| Form                      | Answer                                                                                                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Price                     | Free, no in-app purchases                                                                                                                                                                                                                            |
| Category                  | **Health & Fitness** (primary). Medical is possible but brings stricter review; the app is not a medical device                                                                                                                                      |
| Privacy Policy URL        | https://dilation-timer.vercel.app/privacy                                                                                                                                                                                                            |
| App Privacy ("nutrition") | **Data Not Collected.** Everything stays on the device and the app sends nothing about the person. Tracking: **No**. (The website's visit counter is not in the app.)                                                                                |
| Age rating                | Answer the questionnaire truthfully: no violence, no sexual content or nudity, no gambling, no user-generated content, no web access beyond the app itself, no purchases. It is a personal timer for a medical routine; let Apple compute the rating |
| Export compliance         | Already answered by `ITSAppUsesNonExemptEncryption = false`: no encryption of its own                                                                                                                                                                |
| Content rights            | **No third-party content**: the app shows no one else's text, images or media. The schedule is a list of durations you can edit. The listing says the app is not affiliated with the hospital, in case App Review asks                               |
| Sign in                   | Not needed. No account                                                                                                                                                                                                                               |
| Copyright                 | `2026 <your name>`                                                                                                                                                                                                                                   |
| Support URL               | A page where people can reach you: `https://github.com/simonekittenz/dilation-timer/issues` works (the privacy page links there too)                                                                                                                 |
| Marketing URL (optional)  | https://dilation-timer.vercel.app                                                                                                                                                                                                                    |

**App Review notes** (the box for the reviewer):

```
No account or login is needed. Everything works offline and all data stays on the device.

This is a simple timer for a post-surgery routine. It does not diagnose, measure or give medical advice, and
says so. It does not use HealthKit or any health data from the phone.

To try it: on first launch choose a program, enter any date as the surgery date (a date a few weeks ago shows
a day with sessions), answer the short questions, then tap "Start morning session". When a timer ends the app
plays a short sound and shows a "Time to switch" screen. Please allow notifications when asked: they are used
for the alert when a timer ends while the phone is locked.

The schedule is based on the dilation program that WIH International Hospital publishes for its patients. The
app is not made by, affiliated with or endorsed by the hospital, and the description says so.
```

### Listing text (copy and paste)

**Name** (max 30): `Dilation timer`

**Subtitle** (max 30, 26 used): `Schedule and gentle alerts`

**Promotional text** (max 170, can be changed any time):

```
A cute, calm timer for dilation sessions: your schedule, each dilator counted down, and a gentle nudge when it is time to switch.
```

**Keywords** (max 100, 96 used, separated by commas, no spaces):

```
dilation,dilator,timer,aftercare,recovery,routine,schedule,reminder,session,vaginoplasty,post-op
```

**Description** (max 4000):

```
Dilation timer is a cute, calm timer for dilation sessions. It knows the WIH International Hospital schedule, shows what is on for today, counts each dilator down, and gently tells you when it is time to switch.

YOUR SCHEDULE
- Enter your surgery date once and the app works out which week you are in.
- Two ready-made programs: WIH standard and WIH with size 5. Everything in them can be edited: phases, days, dilators and minutes.
- A rest week first, then morning and evening sessions.
- A message when a new dilator appears, with the option to take more time.

SESSIONS THAT LOOK AFTER YOU
- You start each session yourself. Pause, add or remove a minute, or move on to the next dilator.
- A soft chime warns you shortly before a timer ends.
- Time to switch? There is a quiet window to swap dilators. If you have not yet, a gentle reminder repeats. "+ 1 min" gives you a little longer, and "Chill out, I'm on it!" quiets the reminders for a while.
- After the last dilator the session logs itself. No nagging.
- Up late? A session after midnight can count as last night's evening session.

SHORT ON TIME?
Custom session: pick a length (1 hour, 2 hours, or anything in between) and which dilators to use. Today's routine is stretched or squeezed to fit, in blocks of 5 minutes, and you can change it before you start.

ALERTS, EVEN WHEN YOUR PHONE IS LOCKED
When a timer ends, your phone shows a notification at the right moment, then gentle reminders until you have switched. Daily reminders can nudge you to start a session. While the app is open, music from other apps is turned down for the alarm instead of stopped.

A STREAK, IF YOU WANT ONE
Count how many days in a row you did all your sessions, and cheer when you conquer a new dilator. Rest days never break it, and you can turn it off.

GENTLE SOUNDS
Rounded, old-school tones that never startle. Set the volume, all the way down to off.

HISTORY AND BACKUPS
Look back at your sessions, and save or restore a backup file whenever you like.

A LITTLE FRIEND
Choose a bunny or a kitty to keep you company.

PRIVATE BY DESIGN
No accounts, no ads, no tracking. Everything stays on your phone.

This is a personal timer, not medical advice. Always follow the instructions of your own clinic. Not affiliated with or endorsed by WIH International Hospital.
```

**What's new** (max 4000):

```
First release on the App Store. Includes your schedule, session timers with gentle switch alerts, custom sessions, daily reminders and alerts that work when your phone is locked.
```

### Pictures

`npm run store:assets:ios` (with `npm run dev` running; set `STORE_URL` if it is not on port 5273) writes to
`~/Desktop/App-Store-assets`:

| File                                 | Size        | Used for                                                                                                 |
| ------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------- |
| `phone-1-today.png` … `phone-6-…`    | 1320 × 2868 | Screenshots, **6.9-inch** iPhone class                                                                   |
| `6.3-inch/phone-1-today.png` … `6-…` | 1206 × 2622 | The same screenshots for the **6.3-inch** class (App Store Connect asks for whichever class is required) |
| `header-3840x1646.png`               | 3840 × 1646 | Optional **product page header** (21:9), at the top of the page                                          |
| `search-1920x1280.png`               | 1920 × 1280 | Optional **search results** image (3:2)                                                                  |

They are PNG files without transparency, because App Store Connect does not take JPEG. Upload up to ten screenshots per class; three to six is plenty. They are taken of the real app with
made-up demo data, so check them over first.

**iPhone Duo:** screenshots for it are optional now. From April 2027 Apple requires them for apps built with
the iOS 27.1 SDK, which this one is, so the first update after that needs a set at 1398 × 2034 (outer
display) and/or 2007 × 2853 (inner display).

### Submitting

Version page → pick the build from TestFlight → **Add for Review**. Review usually takes a day or two. If
Apple asks about the medical nature of the app, point to the review notes and the disclaimer in the
description.

## 7. After it is live

1. Later releases: `npm run apk` raises the version (and builds Android), then `npm run ios:testflight`,
   and pick the new build on the next version page. The App Store does the updating; the app never checks
   for updates on iPhone.
2. Link it from the website: the start page can get an App Store button like the "Get it on Google Play"
   one (`playUrl` in `appRelease.json`). That is not wired up for iPhone yet.
