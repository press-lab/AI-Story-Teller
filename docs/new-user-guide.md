# New User Guide

This guide is the high-level path for a tester or new player. It explains what to do first and where to go next. For implementation details, use the advanced docs linked at the end.

## 1. Create Or Sign Into An Account

Backend accounts require an invite token.

New users can sign up with:

- email and password, followed by email verification in the local test flow
- Google OAuth, when the local backend has Google OAuth configured

After login, the session is stored locally in the browser. The owner-hosted backend owns platform model credentials and platform settings. Normal users do not see model routing, background cost controls, LLM evaluation controls, developer test adventures, or provider secrets. If no session exists, Profile, Explore, Play, and adventure tools are not rendered.

## 2. Use Profile As Your Account Library

Profile is the account-backed home and library view. It contains the new user tutorial, the adventure library, reusable scenarios, and private adventures.

**Scenarios** are shareable setup packages. They are built from an adventure's reusable setup surfaces: opening scene, Plot Components, Story Cards, Characters, automations, and thumbnail. Published scenarios appear in Explore.

**Adventures** are private playthroughs. They include your transcript, autosaved progress, and live story state. Adventure cards have actions to open, edit, duplicate, delete, or publish the reusable setup as a scenario.

Publishing a scenario does not publish the private transcript.

## 3. Explore Scenarios

Explore shows built-in premade scenarios and backend-published community scenarios.

Starting a scenario creates a fresh adventure owned by you. The new adventure copies the published scenario setup, not the author's private playthrough.

Important current limitation: user variables are not substituted yet. If a scenario was written around a premade player character, edit the new adventure before continuing play unless you want to use that character as-is.

## 4. Play And Autosave

After opening or starting an adventure, use Dashboard or Play to take turns.

Autosaves go through the owner-hosted backend. Generation uses the platform model unless the user chooses the personal model source in Settings. Users do not see platform LLM credentials or admin-only evaluation controls.

## 5. Import Existing Material

The app supports import-as-copy for:

- AIST adventure JSON
- AI Dungeon JSON
- GitHub save JSON

Use Profile -> Adventure Library -> New Adventure -> Import from AIST for full AIST backups. AI Dungeon and GitHub JSON imports remain part of the new-adventure/import flow. The imported material becomes an adventure copy under the signed-in account.

## 6. Publish Or Share A Scenario

To publish a scenario:

1. Open Profile.
2. Find the source adventure under Adventures.
3. Choose Publish Scenario.
4. Review the new scenario under Scenarios.
5. Published scenarios appear in Explore after backend refresh.

Publishing runs the backend share gate. If the policy engine blocks the scenario text, the scenario is not made public.

## 7. Settings For Normal Users

Normal Settings are for account sign-out, interface preferences, and choosing whether to use the platform model or a personal model source when that option is available. Admin-only controls live in Admin Console, not Settings.

Normal users should not see platform provider secrets, background cost controls, LLM evaluation controls, developer test adventures, or backend setup fields.

## 8. What Admins Control

Admin accounts are marked only by backend configuration or backend data. There is no frontend role-promotion button.

Admins use Admin Console to manage platform-wide non-secret defaults, invites, account status, restrictions, safety events, and review queues. Provider API keys and OAuth secrets stay in `.env` or environment variables.

## 9. Where To Read More

- [Owner-Hosted Local Server Deployment](./owner-local-server-deployment.md): how the owner runs the shared local server for non-technical testers.
- [Local Postgres Backend](./postgres-local-development.md): how the owner migrates account-backed UAT data from JSON to Postgres.
- [Local Backend Development](./backend-local-development.md): how to run the API, configure OAuth, prep invites, and test backend mode.
- [Backend Architecture](./backend-architecture.md): why the backend is structured this way and how local/backend modes coexist.
- [Backend Implementation Plan](./backend-implementation-plan.md): implementation status and phase-by-phase backend plan.
- [Building a Scenario](./building-a-scenario.md): practical scenario authoring guidance.
- [Adventure Design](./adventure-design.md): deeper design patterns for durable story setups.
- [AID Best Practices](./aid-best-practices.md): AI Dungeon scenario packaging guidance.
- [Feature Reference](../FEATURES.md): context sections, memory surfaces, and generation behavior.
