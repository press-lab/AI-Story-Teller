# New User Guide

This guide is the high-level path for a tester or new player. It explains what to do first and where to go next. For implementation details, use the advanced docs linked at the end.

## 1. Choose A Runtime

AI Story Teller has two supported modes during the backend rollout.

The deployed app is account-gated. Without a backend session, users see only the welcome/sign-in page.

**Browser Local** is the original storage/runtime setup, but it is now an internal signed-in mode rather than a public no-account entry path. It stores adventures in browser IndexedDB, stores small runtime settings in localStorage, and can still use the existing browser provider settings, import/export, and GitHub save tools after sign-in.

**Local Backend** is the account-backed test setup. For public UAT, the owner runs one shared local server and GitHub Pages points to that server through an HTTPS tunnel/domain. Testers do not install or run the backend. Backend mode adds invite-gated signup, Google or email/password login, backend adventure saves, Profile, Explore, scenario publishing, admin controls, policy gates, and backend-owned model configuration.

Settings -> Runtime is where the backend API URL is visible. In the public UAT build it should already point at the owner-hosted server.

## 2. Create Or Sign Into An Account

Backend accounts require an invite token.

New users can sign up with:

- email and password, followed by email verification in the local test flow
- Google OAuth, when the local backend has Google OAuth configured

After login, the backend session is stored locally in the browser. The backend owns model credentials and platform settings; normal users do not see model routing, background cost controls, LLM evaluation controls, developer test adventures, or backend provider secrets. If no session exists, Library, Explore, Profile, Play, and Browser Local tools are not rendered.

## 3. Use Profile As Your Account Library

Profile is the account-backed library view. It separates reusable scenarios from private adventures.

**Scenarios** are shareable setup packages. They are built from an adventure's reusable setup surfaces: opening scene, World Blocks, Story Cards, Characters, automations, and thumbnail. Published scenarios appear in Explore.

**Adventures** are private playthroughs. They include your transcript, autosaved progress, and live story state. Adventure cards have actions to open, edit, or publish the reusable setup as a scenario.

Publishing a scenario does not publish the private transcript.

## 4. Explore Scenarios

Explore shows built-in premade scenarios and backend-published community scenarios.

Starting a scenario creates a fresh adventure owned by you. The new adventure copies the published scenario setup, not the author's private playthrough.

Important current limitation: user variables are not substituted yet. If a scenario was written around a premade player character, edit the new adventure before continuing play unless you want to use that character as-is.

## 5. Play And Autosave

After opening or starting an adventure, use Dashboard or Play to take turns.

In Browser Local mode, saves go to IndexedDB and the browser provider settings are used.

In Local Backend mode, autosaves go through the local backend and generation goes through the backend provider configuration. Users do not configure backend LLM settings in the frontend.

## 6. Import Existing Material

Backend mode supports import-as-copy for:

- AIST adventure JSON
- AI Dungeon JSON
- GitHub save JSON

Use Settings -> Runtime -> Backend import to paste imported JSON. The imported material becomes a backend adventure copy under the signed-in account.

Browser Local import/export remains available through Import / Export for local adventures.

## 7. Publish Or Share A Scenario

To publish a scenario:

1. Sign into Local Backend mode.
2. Open Profile.
3. Find the source adventure under Adventures.
4. Choose Publish Scenario.
5. Review the new scenario under Scenarios.
6. Published scenarios appear in Explore after backend refresh.

Publishing runs the backend share gate. If the policy engine blocks the scenario text, the scenario is not made public.

## 8. What Admins Control

Admin accounts are marked only by backend configuration or backend data. There is no frontend role-promotion button.

Admins can use Admin Console and admin-only Settings panels to manage platform-wide non-secret defaults, invites, account status, restrictions, safety events, and review queues. Provider API keys and OAuth secrets stay in `.env` or environment variables.

## 9. Where To Read More

- [Owner-Hosted Local Server Deployment](./owner-local-server-deployment.md): how the owner runs the shared local server for non-technical testers.
- [Local Postgres Backend](./postgres-local-development.md): how the owner migrates account-backed UAT data from JSON to Postgres.
- [Local Backend Development](./backend-local-development.md): how to run the API, configure OAuth, prep invites, and test backend mode.
- [Backend Architecture](./backend-architecture.md): why the backend is structured this way and how local/backend modes coexist.
- [Backend Implementation Plan](./backend-implementation-plan.md): implementation status and phase-by-phase backend plan.
- [Building a Scenario](./building-a-scenario.md): practical scenario authoring guidance.
- [Adventure Design](./adventure-design.md): deeper design patterns for durable story setups.
- [AID Best Practices](./aid-best-practices.md): AI Dungeon scenario packaging guidance.
- [Feature Reference](../FEATURES.md): context sections, memory surfaces, and runtime behavior.
