# Putting Goal Machine on Google Play

## Verdict

It's doable, but a few things need you (accounts and keys) and there are two real policy risks to manage.

1. **Intellectual property.** The game uses the Premier League's name, club names and club colours, and (on the web and in the
   GitHub APK) player photos from premierleague.com and Transfermarkt. Google removes apps when a rights holder complains,
   and reviewers reject apps whose name, icon or listing suggest an official product.
   - The **Play version already leaves out the Premier League and Transfermarkt photos.** It shows freely licensed
     Wikimedia photos (credited in the game) or initials instead.
   - Player names and statistics are facts and are generally fine to use.
   - Keep "Premier League" out of the app title and icon, and say "unofficial fan game" in the listing (text below).
   - Club colours in the favourite-club feature are low risk. There are no crests or logos anywhere, and it should stay that way.
2. **"WebView wrapper" apps.** Google rejects apps that are just a website in a frame ("Minimum functionality"). Goal Machine
   is a full game rather than a site, and the app adds native sharing, vibration, deep links, an offline screen and offline
   play once loaded. If a reviewer still objects, the fix is to ship the game files inside the app instead of loading the
   live site (a bigger change, but possible).

## Already done in the code

| | |
|---|---|
| Target Android 16 (API 36), required for new apps | ✅ `targetSdk 36`, AGP 8.10, Gradle 8.11 |
| Android 15+ edge-to-edge drawing handled | ✅ the page is padded clear of the status/navigation bars |
| Android App Bundle (Play only accepts .aab) | ✅ the *Android APK* workflow builds `goal-machine-play.aab` (download it from the run's artifacts) |
| Play version doesn't offer APK downloads or self-updates (not allowed on Play) | ✅ `play` flavour; the site checks `AndroidApp.channel()` |
| Play version without PL/Transfermarkt photos | ✅ |
| Play version without the 🎧 Soundtrack (Epidemic Sound licence covers the website only) | ✅ |
| Offensive-name filter, and players can report names and profile pictures | ✅ |
| Privacy policy page | ✅ https://opportunisticgames.github.io/goal-machine/privacy.html |
| App icon 512×512, feature graphic 1024×500, 4 phone screenshots | ✅ in this folder (`node android/store/make_store_assets.js` remakes them) |
| No ads, no analytics, no tracking | ✅ keeps the Data safety form simple |

## What you need to do

1. **Create a Google Play developer account** (one-off US$25) at https://play.google.com/console.
   - An **organisation** account (for Opportunistic Games) needs a free **D-U-N-S number** for the business. It takes a
     few days to get, but a new organisation account doesn't have to do the tester step below.
   - A **personal** account is quicker to set up, but new personal accounts must run a **closed test with at least 12
     testers for 14 days** before going public. Your friends who already play would do.
   - Either way Google checks your identity, and for organisations the business address.
2. **Make a private upload key** and add it to GitHub. The key in the repo is public, so it must never sign a Play upload.
   On any computer with Java:
   ```
   keytool -genkeypair -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 upload.keystore > upload.b64      # macOS: base64 -i upload.keystore -o upload.b64
   ```
   Then in the repo on GitHub, go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `UPLOAD_KEYSTORE_B64`: the contents of `upload.b64`
   - `UPLOAD_KEYSTORE_PASSWORD`: the password you chose
   - `UPLOAD_KEY_ALIAS`: `upload`

   Keep `upload.keystore` and its password somewhere safe. Google Play App Signing holds the real app key, so if this upload
   key is ever lost it can be reset.
3. **Run the *Android APK* workflow** (Actions tab → Android APK → Run workflow), download the `goal-machine-play-bundle`
   artifact and upload `goal-machine-play.aab` in Play Console → Test and release.
4. Fill in the Play Console forms using the answers below.

## Store listing (copy and paste)

- **App name:** Goal Machine – Football XI Quiz
- **Short description (max 80):** Build the biggest-scoring XI from 5,000+ footballers. Dailies, duels & more.
- **Full description:**

> How well do you really know English top-flight football since 1992?
>
> Spin the reels and build an XI from over 5,000 real players, every one of them equally likely. Can you find the goal
> machines among the journeymen? Every player, his clubs and his career are there: 2,000+ with 50 or more appearances,
> and in Extreme and Purist modes everyone who ever played.
>
> ⚽ ULTIMATE WILDCARD: build the XI with the most goals, assists or appearances, with 13 wildcards to play
> 🎯 CLASSIC & TARGET: hit the number exactly for a bullseye
> 🏆 THE TREBLE and 🎲 MYSTERY TARGET: three targets at once, or a secret one
> 📅 DAILY GAMES: the Daily Ultimate, Footle (guess the mystery player in 8) and the Daily Club Grid, with streaks
> ⚔️ HEAD TO HEAD: pass the phone for a best-of series, or play a friend online in a Draft Duel or Live Race
> 🦘 Club Hopper, Higher or Lower, Who Am I? and Guess the Tally
> 📒 Collect players in your album, build your Dream XI and unlock 34 badges
> 🏟️ Pick your club for club colours, a daily Club Footle and a Club XI draft
> 🌙 Light and dark themes, music and sound effects
>
> Unofficial fan-made game. Not affiliated with, endorsed by or connected to the Premier League, its clubs or any
> player. Player statistics are compiled from public sources.

- **Category:** Games → Trivia (or Word/Puzzle). **Tags:** football, soccer, quiz, trivia.
- **Contact email:** a business email for Opportunistic Games (it's shown publicly).
- **Privacy policy URL:** https://opportunisticgames.github.io/goal-machine/privacy.html

## Play Console answers

- **Ads:** No ads.
- **App access:** Everything is available without logging in.
- **Content rating (IARC questionnaire):** trivia/quiz game; no violence, gambling, sexual content, drugs or user-to-user
  chat. Users can see other users' chosen names on leaderboards and friends' profile pictures (user-generated content), so answer yes to users sharing content. Moderation: offensive names are refused, and names (tap one on a leaderboard) and pictures can be reported; several reports hide the name or remove the picture.
  Expect PEGI 3 / Everyone.
  - The wildcards are luck-based, but there's no real money, betting or purchases, so answer **no** to gambling.
- **Target audience:** 13+ (avoids the extra Families policy requirements). Not designed for children.
- **Data safety:**
  - Data collected: **App activity → Other user-generated content** (leaderboard name, scores, online game moves).
    Purpose: App functionality. Not shared with third parties. Not optional for leaderboard use (optional overall).
  - **User IDs:** the random account key hash counts as an identifier. Purpose: App functionality / Account management.
  - Data is encrypted in transit (HTTPS): **yes**. Users can request deletion: **yes** (see the privacy policy).
  - **Photos and videos → Photos** (optional profile picture, shown to friends and opponents). Purpose: App functionality. Optional. Users can report pictures and remove their own.
  - No location, contacts, financial, health, device IDs or analytics.
- **Government / news / health / finance declarations:** none apply.

## Nice to have later

- Ship the game files inside the app (safer for the WebView rule, and works fully offline from the first launch).
