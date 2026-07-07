# Profile-Only Scenario Request Context

Use this file when the user asks to create, update, repair, insert, or remove a scenario **for their profile only**.

## Decision Boundary

Profile-only scenario requests are backend data requests, not premade source-code requests.

Do not edit `src/dev/premadeAdventures.ts`, add a file under `src/dev`, or create a built-in premade unless the user explicitly asks for a built-in/premade scenario available to everyone.

If the user says any of these, treat it as profile-only unless they say otherwise:

- "my profile"
- "for me only"
- "in the database"
- "my scenario"
- "not premades"
- "I want to play it from my profile"

## Product Model

An Adventure is a playable save.

A Scenario is a reusable template. It is not playable by itself until the app forks a scenario revision into a new Adventure.

A complete profile scenario needs:

- `scenarioDrafts`: profile/library metadata
- `scenarioRevisions`: the actual reusable setup payload

If only `scenarioDrafts` exists, Profile can list the scenario but the user cannot start a meaningful adventure from it.

## Preferred API Flow

Use API routes whenever the backend is running and a session is available:

1. Create the profile scenario draft:

   `POST /scenarios`

   Body:

   ```json
   {
     "title": "Scenario Title",
     "description": "Short user-facing description.",
     "sourceAdventureId": "optional-existing-adventure-id"
   }
   ```

2. Create the playable revision:

   `POST /scenarios/:scenarioId/revisions`

   Body:

   ```json
   {
     "title": "Scenario Title",
     "description": "Short revision description.",
     "content": {
       "schemaVersion": 1,
       "title": "Scenario Title",
       "openingScene": "Opening text...",
       "metadata": {},
       "components": [],
       "storyCards": [],
       "brains": [],
       "triggerRules": [],
       "thumbnailImage": null
     }
   }
   ```

3. Start a playable adventure:

   `POST /scenario-revisions/:revisionId/fork`

   The owner can fork their own draft or published revision from Profile. Other users can fork only published revisions.

4. Optional publish:

   `POST /scenario-revisions/:revisionId/publish`

5. Delete from profile:

   `DELETE /scenarios/:scenarioId`

   This removes the draft, its revisions, and related share links. It does not delete private adventures already started from the scenario.

## Direct Postgres Repair

Direct DB writes are a fallback only. Prefer API routes because they run policy checks and preserve app invariants.

The local Postgres backend stores records in `aist_records`:

```text
collection = scenarioDrafts
id = <scenario id>
data.id = <scenario id>
data.ownerUserId = <profile user id>
data.title = <scenario title>
data.description = <short description>
data.sourceAdventureId = <optional source adventure id>
data.createdAt = <ISO timestamp>
data.updatedAt = <ISO timestamp>

collection = scenarioRevisions
id = <revision id>
data.id = <revision id>
data.scenarioId = <scenario id>
data.ownerUserId = <same profile user id>
data.version = 1 or next integer
data.title = <scenario title>
data.description = <short revision description>
data.content = <scenario setup payload>
data.status = draft | published | quarantined
data.createdAt = <ISO timestamp>
data.publishedAt = <ISO timestamp only when status is published>
```

Use `ownerUserId` and `scenarioId`. Do not use `ownerId` or `scenarioDraftId`; those fields are not the app contract.

The revision `content` should contain reusable setup only: `openingScene`, `metadata`, `components`, `storyCards`, `brains`, `triggerRules`, and optional `thumbnailImage`. Do not copy private transcripts or runtime memory unless the user explicitly asks for that export behavior.

## Verification Checklist

After a profile-only scenario change:

1. Confirm `GET /profile/me` lists the scenario under `scenarios`.
2. Confirm the listed scenario has `latestRevision.id`.
3. Confirm `POST /scenario-revisions/:revisionId/fork` creates an Adventure for the same user.
4. Confirm that new Adventure appears under `profile.adventures`.
5. If deleted, confirm `GET /profile/me` no longer lists the scenario.
6. Confirm no new `src/dev` premade files or premade registrations were added.

## User-Facing Explanation

When explaining this to the user, keep the distinction blunt:

- A scenario on Profile is a template.
- An adventure is what they actually play.
- The bridge is `Start Adventure`, which forks a scenario revision into a private adventure.
- Premades are global built-ins and should not be used for profile-only requests.
