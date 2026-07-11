# Current non-functional implementation context

Last reviewed: 2026-07-11.

This file tracks visual design, UX quality, performance, observability,
documentation, branding consistency, and release-verification work from the
current implementation checklist. Product behavior and user/admin capabilities
live in `docs/current-functional-implementation-context.md`.

## Non-functional status table

| Original # | Status | Non-functional task | Notes |
|---|---|---|---|
| 1 | Complete | Perform full UI/UX pass across every page on desktop and mobile. | The current audit harness exercises 21 desktop/mobile product states and fails on overflow, clipped text, undersized controls, control overlap, and oversized empty cards. The completed run reported zero failing screens. |
| 2 | Complete | Apply established design language consistently across all named surfaces. | A final shared normalization layer now governs type scale, control height, panel radius, content width, and spacing. Play, Story Studio, Docs, account/settings, profile, and navigation surfaces inherit it. |
| 3 | Complete | Preserve design principles and add separate UX research. | Visual implementation guidance remains in `ui-implementation-context.md`; the separate research supplement is `ui-ux-story-mode-ai-ux-ui-research-blueprint.md`. |
| 5 | Complete | Redesign Play's right column so it does not feel like a developer menu. | The collapsible panel is now a Story companion organized by player tasks. Raw token usage is removed from its default view and technical context is labelled as an explanation of what the AI knows. |
| 7 | Complete | Replace every app/menu branding instance of AI Story Teller with Story Mode AI. | Product UI and transactional email copy use Story Mode AI. Legacy save identifiers, compatibility errors, internal provider prompts, repository paths, and historical architecture documents retain technical names where changing them would be misleading or risky. |
| 14 | Complete | Improve sign-out performance so the button does not noticeably lag. | Client state now clears immediately; server revocation continues as a keepalive request and remains covered by request tests and telemetry. |
| 17 | Complete | Add application-performance monitoring in the database. | `performanceTraces` persists diagnostics and appears in Admin Console Operations. Continue using it for investigations. |
| 18 | Complete | Produce complete database data dictionary. | Data dictionary exists at `docs/database-data-dictionary.md`. |
| 19 | Complete | Discuss screenshoted screen design problems before implementation. | Completed as discussion-first work. |
| 20 | In verification | Commit, push, deploy, verify Render, and test deployed app including Play AI responses. | Local implementation and verification are complete. Record the deployed frontend hash, API SHA, health endpoints, provider health result, and authenticated Play result below for each release. |

## Implemented non-functional work

### Full desktop and mobile UI/UX audit

- `scripts/full-ui-visual-audit.mjs` now follows the current Home, Explore,
  Play, Story Studio, History, Backups & Transfer, Settings, Help, and mobile
  More navigation.
- Desktop coverage includes Home, Explore, Play, the Story Studio shell, all
  four primary Studio workspaces, History, Backups & Transfer, Settings, and
  Help.
- Mobile coverage includes Home, Explore, Play, Story Studio, More, History,
  Backups & Transfer, Settings, and Help.
- The 2026-07-11 implementation run checked 21 states and reported zero screens
  with horizontal overflow, protrusions, clipped meaningful text, controls
  below 24px, overlapping controls, or oversized empty cards.

### Consistent design-language application

- `src/design-system-normalization.css` defines the shared spacing, type,
  radius, content-width, and control-height contract after legacy page styles.
- Profile connection empty states no longer reuse full Scenario cards.
- Character inner-state summaries wrap instead of losing meaningful copy.
- Closed creation menus are explicitly removed from layout, preventing hidden
  choices from colliding with adjacent controls.
- Focused Play, Profile, email-branding, and logout request tests cover the
  changed behavior in addition to the full visual audit.

### UX research supplement

- `docs/ui-ux-story-mode-ai-ux-ui-research-blueprint.md` is the dedicated UX
  research and acceptance reference. It covers wayfinding, progressive
  disclosure, information scent, recognition over recall, task success,
  onboarding, recovery, accessibility, and mobile interaction cost.

### Play right-column product polish

- The panel is now labelled **Story companion** and uses task language: Shape
  the story, World & lore, Characters, Memory suggestions, What the AI knows,
  and Open Story Studio.
- Technical usage is absent from the default panel; full inspectability remains
  in What the AI knows and Story Studio.
- Desktop collapse and mobile Story companion access remain tested.

### Branding consistency

- User-visible UI and transactional emails use Story Mode AI.
- Serialized app identifiers, save validation messages, repository paths,
  internal prompts, and historical architecture names remain stable by design.

### Sign-out perceived performance

- Sign-out clears the device session synchronously so navigation is immediate.
- Revocation uses a keepalive request and the existing client request tracing,
  preserving diagnostics without blocking the visible transition.

### Release verification

Release verification checklist:

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
