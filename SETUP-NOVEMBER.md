# November launch — Firebase Spark, GitHub Actions, no Cloud Functions

The implementation is prepared locally. Nothing has been pushed, deployed, or
configured in your Google/GitHub accounts by this work. Keep the existing project,
website address, manifest ID, and browser authentication key. No reinstall or
participant-ID migration is needed.

## 1. Back up October

Export the root of Realtime Database as JSON and save it outside this repository.
Keep the current committed October version as the rollback reference. Do not
import a backup at the database root as part of this launch.

## 2. Try the no-key Google/GitHub connection

Open Google Cloud Console with the same account that owns Firebase and select
the existing project **october-challenge-2026**. Open Cloud Shell, upload
`setup-github-oidc.sh`, and run:

```bash
bash setup-github-oidc.sh
```

The script creates a dedicated service account and restricts trust to this
repository's numeric owner/repository IDs, `main`, this scheduling workflow, and
manual/scheduled events. It creates no private keys and never links or enables a
billing account. Its custom role grants only existing-database read/write
permissions, not project ownership or database creation/deletion. Those data
permissions can access the whole database, so protect `main` and this workflow.
The scheduler code only writes November settings and November private schedules.

**No-billing checkpoint:** Google's current federation setup guide lists billing
as a prerequisite, although the IAM API itself has no charge. I cannot verify
your account's eligibility locally. If the console or script requires billing,
**stop and return to the chat; do not upgrade to Blaze or add a card**. The app's
Spark design does not depend on Cloud Functions. We can use a GitHub secret or a
manual local scheduling step if federation is unavailable without billing.

The final output gives two non-secret values. In GitHub repository Settings →
Secrets and variables → Actions → **Variables**, add:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SCHEDULER_SERVICE_ACCOUNT`

Do not put credentials in `firebase-config.js`; it contains only public Firebase
web configuration. This setup script has not been executed against your account.

## 3. Publish the database rules and open November joining

After backing up, open Firebase Console → Realtime Database → Rules. Replace the
rules with the complete contents of `database.rules.json` and publish.

The rules preserve October's paths, allow October edits until **November 1,
2026 at 00:00 Pacific** (07:00 UTC), then make October read-only. November has
separate paths. Returning status and joining timestamps are checked by Firebase;
members cannot rewrite those fields. Activity writes are restricted to their
owner and the current Pacific date. Private assignments cannot be listed or
read by other participants. Claims and anonymous team bonuses must update
atomically. Honesty-based scoring/rest choices retain the app's existing model.

In the **Data** tab, add only this new child (do not import over the root):

```text
settingsNovember2026
  joinOpen: true        ← a Boolean, not the text "true"
```

Leave all October data, settings, cheerleader schedules, and identities intact.

CLI alternative for rules, if already signed in:

```powershell
npx.cmd firebase deploy --only database --project october-challenge-2026
```

Do not deploy functions, initialize a different project, or change billing.

## 4. Review and publish the app

Run `node verify-all.cjs`. Run `npm.cmd run test:emulator` for the actual Firebase
rules engine (requires `npm.cmd install` and Java 21; the helper also finds the
temporary Java runtime downloaded in this session). Emulators use only the demo
project `demo-group-fit` on loopback ports; never your production database.

Use `node preview.cjs` and the test URLs in README to review November. Test a new
participant, a returning participant, opt-out, and private dates. When ready,
commit and push using your normal GitHub Pages publishing process. Version 25
and cache v25 deliver the update to existing installations. This repository's
website address must stay the same.

The first published version still opens October until the Pacific boundary.
Existing members can follow **Join November** to opt in early. After the boundary,
the app opens November and October is under **Past challenges**. No grace period.

## 5. Confirm GitHub's temporary access

On GitHub → Actions → **Monthly cheerleaders** → Run workflow, select `main`
and mode **check**. This verifies authentication/read access without changing data.
The job logs no participant names, dates, access tokens, or roster contents.

The optional `initialize` mode creates November's join-open setting only if it
does not exist; you can skip this if you added the Boolean in Firebase Console.
It never changes an existing setting, October data, or any participant's record.

The scheduled `generate` job runs at **00:17 Pacific on November 2, 2026**, with
retries on November 3–7. GitHub may delay scheduled jobs. You can run `generate`
manually after the cutoff if needed; before the cutoff it safely does nothing.
No one needs to open the app to trigger generation.

Eligibility closes at **midnight Pacific starting November 2** (08:00 UTC,
after the daylight-saving change), using each member's immutable Firebase joining
timestamp and opt-in choice. Assignments cover November 2–30. Saving is conditional
on a Firebase ETag: simultaneous/repeated jobs cannot replace the saved schedule
or erase claims. An empty eligible roster produces a fixed empty schedule.

## What this version covers

October and November 2026 are configured. November repeats October's first 30
double-points activities. December will need a configuration/rules update at the
same app address, not a new installation. Existing device-linked identity remains;
switching phones still needs organizer assistance until proper sign-in is added.

## Sources

- [Firebase OAuth authentication](https://firebase.google.com/docs/database/rest/auth)
- [Google federation setup and prerequisites](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Google IAM pricing](https://cloud.google.com/iam/pricing)
- [GitHub Actions pricing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Google's GitHub authentication action](https://github.com/google-github-actions/auth)
