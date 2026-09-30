# October 2026 Group Challenge

A reusable small-group fitness challenge app for a 31-day October 2026 challenge. Participants
choose 3 activities each day, log progress toward 100 points per activity, and
work together toward a shared team goal.

## Features

- 11 activity choices with per-activity point caps
- Daily 3-activity selection
- Automatic rotating double-points activity
- Team daily total, month total, group goal, and pace status
- Private personal progress panel for the current device
- Public participant list and previous-day 400 club
- Anonymous Firebase identity with owner-only writes
- Browser-only test mode
- Installable Progressive Web App

## Scoring

- Push ups: enter actual reps, 2 points each
- Pull ups: choose Full (10 points per rep) or Modified (2 points per rep). Both cap at 100 base points.
- Squats/Lunges: enter actual reps, 1 point each
- Sit ups: enter actual reps, 1 point each
- Plank: enter actual seconds, 10 points per 30 seconds
- Running/Walking: enter actual minutes, 2 points per minute
- Strength: enter weight-training repetitions, 1 point each
- Dancing/Aerobics: enter combined dancing or aerobics minutes (including video workouts), 4 points per minute
- Stairs: enter actual stairs, 1 point per 5 stairs
- Bird dog: enter actual reps, 2 points each
- Other: enter 0-100 self-assessed points total per day for all unlisted activities.
  100 means doable but challenging for you. Use a consistent standard and do not
  count exercise already logged in another category. This uses one of the three
  daily choices and is never doubled.

For Other, the entered value is limited to 100. For the remaining activities,
the app records the actual amount entered, but each activity is capped at 100
base points. For example, 100 push ups still shows as 100 push ups, but awards
100 base points. The rotating double-points activity can make one selected
activity worth 200 points, so the daily max is 400.

Inclusive movement notes:

- Push ups may be wall pushups, knee pushups, or full pushups.
- Sit ups may be full sit ups or crunches.
- One bird dog rep means a right-left pair.

The group goal is:

```text
sum of (scoring days from each person's participation start through October 31 x 250)
```

Participation starts with first positive points, or an explicit Rest selection on
October 1, 8, 15, or 22. Joining alone adds no goal. Eligible full weeks (1-7,
8-14, 15-21, 22-28) each contribute six scoring days: 1,500 points. Eligibility
requires starting by that week's opening day. October 29-31 has no rest allowance.
The first completed zero-point day becomes Rest automatically if the allowance
is unused; after six scoring days, the seventh is Rest. Rest earns no points.
Additional missed days remain in the goal. Until Rest is assigned, the allowance
is reserved for week-end in daily pace. Dates use Pacific time.

Challenge days follow US Pacific time (`America/Los_Angeles`) for everyone. That
means today's log, yesterday's 400 club, team daily totals, and double-points
days all use the same shared challenge date even when participants are in
different time zones.

## Run Locally

The app has no build step. Serve the folder with a local web server:

