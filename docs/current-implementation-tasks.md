# Current implementation tasks

Last reviewed: 2026-07-11.

This file tracks the work that is not yet complete from the UI, auth, social,
admin, telemetry, and deployment checklist. It is intentionally implementation
facing: future agents should use this as the current backlog before claiming the
app is done.

## Open tasks

### 1. Full desktop and mobile UI/UX audit

Status: incomplete.

The app has received broad visual redesign work and targeted layout tests, but a
true page-by-page desktop and mobile visual pass is not complete. The existing
`scripts/full-ui-visual-audit.mjs` is stale and currently fails on old
navigation assumptions, so it cannot be used as completion evidence until it is
updated.

Required next work:

- Update the full visual audit harness for the current Home/Explore/Story Studio
  navigation.
- Run it for desktop and mobile breakpoints.
- Fix any overflow, overlapping controls, inconsistent spacing, clipped labels,
  or abnormal screenshot artifacts it finds.
- Save the audit output or summarize the exact pages checked.

### 2. Finish design-language application across all named surfaces

Status: partial.

The product shell, Home/Profile, Explore, Story Studio top-level organization,
Docs, and Play have improved substantially, but the design-language pass has not
been proven complete across every named surface.

Still needs verification and likely refinement:

- Play right column content density and language.
- Story Studio deep editing screens.
- Adventure text and action controls.
- Docs information architecture and visual rhythm.
- Settings/account screen spacing and button grouping.
- Navigation label typography and consistency for labels such as Home, Explore,
  and Backups & Transfer.

### 3. Add UX research context, separate from visual design context

Status: incomplete.

`docs/ui-implementation-context.md` contains durable visual/design-language
guidance. A separate UX research supplement has not yet been created.

Required next work:

- Add a UX-focused context file or a clearly separated UX section that covers
  established principles such as task success, wayfinding, progressive
  disclosure, information scent, recognition over recall, onboarding, error
  recovery, and mobile interaction cost.
- Tie recommendations to credible UX practices/theory, not only visual design
  taste.

### 4. Make the left navigation column collapsible

Status: incomplete.

The Play right-side tools panel can be collapsed, but the primary left
navigation column is not yet collapsible.

Required next work:

- Add a persistent collapse/expand control for the product navigation rail on
  desktop.
- Preserve mobile navigation behavior.
- Add regression tests for collapsed state, keyboard access, and active route
  visibility.

### 5. Finish Play right column redesign

Status: partial.

The Play right column is now collapsible, but it still needs a product-level
redesign pass so it reads less like a developer/context menu and more like
story-facing tools.

Required next work:

- Reframe labels and hierarchy around player tasks and story comprehension.
- Reduce dense technical metadata in the default view.
- Keep advanced diagnostics behind explicit disclosure.
- Verify the collapsed state on desktop and mobile.

### 6. Fix Play AI response failure

Status: incomplete and currently user-reported failing.

On the deployed frontend build containing hash `86c31ef`, Play can still show
`The model provider could not complete the request.` This is not complete until
a submitted player action reliably produces a persisted assistant response in
the deployed app.

Required next work:

- Inspect server/provider traces for the failing turn.
- Confirm whether the failure is provider configuration, upstream provider
  status, model name, key/credit/quota, request payload, timeout, policy gate, or
  authentication/session handling.
- Improve the surfaced error so users and admins can distinguish provider
  configuration from temporary upstream failure.
- Prove completion with a live authenticated Play turn that produces an
  AI-generated assistant entry.

### 7. Verify all AI-dependent features

Status: incomplete.

Backend-connected features such as profile loading are not enough. AI-dependent
features still need an authenticated deployed-app verification pass.

Required next work:

- Test Play turn generation.
- Test New Story AI generation.
- Test AI drafting for Reference Cards/Brains/components where exposed.
- Test semantic/background AI behavior if enabled.
- Record which model/provider path was used.

### 8. Resolve scenario deletion authentication failure

Status: unknown/needs verification.

The code includes authenticated scenario deletion paths, but the reported
`Authentication is required` deletion failure has not been proven fixed in the
deployed app.

Required next work:

- Reproduce with the affected signed-in account.
- Confirm whether the failing request lacks the backend session cookie/header,
  targets the wrong scenario owner, or uses stale frontend/API code.
- Fix the exact failing path and add a regression test.

### 9. Verify Reynaud admin access in production

Status: incomplete.

The code supports database-backed admin roles and the Admin Console is visible
to sessions with `user.role === "admin"`. The Reynaud production account still
needs direct verification/promotion in the production database or through an
existing admin path.

Required next work:

- Verify the Reynaud account's `users.role` in production.
- If needed, promote it to `admin` using an existing admin, break-glass key, or
  trusted database repair.
- Log out/in or refresh the session and confirm Admin Console appears.

### 10. Improve sign-out perceived performance

Status: incomplete.

Sign-out works, but the reported lag has not been optimized or measured.

Required next work:

- Instrument sign-out client/server timing.
- Optimistically transition UI where safe.
- Ensure session revocation still happens reliably.
- Add a regression or smoke test for the expected interaction behavior.

### 11. Add profile search

Status: partial.

Public profiles are viewable through profile/scenario flows, and published
scenarios can show owner information. A dedicated people/profile search UI is
not complete.

Required next work:

- Add backend search endpoint or reuse a safe read model for public profiles.
- Add Explore/Profile UI for searching users by display name.
- Show each user's published scenarios from search results.
- Respect profile privacy settings.

### 12. Complete live deployment verification, including Play response

Status: partial.

Commits were pushed and the frontend/backend deployed in prior passes. However,
the final acceptance requirement specifically includes confirming Play returns
AI-generated responses after submitted actions, and that remains incomplete
while the provider error persists.

Required next work:

- Confirm frontend and API build hashes after each deployment.
- Run Render/API readiness checks.
- Use an authenticated production session to submit a Play action.
- Confirm the assistant entry is generated and persisted.

## Completed or substantially completed items

These are listed here to avoid reopening already-finished work unless new bugs
are reported.

- Design-language context exists in `docs/ui-implementation-context.md`.
- Automation and Context Inspector were moved under Story Studio advanced tools
  instead of primary app navigation.
- App/menu branding now uses Story Mode AI in the main product shell.
- Invite-only account creation is implemented; public signup remains disabled
  while valid invite links/codes can create accounts.
- Admin authorization now uses database-backed `users.role`; configured admin
  emails are bootstrap/repair only and do not silently demote stored admins.
- Social graph primitives exist for scenario likes, follows, friend requests,
  accepted friendships, and profile social visibility controls.
- Application performance telemetry is implemented through
  `performanceTraces`, with database retention and Admin Console operations
  views.
- A database data dictionary exists at `docs/database-data-dictionary.md`.
- The app header shows the small build hash next to the dark/light mode button.

