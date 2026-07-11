# Current non-functional implementation context

Last reviewed: 2026-07-11.

This file tracks visual design, UX quality, performance, observability,
documentation, branding consistency, and release-verification work from the
current implementation checklist. Product behavior and user/admin capabilities
live in `docs/current-functional-implementation-context.md`.

## Non-functional status table

| Original # | Status | Non-functional task | Notes |
|---|---|---|---|
| 1 | Not complete | Perform full UI/UX pass across every page on desktop and mobile. | Broad improvements exist, but the page-by-page desktop/mobile audit is not proven complete. Existing visual audit script is stale. |
| 2 | Partial | Apply established design language consistently across all named surfaces. | The redesign is partially applied, but Play right column, deep Story Studio screens, Docs, account/settings, action controls, and navigation label typography need verification/refinement. |
| 3 | Partial | Preserve design principles and add separate UX research. | Visual/design context exists. A separate UX research supplement is not done. |
| 5 | Partial | Redesign Play's right column so it does not feel like a developer menu. | The panel is collapsible, but deeper product-language and information-hierarchy redesign remains. |
| 7 | Mostly complete | Replace every app/menu branding instance of AI Story Teller with Story Mode AI. | Main app/menu branding is updated. Some internal/docs/email/save-format strings still say AI Story Teller. |
| 14 | Not complete | Improve sign-out performance so the button does not noticeably lag. | Sign-out works, but perceived performance has not been measured or optimized. |
| 17 | Complete | Add application-performance monitoring in the database. | `performanceTraces` persists diagnostics and appears in Admin Console Operations. Continue using it for investigations. |
| 18 | Complete | Produce complete database data dictionary. | Data dictionary exists at `docs/database-data-dictionary.md`. |
| 19 | Complete | Discuss screenshoted screen design problems before implementation. | Completed as discussion-first work. |
| 20 | Partial | Commit, push, deploy, verify Render, and test deployed app including Play AI responses. | Source now includes a provider-health check to identify key/model/provider failures. Live Play AI response verification must still be performed after this deployment. |

## Open non-functional tasks

### Full desktop and mobile UI/UX audit

Required next work:

- Update `scripts/full-ui-visual-audit.mjs` for the current product navigation,
  Home, Explore, and Story Studio structure.
- Run the audit on desktop and mobile breakpoints.
- Fix overflow, overlapping controls, clipped labels, abnormal spacing, and
  screenshot-level visual defects.
- Save audit results or write a concise evidence summary naming every page
  checked.

### Consistent design-language application

Required next work:

- Verify Play's right column, Story Studio deep editing screens, adventure text
  and action controls, Docs, account/settings, and navigation label typography.
- Reduce console-like density in default player-facing views.
- Keep advanced implementation details behind disclosure.
- Add focused visual/UI regression tests where defects were found.

### UX research supplement

Required next work:

- Add a UX-specific context file or section separate from visual design language.
- Ground recommendations in established UX principles such as wayfinding,
  progressive disclosure, information scent, recognition over recall, task
  success, onboarding, error recovery, and mobile interaction cost.
- Tie future recommendations to these principles explicitly.

### Play right-column product polish

Required next work:

- Reframe labels around player/story tasks rather than implementation objects.
- Move dense diagnostics and raw context details behind explicit advanced
  disclosure.
- Verify collapsed and expanded states on desktop and mobile.

### Branding consistency

Required next work:

- Decide which legacy strings must remain for save-format compatibility.
- Replace remaining user-visible app/menu/email/docs strings that should now say
  Story Mode AI.
- Add a small text-regression test for primary product surfaces if useful.

### Sign-out perceived performance

Required next work:

- Instrument client/server timing for sign-out.
- Use existing performance tracing to identify whether lag is network,
  rendering, session revocation, or state cleanup.
- Optimistically transition the UI where safe while still revoking sessions.

### Release verification

Required next work:

- Confirm frontend hash and API build SHA after each deployment.
- Confirm `/readyz` and `/capabilities`.
- Run Admin Console → Platform Settings → Test Model Provider.
- Use an authenticated production session to submit a Play action.
- Confirm an assistant entry is generated and persisted.

## Completed non-functional items

- Visual/design-language context exists in `docs/ui-implementation-context.md`.
- Application performance telemetry exists in `performanceTraces` and Admin
  Console Operations.
- Database dictionary exists at `docs/database-data-dictionary.md`.
- Screenshoted screen design discussion happened before implementation.
- The app header shows a small build hash beside the dark/light toggle.
