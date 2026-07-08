# Agent Context: Legal Risk, Naming, And Third-Party Imports

Read this first for questions about monetization, legal exposure, competitor
similarity, naming, third-party backup imports, or whether a feature looks too
close to another interactive-fiction product.

This file is product and engineering context, not legal advice. The user has
already said they will get real legal guidance. Treat uncertainty as a reason
to route the question to counsel, not as a reason to give a definitive legal
answer.

Keep this file sanitized for repo use. Do not add competitor brand names,
logos, migration tutorials, or comparative marketing copy here unless the user
explicitly asks for that exact public-facing artifact.

## Working Read

- Current non-monetized exposure was discussed as probably low but not zero.
  Lawsuit risk is practical as well as legal: public visibility, revenue,
  userbase size, and direct competitive positioning matter.
- Monetization or a public launch raises the need for counsel review before
  shipping: brand clearance, terms, privacy, subscriptions/refunds, content
  policy, user uploads, takedown process, data deletion/export, and ad/affiliate
  claims if any.
- Similar product ideas and mechanics are not the same thing as copied
  expression. Still, implementation details, UI text, docs, prompts, sample
  content, naming, and import paths should be independently authored and
  visibly distinct.
- Avoid suggesting affiliation with another product. The safer public posture
  is "independent interactive-fiction tooling" rather than "compatible with" or
  "replacement for" a named competitor.

## Decisions To Preserve

- Do not expose or reintroduce third-party backup imports. Supported import
  paths should remain AIST/GitHub save JSON and reusable Reference Card / World
  Block JSON.
- Keep public terminology distinct:
  - Reference Cards: durable triggered or pinned facts.
  - World Blocks: always-on or explicitly configured context.
  - Internal save-compatible keys such as `storyCards` and `components` may
    remain until a planned migration, but visible UI/docs should use the
    current names.
- Do not add competitor-branded import docs, scenario-pack guidance, migration
  marketing, logos, or product comparison claims.
- Do not copy sample scenarios, prompts, docs, UI copy, names, or story content
  from another product. The product should own its own examples and language.
- Preserve prior mitigation context: commit
  `e758f04b386b7be04823ffc24b953e1822d3ef1e` removed third-party import paths
  and renamed the visible memory surfaces.

## Agent Checklist

Before import, naming, docs, scenario-generator, export, or monetization work:

1. Search the touched area for old import and naming drift:

   ```sh
   rg -n "parseAid|aidImport|sourceType.*aid|third-party backup|backup import|Reference Cards|World Blocks|storyCards|components" src docs README.md FEATURES.md AGENTS.md -S
   ```

2. If adding or changing imports, keep unsupported third-party backup formats
   rejected rather than parsed.
3. If changing public UI text or docs, keep Reference Cards and World Blocks as
   the visible names.
4. If adding monetization, public sharing, user uploads, or profile publishing,
   call out that counsel should review the launch surface before release.
5. If a user asks whether something is "safe legally," answer in risk language:
   lower risk, higher risk, unresolved, or counsel-needed. Do not promise that
   the product cannot be sued.

## Source Anchors

- Copyright idea/expression boundary: 17 U.S.C. 102(b) says copyright protection
  does not extend to ideas, procedures, systems, methods of operation, concepts,
  principles, or discoveries:
  https://www.law.cornell.edu/uscode/text/17/102
- Copyright Office Copyright Basics: copyright protects original authorship
  fixed in a tangible medium; ownership and transfer questions can be fact
  specific:
  https://www.copyright.gov/circs/circ01.pdf
- Trademark confusion: USPTO explains that similar marks can create likelihood
  of confusion when customers may think goods or services come from the same
  source:
  https://www.uspto.gov/trademarks/basics/why-search-similar-trademarks
- Trademark scope: USPTO ties trademark protection to specific goods or
  services and related uses:
  https://www.uspto.gov/trademarks/basics/scope-protection
- DMCA agent/takedown readiness for user-upload or user-stored material: U.S.
  Copyright Office DMCA Designated Agent Directory:
  https://www.copyright.gov/dmca-directory/
