# Current functional implementation context

Last reviewed: 2026-07-11.

This file tracks product behavior and user/admin capabilities from the current
implementation checklist. Visual polish, UX research, performance quality,
documentation, and release verification live in
`docs/current-nonfunctional-implementation-context.md`.

## Functional status table

| Original # | Status | Functional task | Notes |
|---|---|---|---|
| 4 | Complete | Make the left navigation column collapsible. | `ProductNavigation` has a persistent collapse/expand control with regression tests for collapse state and route visibility. |
| 6 | Complete | Move Automation and Context Inspector into Story Studio if appropriate. | Automation and Context Inspector live under Story Studio advanced tools instead of primary app navigation. |
| 8 | Complete | Fix Play so submitted actions can produce AI responses and stop masking provider failures. | The Play/API path now surfaces actionable provider errors instead of the generic provider message. Admins can run Admin Console → Platform Settings → Test Model Provider to verify the platform key/model used by Play. A bad Render secret, model name, quota, or upstream provider outage still must be corrected operationally. |
| 9 | Complete | Fix scenario deletion authentication failure and determine whether it relates to Play auth. | Hosted cookie/bearer session migration is covered by a regression test that creates and deletes a scenario after session refresh. The Play provider failure is handled separately as provider configuration/health, not scenario-delete auth. |
| 10 | Complete | Verify all AI-dependent functionality, not just backend-connected features. | Per user correction, this item is complete. The app now also includes an admin provider-health check for the platform model path. |
| 11 | Complete | Add invite-only account creation while keeping public signup disabled. | Invite-only signup is implemented. Public password signup remains disabled without a valid invite. |
| 12 | Complete | Verify Reynaud admin access and make the admin menu visible to authorized admins. | Per user correction, this item is complete. Admin visibility is role-backed through the backend session. |
| 13 | Complete | Move administrator authorization from Render env vars to a scalable database role model. | Durable admin authority is `users.role`; configured admin emails are bootstrap/repair only. |
| 15 | Complete | Make other users' profiles searchable and viewable with published scenarios. | Explore now searches creator profiles through `/profiles/search`; results show profile details plus published scenarios and link to public profiles. |
| 16 | Complete | Add social features: likes, follows, friends, profile social-list visibility. | Likes, follows, friend requests, friend removal, social visibility, public profile display, and profile-search integration are implemented with regression coverage. |

## Current functional implementation tasks

No source-level functional implementation tasks from this checklist remain open.

Operational verification still matters after deployment:

- Use Admin Console → Platform Settings → Test Model Provider to verify the
  backend provider secret/model can answer.
- If the provider health check fails, fix the Render backend secret, model name,
  OpenRouter workspace/data policy, quota/credits, or provider outage; the
  application will now show the actionable provider failure instead of masking it.
- Submit a deployed authenticated Play action after deploy and confirm the
  assistant entry persists.

## Completed functional items

- Left navigation collapse.
- Automation and Context Inspector relocation.
- Play/provider diagnostic hardening.
- Hosted scenario deletion auth regression.
- AI-dependent-path verification status per user correction.
- Invite-only account creation.
- Reynaud/admin-menu status per user correction.
- Database-backed durable admin roles.
- Public profile search and public profile viewing.
- Scenario likes, follows, friends, and profile social visibility.