```powershell
py -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Test Mode

Add `?test=1` to the URL:

```text
http://localhost:8000/?test=1
```

Test mode stores participants and progress only in that browser. It does not
read or write Firebase data. The test group starts empty.

## Firebase Setup

1. In Firebase Console, open the separate `october-challenge-2026` project.
2. Register a Web app in Project settings.
3. Copy the Web API key into `firebase-config.js`.
4. Copy your Realtime Database URL into `firebase-config.js`.
5. Enable Authentication -> Sign-in method -> Anonymous.
6. Create a Realtime Database.
7. Publish `database.rules.json` in the new October database Rules tab. This
   file contains October-only rules; do not publish it to September.
8. In Realtime Database -> Data, create `/settingsOctober2026/joinOpen` with Boolean value
   `true`.

Once everyone has joined, set `/settingsOctober2026/joinOpen` to `false`. Existing
participants can keep updating their own entries, but new participant records
will be rejected.

The rules can also be deployed with Firebase CLI:

```powershell
firebase deploy --only database --project october-challenge-2026
```

Live participant data is stored under `/groupChallengeOctober2026/{firebaseUserId}`.

## Invite Participants

After deployment, share the site URL with the join parameter:

```text
https://YOUR-SITE-URL/?join=oct26
```

Each browser/device gets an anonymous Firebase identity. A participant can edit
only the record owned by that identity. Clearing site data creates a new
identity, so participants should not clear browser data during the challenge.

## Privacy Note

The app UI intentionally does not show individual point totals to the group.
Everyone can see:

- who has joined
- who has participated today
- team points for today
- team points for the month
- previous-day 400 club

This is a small-group web app. Authenticated participants can technically read
the shared Firebase data that powers the group totals, but the app does not
present individual scores in the interface. Stronger privacy would require a
server-side aggregation layer such as Cloud Functions.

## Deploy With GitHub Pages

1. Use the separate repository `haagamble/October-challenge-2026`. This
   folder's `origin` points to that repository for both fetch and push. Create
   the empty GitHub repository before the first push; never point this copy
   at `haagamble/group-challenge-2026`.
2. Enable GitHub Pages for the repository's main branch and root folder.
3. Open the published URL and confirm Firebase loads correctly.
4. Visit the invite URL and join from a test device.
5. Confirm that logging activities updates team totals.
6. Install the app on a phone and verify it opens normally.

All files in this folder, including `firebase-config.js`,
`manifest.webmanifest`, `service-worker.js`, `database.rules.json`, and
`icons/`, should be included in the repository.

## October isolation and launch

- The September sibling folder, URL, and records remain the archive.
- October reads and writes only /groupChallengeOctober2026 and reads only
  /settingsOctober2026/joinOpen. The app uses its own `october-challenge-2026` Firebase project.
- Joining defaults to closed when October's setting is absent. Create only
  /settingsOctober2026/joinOpen = true when ready; do not change /settings/joinOpen.
- The invite code is oct26. It is a UI invitation check, not a database secret;
  the existing standalone-app invitation behavior is retained. Database rules
  enforce October's join-open setting and owner-only writes.
- October validates October 1-31, 2026. Day 31 doubles walking; Strength uses October 5, 12, and 28. Other is never doubled. Goals remain 250
  points per scoring day, with one required rest per eligible full week.
  Starting October 9 adds 5,250; October 11 adds 4,750.
- October has independent auth, test, install-dismissal, and celebration keys.
- October's worker cleans up only its own cache namespace and uses only its
  own shell cache. Test mode unregisters only the worker at October's scope.
- September's unchanged worker deletes other caches on its origin at activation.
  For guaranteed offline-cache isolation, host October on a separate origin
  (a different hostname). A sibling path or another GitHub Pages repository on
  the same hostname does not provide that isolation.
- The copied group-fitness-2026-default-rtdb-export.json is a September backup,
  not October seed data. Do not import it into October or overwrite the live root.

These are local file changes only. Firebase rules/settings and website deployment
are separate launch steps; no live data has been changed.

Run the local regression checks with `node verify-october.cjs` from this folder.

## Rest-day launch checks

Publish the October rule changes before launching this version: October entries
now allow `{ "rest": true }`, mutually exclusive with activity fields. Publish only to the October project. Weekly eligibility and automatic
rest are calculated by the client from entries; these are not server-enforced
anti-cheating rules. Automatic rest requires no background job or database write.
Manual Rest can only be selected today and lasts for that day. The weekly
double-points schedule is read-only. Run `node verify-rest.cjs` as well as
`node verify-october.cjs` before release.

Combined activities: existing running and walking selections are merged on load,
with their minutes summed under walking and a shared 100-point base cap. Old
running values remain permitted by the rules for compatibility. Strength uses
the former running double days (October 5, 12, 28). Existing October scores may
therefore recalculate under the new categories and schedule. Publish the updated
October database rules before using Strength. No live records are migrated by
this file update; a participant saves their normalized record on their next edit.

Pull-up type is saved per entry as pullupType (full or modified). Missing types
retain Full scoring. The last successful selection is remembered locally per
participant, project, and test/live mode. Publish the updated October rules
before deploying this version so type selections can be saved.
