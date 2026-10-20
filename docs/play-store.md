# Putting the app on Google Play

Everything that can be prepared in the project is ready. What is left needs **your** Google account, so
it is a checklist. The order matters in a few places (marked **before**).

Google's rules change, so where a button or form below looks different, trust the Play Console.
(Rules checked on 20 October 2026: [new personal accounts need a closed test](https://support.google.com/googleplay/android-developer/answer/14151465),
[Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756).)

## What is ready

| Thing                                              | Where                                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| The app bundle to upload                           | `npm run aab` makes `android/app/build/outputs/signing/Dilation-timer-play.aab`, signed with the **upload key** |
| The Play build leaves out the "new version" notice | automatic in `npm run aab` (Play does the updating)                                                             |
| Privacy policy page                                | https://dilation-timer.vercel.app/privacy                                                                       |
| Icon, feature graphic, 6 phone screenshots         | `npm run store:assets` writes them to `~/Desktop/Play-Store-assets` (start `npm run dev` first)                 |
| Listing text and form answers                      | below                                                                                                           |
| The start page's "Get it on Google Play" button    | add `"playUrl"` to `src/lib/appRelease.json` once the app is live (see the end)                                 |

The keys are in `~/.dilation-timer-signing` (back it up; see [`native-apps.md`](native-apps.md#signing)):
`release.keystore` is the app's real signing key, `upload.keystore` is only the key that proves an
upload is from you.

## 1. The developer account

1. Go to <https://play.google.com/console/signup>, choose **Personal** and pay the one-time **US$25**.
2. Verify your identity (ID document). Google also lists a device verification step for new accounts;
   you have an Android phone for that.
3. **Think about what is public.** The _developer name_ and the _developer email_ you give are shown on the
   store page. Google says your legal address is only shown for paid apps and in-app purchases. For the
   EU you may be asked whether you are a "trader"; a free hobby app normally is not, but read the
   question. Use an email address you are happy to share, not your main one.

New personal accounts must run a **closed test with at least 12 testers who stay opted in for 14 days in
a row** before they can apply for production (see step 6).

## 2. Create the app

**Create app**: name `Dilation timer`, default language English (United Kingdom or Netherlands, as you
like), **App**, **Free**, and accept the declarations. The package name is
`com.simonekittenz.dilationtimer` (it is fixed by the app and cannot be changed later).

## 3. Hand Google the app's signing key (before the first release)

This makes Google sign what it delivers with the **same key as the downloadable app**, so people can
switch between the two and keep their data. It has to be done **before** the first release reaches the
open testing or production track.

1. In the app: **Test and release → App integrity → Play app signing** (called **Protected with Play**
   in newer consoles) and choose **Change the app signing key → Provide a copy of your app signing key**.
2. The page shows a command using Google's **PEPK tool** and an encryption key file. Download both. Run
   the command with the keystore `~/.dilation-timer-signing/release.keystore` and the alias
   `dilation-timer`. When it asks for the key password, it is the contents of
   `~/.dilation-timer-signing/password.txt`. Upload the `.zip` it makes.
3. If the Console asks for your **upload key certificate**, use
   `~/Desktop/Play-Store-assets/upload_certificate.pem` (public information only; it is made from
   `upload.keystore`). If you ever need it again:
   `keytool -export -rfc -keystore ~/.dilation-timer-signing/upload.keystore -alias upload -file upload_certificate.pem -storepass:file ~/.dilation-timer-signing/upload-password.txt`

## 4. Upload the first version

```bash
npm run aab
```

Upload `Dilation-timer-play.aab` (path above) under **Internal testing** first, install it from the test
link on your phone and check it, then use the same file for **Closed testing**.

## 5. The forms (App content)

Answer these truthfully; below is how the app actually behaves.

| Form                                  | Answer                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy policy                        | https://dilation-timer.vercel.app/privacy                                                                                                                                                                                                                                                                                                 |
| App access                            | All functionality is available without logging in                                                                                                                                                                                                                                                                                         |
| Ads                                   | No ads                                                                                                                                                                                                                                                                                                                                    |
| Target audience                       | **18 and over** only. Not designed for children or families                                                                                                                                                                                                                                                                               |
| Content rating (questionnaire)        | No violence, no sexual content or nudity, no user-generated content, no gambling, no purchases, no location sharing. It is a medical-type timer, so say so in the category question                                                                                                                                                       |
| Data safety                           | **No data collected, no data shared.** Everything stays on the device; the app sends nothing about the user. (The website's visit counter is not in the app, so it is not part of this answer.) (The app declares the Internet permission only for an update check that the Play version does not make.) No account, so nothing to delete |
| Health apps                           | The app is a personal timer for a post-surgery routine. It does not diagnose, measure or give medical advice, and says so. Tick only the features it really has                                                                                                                                                                           |
| Exact alarms                          | The Console will ask why the app uses `USE_EXACT_ALARM`: the app's core function is a **timer** that must alert at the exact second a dilator's time is up                                                                                                                                                                                |
| Category                              | **Health & Fitness** (Medical is also possible, but it brings stricter rules; the app is not a medical device)                                                                                                                                                                                                                            |
| Government / financial / news / COVID | No                                                                                                                                                                                                                                                                                                                                        |

Permissions the Play build asks for: notifications, exact alarms, wake lock, restart-reschedule, internet.

## 6. Closed test, then production

1. **Closed testing → create a track → add testers** (a list of email addresses or a Google Group) and
   send them the opt-in link. They must **install it and stay opted in for 14 days in a row**; if one
   opts out the count restarts for them. Ask for 15 to be safe.
2. When 12 testers have been opted in for 14 days, **Dashboard → Apply for production**. Answer the three
   short question sets (how testing went, about the app, production readiness). Review usually takes up
   to about seven days.
3. Tip: a short message to testers helps: "Please install, open it now and then, and stay opted in
   for two weeks. Tell me if anything is odd."

## 7. After it is live

1. Put the link on the start page: in `src/lib/appRelease.json` add to the `android` entry
   `"playUrl": "https://play.google.com/store/apps/details?id=com.simonekittenz.dilationtimer"`. The page then shows
   **Get it on Google Play** first, with the file download as a quieter second choice.
   (`npm run apk` keeps that line.) Commit and push.
2. Later releases: raise the version with `npm run apk` (that also updates the downloadable file), then
   `npm run aab`, and upload the bundle to the **Production** track. Each upload must have a higher version
   code than the one before; `npm run aab` never raises it by itself, so both channels share one number.

## Listing text (copy and paste)

**App name** (max 30): `Dilation timer`

**Short description** (max 80, 80 used):

```
A cute timer for dilation sessions, with your schedule and gentle switch alerts.
```

**Full description** (max 4000, 1951 used):

```
Dilation timer is a cute, calm timer for dilation sessions. It knows the WIH International Hospital schedule, shows what is on for today, counts each dilator down, and gently tells you when it is time to switch.

🎀 YOUR SCHEDULE
• Enter your surgery date once and the app works out which week you are in.
• Two ready-made programs: WIH standard and WIH with size 5. Everything in them can be edited: phases, days, dilators and minutes.
• A rest week first, then morning and evening sessions.

⏱ SESSIONS THAT LOOK AFTER YOU
• You start each session yourself. Pause, add or remove a minute, or move on to the next dilator.
• A soft chime warns you shortly before a timer ends.
• Time to switch? There is a quiet window to swap dilators. If you have not yet, a gentle reminder repeats. "+ 1 min" gives you a little longer, and "Chill out, I'm on it!" quiets the reminders for a while.
• After the last dilator the session logs itself. No nagging.

✨ SHORT ON TIME?
Custom session: pick a length (1 hour, 2 hours, or anything in between) and which dilators to use. Today's routine is stretched or squeezed to fit, in blocks of 5 minutes, and you can change it before you start.

🔔 ALERTS, EVEN WHEN YOUR PHONE IS LOCKED
When a timer ends, your phone shows a notification at the right moment, then gentle reminders until you have switched. While the app is open, music from other apps is turned down for the alarm instead of stopped.

🔊 GENTLE SOUNDS
Rounded, old-school tones that never startle. Set the volume, all the way down to off.

📖 HISTORY AND BACKUPS
Look back at your sessions, and save or restore a backup file whenever you like.

🐰 A LITTLE FRIEND
Choose a bunny or a kitty to keep you company.

🔒 PRIVATE BY DESIGN
No accounts, no ads, no tracking in the app. Everything stays on your phone.

This is a personal timer, not medical advice. Always follow the instructions of your own clinic. Not affiliated with or endorsed by WIH International Hospital.
```

**What's new** (max 500, 160 used):

```
First release on Google Play. Includes your schedule, session timers with gentle switch alerts, custom sessions, and alerts that work when your phone is locked.
```

**Contact:** an email you are happy to show; **website** `https://dilation-timer.vercel.app`; **privacy
policy** `https://dilation-timer.vercel.app/privacy`.

Note the last line of the description: the app uses WIH's published schedule but is not made by or
connected to the hospital, and the listing should say so.

## Pictures

`npm run store:assets` (with `npm run dev` running) makes, in `~/Desktop/Play-Store-assets`:

| File                                        | Size        | Used for                              |
| ------------------------------------------- | ----------- | ------------------------------------- |
| `icon-512.png`                              | 512 × 512   | App icon                              |
| `feature-graphic.jpg`                       | 1024 × 500  | Feature graphic                       |
| `phone-1-today.jpg` … `phone-6-history.jpg` | 1170 × 2340 | Phone screenshots (2 to 8 are needed) |

They are taken of the real app with made-up demo data, so check them over before uploading.
