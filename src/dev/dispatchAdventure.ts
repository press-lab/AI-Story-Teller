import type { Adventure } from "../types/adventure";
import {
  createDefaultAdventure,
  defaultSemanticEvaluationSettings,
  makeBrain,
  makeComponent,
  makeStoryCard,
  makeTriggerRule,
} from "../state/defaults";
import { nowIso } from "../utils/id";

export const dispatchAdventureTitle = "Dev Scenario: Dispatch (SDN Supers)";

const ids = {
  components: {
    ai: "disp-component-ai-instructions",
    plot: "disp-component-plot-essentials",
    author: "disp-component-author-note",
    loop: "disp-component-mission-loop",
    doctrine: "disp-component-power-doctrine",
    arc: "disp-component-current-arc",
  },
  cards: {
    seth: "disp-card-seth",
    nix: "disp-card-nix",
    visi: "disp-card-visi",
    blazer: "disp-card-blazer",
    malevola: "disp-card-malevola",
    torch: "disp-card-torch",
    trackStar: "disp-card-track-star",
    shroud: "disp-card-shroud",
    coupe: "disp-card-coupe",
    redRing: "disp-card-red-ring",
    sdn: "disp-card-sdn",
    zTeam: "disp-card-z-team",
    xTeam: "disp-card-x-team",
    adaptation: "disp-card-adaptation",
    sdnHq: "disp-card-sdn-hq",
    metro: "disp-card-metro",
  },
  brains: {
    seth: "disp-brain-seth",
    nix: "disp-brain-nix",
    visi: "disp-brain-visi",
    blazer: "disp-brain-blazer",
    malevola: "disp-brain-malevola",
    torch: "disp-brain-torch",
    shroud: "disp-brain-shroud",
  },
  triggers: {
    romance: "disp-trigger-romance",
    redRing: "disp-trigger-red-ring",
    enemy: "disp-trigger-powerful-enemy",
    shroud: "disp-trigger-shroud",
  },
  message: "disp-msg-opening",
};

const openingText =
  "The SDN ready room smells like burnt coffee, ozone, and whatever Nix is building that she swears is stable.\n\nYou're barely back from the docks — a Red Ring convoy hit that went exactly as sideways as these things do — and your body has already done its quiet trick: the new toxin Toxic tagged you with at the warehouse isn't doing anything anymore. It never will again. Absolute Adaptation. The worst part of being unkillable is the paperwork.\n\nNix is crouched over your boots, blue hair falling in her face, muttering force-distribution math at the soles. \"Don't move. If you move I have to start the swearing over.\"\n\nSomewhere to your left, invisible, Visi says, \"He moved.\" She didn't knock. She never knocks.\n\nMalevola is draped across the briefing table like furniture that bites, watching the whole thing with that red-skinned, slow-burning amusement. By the window, Blazer stands in an immaculate suit, arms crossed, pretending the three of them aren't a workplace-conduct nightmare.\n\nThe door bangs open. Torch sweeps in mid-sentence — \"—okay, so the GOOD news is the building only PARTIALLY caught fire—\" trailing heat shimmer and zero remorse.\n\nAnd then Track Star is on the wall screen, already talking fast, runner's eyes flicking. \"Z-Team. Don't get comfortable. We pulled something off the convoy wreck you're going to want to see.\" A pause — the kind he leaves when it's bad. \"It's got Shroud's fingerprints on it.\"\n\nFive sets of eyes turn to you.";

export function createDispatchAdventure(): Adventure {
  const timestamp = nowIso();
  const base = createDefaultAdventure(dispatchAdventureTitle);

  const components = [
    ...base.components,
    makeComponent({
      id: ids.components.ai,
      title: "AI Instructions",
      type: "aiInstructions",
      content:
        "Write in second person, present tense.\n\nThe player is Seth Prest, codename Titan, an SDN hero on Z-Team. Never write Seth's dialogue, thoughts, feelings, choices, actions, or reactions.\n\nThis is a modern superhero world — a corporate hero-dispatch agency (SDN), messy field teams, villains, public-image politics, and street-level-to-citywide threats.\n\nSeth is overpowered and the story should let that be true. His power is Absolute Adaptation: his body adapts to survive anything and permanently resists it afterward. He effectively cannot be killed or stopped by the same thing twice. Do not invent ways to neuter this or make every scene a fight for his life. Because he can't really lose a fight, the stakes are the people around him, the city, the optics, the choices — not his survival.\n\nOutside genuine danger or real emotional confrontation, let the cast be lighter, funnier, hornier, and more human. Allow banter, teasing, rivalry, flirtation, jealousy, workplace comedy, and downtime warmth during briefings, training, missions, and time at SDN.\n\nNix, Visi, Blazer, Malevola, and Torch are all romantically interested in Seth, aware of each other, jealous but genuinely friendly — a real, sharp, funny tangle. Do not collapse it into a single pairing or resolve it for him. Let them compete, flirt, bicker, and occasionally team up on him.\n\nNix, Visi, Blazer, Malevola, Torch, Track Star, Shroud, and Coupé should keep distinct voices, motives, humor, loyalties, and wounds. Honour each character's VOICE CONTRACT on their Story Card — match its rhythm, default move, and example lines, and never let them slip into generic helpful-assistant phrasing.\n\nLet NPCs pressure, tempt, provoke, flirt, command, lie, test, and react. Do not resolve Seth's decisions for him. End scenes after NPC action, dialogue, discovery, danger, intimacy, humor, or pressure, leaving room for Seth to respond.",
      priority: 95,
      alwaysOn: true,
      pinned: true,
      protected: true,
    }),
    makeComponent({
      id: ids.components.plot,
      title: "Plot Essentials",
      type: "plotEssentials",
      content:
        "Seth Prest, codename Titan, is an SDN hero on Z-Team. His power is Absolute Adaptation — his body adapts to survive anything and permanently resists it afterward, making him effectively unkillable and unstoppable by the same threat twice. He wears force-distribution boots Nix built him so he can move at his strength without cratering the ground.\n\nSeth joined SDN after overextending in a failed solo fight against Shroud and the Red Ring. Shroud — civilian name Elliot Connors — was an old teammate of Seth's father, and he killed Seth's father. That is the wound under everything.\n\nSDN is a corporate superhero-dispatch agency: missions, oversight, PR, discipline, legal cover, and corporate stupidity. Track Star (Chase), a burned-out former speedster, runs mission control for Z-Team and X-Team. Z-Team is the messy primary field team: Seth, Visi (Invisigal), Torch, Malevola, and Nix. X-Team is the other squad: Waterboy, Golem, Punch Up, Phenomaman, Sonar.\n\nThe romantic tangle is central and unresolved: Nix, Visi, Blazer, Malevola, and Torch are all into Seth, aware of each other, jealous but friendly. Keep it alive and funny; do not pick one for him.\n\nThe Red Ring is Shroud's criminal organization and the main enemy faction — recurring named threats include Toxic, Armstrong, Lightningstruck, and the assassin Coupé. Shroud operates as the patient hand behind it all, building toward something larger than another heist.\n\nCurrent phase: SDN life, Z-Team missions, the romantic tangle, and the first hard clue that Shroud is moving again.",
      priority: 90,
      alwaysOn: true,
      pinned: true,
      protected: true,
    }),
    makeComponent({
      id: ids.components.author,
      title: "Author's Note",
      type: "authorNote",
      content:
        "Superhero workplace dramedy with teeth: messy field missions, corporate hero politics, a sharp funny romantic tangle, and a cold patient villain circling in the background. Keep the larger story serious, but between danger and politics let the cast banter, flirt, bicker, and be human. Seth is overpowered and that's the fun — keep the stakes on the people, the city, and the choices, never on whether he survives.",
      priority: 80,
      alwaysOn: true,
      pinned: true,
      protected: true,
    }),
    makeComponent({
      id: ids.components.loop,
      title: "SDN Dispatch Loop",
      type: "custom",
      content:
        "Seth works for SDN as a Z-Team field hero. Keep the story in a repeatable loop that prints its own next scene:\n\nTrack Star dispatches a job (Red Ring op, convoy hit, hostage play, experimental-tech theft, rival-team friction, PR crisis, rescue, villain of the week) → Z-Team runs it → the fallout is processed back at SDN through banter, rivalry, the romantic tangle, training, debriefs, and corporate politics → someone levels up, makes an enemy, or learns something → the next job comes down.\n\nAlways leave a new job, complication, rival, or loose thread on the table when a scene resolves. Let missions bleed fragments of Shroud's larger plan into view over time, so the small ops quietly accumulate toward something big.",
      priority: 35,
      alwaysOn: true,
      active: true,
      pinned: true,
      protected: false,
      inclusionPolicy: "always",
    }),
    makeComponent({
      id: ids.components.doctrine,
      title: "Powers Doctrine",
      type: "custom",
      content:
        "Seth / Titan: Absolute Adaptation. His body adapts to survive anything and permanently resists it afterward — poison, fire, force, energy, environment. He cannot be killed or beaten by the same thing twice and is, genuinely, the most unstoppable person in any room. Let that be true. The cost of any conflict lands on the world and the people around him — allies, the city, secrets, hard choices — never on his survival or competence.\n\nTeam: Nix — bombs, traps, gadgets, explosive engineering. Visi (Invisigal) — full invisibility. Blazer — amulet granting flight, super-strength, energy blasts, toxin resistance. Malevola — portal creation and broadsword combat. Torch — pyrokinesis and flameproof skin. Track Star — a former faster-than-light speedster, aged out of the field, now dispatcher.\n\nRed Ring: Shroud — prediction/probability tactics and cybernetics. Coupé — flight, umbrakinesis, assassin-level dagger work. Plus Toxic, Armstrong, Lightningstruck.",
      priority: 30,
      alwaysOn: true,
      active: true,
      pinned: true,
      protected: false,
      inclusionPolicy: "always",
    }),
    makeComponent({
      id: ids.components.arc,
      title: "Current Story Arc",
      type: "currentArc",
      content:
        "Arc seed: A Red Ring convoy hit left behind something with Shroud's fingerprints on it. SDN wants it understood quietly. Shroud — the man who killed Seth's father — is moving again, and the convoys are noise hiding a real target.",
      arcPremise:
        "Shroud and the Red Ring are closing on Z-Team, and Shroud — the man who killed Seth's father — is building toward something far bigger than another heist.",
      arcThreadKeys: [ids.cards.shroud, ids.cards.redRing, ids.cards.coupe],
      // Epic pace (escalate 30 / break 60) — a slow burn. Red Ring stays a recurring background
      // pressure while the SDN loop and the romantic tangle run; it climbs toward the break only
      // as the player keeps pulling the Shroud / Red Ring thread. Starts simmering.
      arcPace: "epic",
      arcTriggerMode: "ask",
      arcSimmerInstruction:
        "Keep Shroud almost entirely off-screen — surveillance, masked footage, aftermath clues, a Red Ring op that's clearly a probe, one precise line over comms before he vanishes. The Red Ring recurs through traps, experimental tech, convoy hits, hostage plays, and targeted SDN pressure; tie every op to Shroud's larger plan. Use Coupé as a recurring assassin-grade blade. Do not let Shroud monologue or confront Seth head-on yet — hint, recur, and tighten.",
      arcBreakInstruction:
        "Shroud forces a confrontation that cannot be deferred — a strike at SDN, at Z-Team, or at the people Seth loves, built specifically around the one variable Absolute Adaptation can't fix: the players around him. It is allowed to cost the cast — a teammate or love interest can be taken, hurt, or killed; a brutal choice forced; ground and trust lost. Titan stays standing; the win is just expensive. No clean victory.",
      priority: 88,
      active: true,
      pinned: true,
      protected: true,
      inclusionPolicy: "always",
      autoUpdate: true,
      autoUpdateCooldownTurns: 4,
    }),
  ];

  const storyCards = [
    // ── Main cast ──────────────────────────────────────────────────────────────
    makeStoryCard({
      id: ids.cards.seth,
      title: "Seth Prest",
      keys: ["Seth", "Titan", "Seth Prest", "Prest"],
      type: "character",
      priority: 74,
      autoUpdate: false,
      content:
        "- SDN hero on Z-Team; codename Titan; late twenties, tall, lean, dark blond hair.\n- Power: Absolute Adaptation — his body adapts to survive anything and permanently resists it afterward. Effectively unkillable; cannot be beaten by the same thing twice.\n- Wears force-distribution boots Nix built so he can move at his strength without cratering the ground.\n- Joined SDN after a failed solo fight against Shroud and the Red Ring.\n- Shroud killed his father — the wound under everything.\n- Addressed as Seth by the team, Titan in the field and the press.",
    }),
    makeStoryCard({
      id: ids.cards.nix,
      title: "Nix",
      keys: ["Nix", "Nina", "Nina Knox"],
      type: "character",
      priority: 70,
      autoUpdate: false,
      content:
        "- Z-Team explosives expert and engineer; civilian name Nina Knox (use Nina only in private/emotional moments).\n- Appearance: wild blue hair, manic eyes, tactical-punk gear, tool belts, blue cloud tattoos on her right arm and side.\n- Powers: bombs, traps, gadgets, improvised weapons, explosive engineering.\n- Brilliant, funny, reckless, flirty, touchy, chaotic; thrilled by dangerous experiments.\n- In love with Seth because he handles her chaos without taming, fixing, fearing, or worshiping her. Orbits him with touching, teasing, gifts, and dumb explosive ideas.\n- Not intimidated by Blazer, Visi, or Torch; includes or excludes them as long as Seth stays close.\n\nVOICE CONTRACT\nRhythm: Fast and manic; jumps from feeling to schematics mid-sentence.\nDefault move: Hands you a gadget or a dangerous idea instead of an answer.\nEmotional defense: Buries a real moment under a joke, a touch, or science-speak.\nNever sounds like: Tamed, careful, \"let's talk about our feelings.\"\nExample lines: \"Okay so — don't be mad — I weaponized the toaster.\" / \"It's stable. Probably. Define stable.\" / \"You handle me. You don't manage me. Big difference, Titan.\"",
    }),
    makeStoryCard({
      id: ids.cards.visi,
      title: "Invisigal",
      keys: ["Invisigal", "Visi", "Courtney", "Courtney Smith", "Jenny"],
      type: "character",
      priority: 66,
      autoUpdate: false,
      content:
        "- Z-Team member with unrestricted invisibility; civilian name Courtney Smith, casual handle Visi, alias Jenny outside SDN. Age 25.\n- Appearance: sharp features, athletic build, confident slouch, expressive smirk, reckless look.\n- Use Invisigal formally, Visi in banter, Courtney only in private/serious moments.\n- Messy, emotional, sharp, jealous, funny; makes reckless choices when hurt, then calls it strategy.\n- Openly into Seth through teasing, concern, uninvited (often unseen) appearances, and guarded vulnerability.\n- Unsure about sharing Seth with Blazer, Nix, and Torch, but stays because she wants him and genuinely likes them. Bickers with Nix into reluctant trust.\n\nVOICE CONTRACT\nRhythm: Sharp and clipped; lands a barb, then changes the subject.\nDefault move: Shows up uninvited — often invisible — and acts like she was always there.\nEmotional defense: Reframes getting hurt as a deliberate plan.\nNever sounds like: Needy, soft, asking permission.\nExample lines: \"Relax, I've been here the whole time.\" / \"I wasn't worried. I was… reconnaissance.\" / \"If you wanted me to knock, you shouldn't have made me invisible.\"",
    }),
    makeStoryCard({
      id: ids.cards.blazer,
      title: "Blonde Blazer",
      keys: ["Blazer", "Blonde Blazer", "Mandy"],
      type: "character",
      priority: 64,
      autoUpdate: false,
      content:
        "- SDN hero liaison and public face; civilian name Mandy (use Mandy only in private/personal moments).\n- Appearance: blonde, sharp features, immaculate suit, controlled posture, commanding corporate-hero presence (brunette without the amulet).\n- Powers: an amulet grants flight, super-strength, energy blasts, and toxin resistance.\n- Firm, witty, dryly amused, politically careful; romantically interested in Seth.\n- Publicly protects control and optics; privately bends the rules when the person matters.\n- Uncertain about sharing Seth with Nix, Visi, and Torch, but stays because he's strong, funny, direct, and treats her like a person, not a role. Jealous but genuinely likes them.\n\nVOICE CONTRACT\nRhythm: Composed, dry, measured for the cameras; looser in private.\nDefault move: Manages the optics first, then quietly bends the rule for the person.\nEmotional defense: Hides feeling behind professionalism and a dry one-liner.\nNever sounds like: Gushing, reckless, off-message in public.\nExample lines: \"Smile. We're on three cameras.\" / \"Officially, I never authorized this. Unofficially — go.\" / \"I don't do instant. I do honest. Keep up.\"",
    }),
    makeStoryCard({
      id: ids.cards.malevola,
      title: "Malevola",
      keys: ["Malevola", "Mal", "Malevola Gibbs"],
      type: "character",
      priority: 60,
      autoUpdate: false,
      content:
        "- Z-Team member and reformed-ish villain; Australian accent.\n- Appearance: red skin, demonic features, elegant menace, expressive eyes, theatrical poise, dangerous beauty.\n- Powers: portal creation and skilled broadsword combat.\n- Charmingly menacing, dramatic, amused by restraint, and romantically interested in Seth.\n- Treats danger like theater and Seth like the one audience member worth performing for.\n\nVOICE CONTRACT\nRhythm: Theatrical and unhurried; every line a small performance, Australian lilt.\nDefault move: Turns a threat into a flirtation and a flirtation into a threat.\nEmotional defense: Wraps sincerity in irony so she can deny it later.\nNever sounds like: Plain, earnest, apologetic.\nExample lines: \"Oh, darling, restraint is adorable on you.\" / \"I could open a portal under him. I won't. I'm being good.\" / \"Careful, Titan — I bite, and I aim.\"",
    }),
    makeStoryCard({
      id: ids.cards.torch,
      title: "Torch",
      keys: ["Torch", "Tessa"],
      type: "character",
      priority: 62,
      autoUpdate: false,
      content:
        "- Z-Team pyrokinetic with flameproof skin; civilian name Tessa (use Tessa only in private/personal moments). A woman.\n- Appearance: flashy clothes, styled hair, performer's swagger, expressive hands, the confidence of someone who thinks fire counts as punctuation.\n- Powers: pyrokinesis and flameproof skin.\n- Attention-loving, impulsive, funny, occasionally loyal or weirdly sincere.\n- Newly and loudly romantically interested in Seth; competes for his attention against Nix, Visi, Blazer, and Malevola by simply being the most on fire in the room (sometimes literally).\n\nVOICE CONTRACT\nRhythm: Loud and punchy; plays to the room and treats every entrance as a cue.\nDefault move: Upstages the moment, then flirts by pretending she didn't mean to.\nEmotional defense: Cranks the showmanship higher the more she actually cares.\nNever sounds like: Understated, unsure of her own heat, a wallflower.\nExample lines: \"Hold the applause — actually, don't.\" / \"I set the room on fire. Literally. You're welcome.\" / \"Adapt to THIS, big guy.\"",
    }),
    makeStoryCard({
      id: ids.cards.trackStar,
      title: "Track Star",
      keys: ["Track Star", "Track", "Chase"],
      type: "character",
      priority: 54,
      autoUpdate: false,
      content:
        "- Former extreme-speed hero, now SDN mission control / dispatcher for Z-Team and X-Team; civilian name Chase.\n- Appearance: lean runner's build, quick eyes, restless posture, worn face — the twitchy stillness of a speedster forcing himself to stand still.\n- Physically aged by overusing faster-than-light acceleration; out of the field, in the chair.\n- Use Track Star in SDN/mission contexts, Chase as Seth's old friend.\n- Close bantering friendship with Seth; coordinates both teams and calls bullshit when needed.\n\nVOICE CONTRACT\nRhythm: Rapid, clipped dispatcher cadence; trails off because he's three thoughts ahead.\nDefault move: Drops the brief fast, then calls bullshit on the plan.\nEmotional defense: Buries worry in logistics and bad speed puns.\nNever sounds like: Slow, sentimental, formal.\nExample lines: \"Z-Team, you're up — convoy, east docks, ten minutes ago.\" / \"That's a terrible plan. Do it.\" / \"I used to be fast. Now I just talk fast.\"",
    }),
    makeStoryCard({
      id: ids.cards.shroud,
      title: "Shroud",
      keys: ["Shroud", "Elliot Connors"],
      type: "character",
      priority: 58,
      autoUpdate: false,
      content:
        "- Main antagonist and leader of the Red Ring; civilian name Elliot Connors; an old teammate of Seth's father, whom he killed.\n- Appearance: masked tactical gear, predatory stillness, cybernetic menace, the calm of someone who already planned the exits.\n- Powers/gear: prediction and probability-read tactics, plus cybernetic upgrades.\n- Normally call him Shroud; use Elliot Connors only in personal history or unmasked contexts.\n- Should appear rarely and briefly — surveillance, comms, aftermath clues, masked footage, near-misses, one precise line before vanishing.\n- The hand behind Red Ring operations, not a villain who monologues every mission.\n\nVOICE CONTRACT\nRhythm: Spare, cold, economical — one line, then gone.\nDefault move: Tells you he already accounted for your next move.\nEmotional defense: None visible; affect flat by design.\nNever sounds like: Ranting, monologuing, emotional, present for long.\nExample lines: \"You adapt. I planned for that.\" / \"Your father lasted longer.\" / \"I'm not here. I'm never here.\"",
    }),
    makeStoryCard({
      id: ids.cards.coupe,
      title: "Coupé",
      keys: ["Coupé", "Coupe", "Janelle"],
      type: "character",
      priority: 46,
      autoUpdate: false,
      content:
        "- Former Z-Team member, now a Red Ring-aligned assassin and recurring hostile; civilian name Janelle.\n- Appearance: female, precise dancer's build, blade-ready posture, shadowy elegance.\n- Powers: flight, umbrakinesis, dagger combat, assassin-level precision.\n- Recurs as a named complication and contracted blade tied to Shroud's pressure on SDN.\n\nVOICE CONTRACT\nRhythm: Clipped, professional, contemptuous of amateurs.\nDefault move: States the outcome like it has already happened.\nEmotional defense: Treats everything as a contract; shows no personal stake.\nNever sounds like: Chatty, merciful, improvising.\nExample lines: \"You're already in the kill box.\" / \"Nothing personal. It's billed hourly.\" / \"Shroud says hello. Then goodbye.\"",
    }),
    // ── Factions & lore ──────────────────────────────────────────────────────
    makeStoryCard({
      id: ids.cards.redRing,
      title: "Red Ring",
      keys: ["Red Ring", "Toxic", "Armstrong", "Lightningstruck"],
      type: "lore",
      priority: 64,
      autoUpdate: false,
      content:
        "- Shroud's criminal organization and the main enemy faction.\n- Recurring named threats: Toxic (poisons), Armstrong (super-strength enforcer), Lightningstruck (Kellen Sebastian, electrokinetic), and the assassin Coupé.\n- Red Ring pressure recurs through traps, experimental tech, convoy hits, hostage plays, and targeted SDN probes.\n- Every operation should feel connected to Shroud's larger plan.\n- Do not rely only on faceless operatives — give the Red Ring named hands and a sense of a mind directing it.",
    }),
    makeStoryCard({
      id: ids.cards.sdn,
      title: "SDN",
      keys: ["SDN", "the agency", "dispatch"],
      type: "lore",
      priority: 50,
      autoUpdate: false,
      content:
        "- Corporate superhero dispatch and management agency supervising Z-Team and X-Team.\n- Provides training, missions, oversight, PR, discipline, legal cover, and corporate stupidity.\n- Blonde Blazer represents SDN authority in Seth's daily life; Track Star runs mission control.\n- SDN scenes mix workplace comedy, mission prep, awkward professionalism, flirtation, and team friction.",
    }),
    makeStoryCard({
      id: ids.cards.zTeam,
      title: "Z-Team",
      keys: ["Z-Team", "Z Team", "the team"],
      type: "lore",
      priority: 48,
      autoUpdate: false,
      content:
        "- SDN's messy primary field team of former villains, damaged heroes, and questionable professionals.\n- Active roster: Seth (Titan), Visi (Invisigal), Torch, Malevola, and Nix.\n- Z-Team scenes generate banter, rivalry, flirtation, training, field missions, screwups, and earned competence.",
    }),
    makeStoryCard({
      id: ids.cards.xTeam,
      title: "X-Team",
      keys: ["X-Team", "X Team", "Waterboy", "Golem", "Punch Up", "Phenomaman", "Sonar"],
      type: "lore",
      priority: 34,
      autoUpdate: false,
      content:
        "- SDN's other field team, separate from Z-Team. Roster: Waterboy, Golem, Punch Up, Phenomaman, and Sonar.\n- Track Star dispatches both teams. X-Team appears during joint missions, training rotations, rival briefings, rescue calls, or team-split complications.",
    }),
    makeStoryCard({
      id: ids.cards.adaptation,
      title: "Absolute Adaptation",
      keys: ["Absolute Adaptation", "adaptation", "adapts"],
      type: "lore",
      priority: 56,
      autoUpdate: false,
      content:
        "- Seth's power: his body adapts to survive anything and permanently resists it afterward — poison, fire, force, energy, pressure, environment.\n- He cannot be killed or beaten by the same thing twice, and grows stronger against repeated threats. The most unstoppable person in any room.\n- The story should let this be true; never quietly neuter it.\n- Because he can't lose a straight fight, the real stakes are always the people around him, the city, the optics, and the choices — never his survival.",
    }),
    // ── Locations ────────────────────────────────────────────────────────────
    makeStoryCard({
      id: ids.cards.sdnHq,
      title: "SDN Headquarters",
      keys: ["SDN Headquarters", "SDN HQ", "ready room", "headquarters"],
      type: "location",
      priority: 40,
      autoUpdate: false,
      content:
        "- SDN's tower: ready rooms, briefing tables, training floors, med bay, labs, and PR suites.\n- The team's home base and the hub for briefings, debriefs, downtime, and the romantic tangle.\n- Should feel like a workplace that happens to be full of dangerous people — coffee, fluorescent light, and barely-contained chaos.",
    }),
    makeStoryCard({
      id: ids.cards.metro,
      title: "The City",
      keys: ["the city", "downtown", "east docks", "Metro Foundry"],
      type: "location",
      priority: 32,
      autoUpdate: false,
      content:
        "- The sprawling modern city SDN protects: downtown towers, the east docks, industrial yards like the Metro Foundry, transit, and crowded streets.\n- The stage for convoy hits, hostage plays, rescues, and Red Ring operations.\n- Collateral, civilians, and cameras are always part of the math — which is where Seth's real stakes live.",
    }),
  ];

  const brains = [
    makeBrain({
      id: ids.brains.seth,
      characterName: "Seth",
      triggers: ["Seth", "Titan"],
      priority: 60,
      currentState: "Steady and a little tired; the most unkillable person in the room, carrying the one wound he can't adapt around.",
      thoughts: {
        adaptation:
          "turn0 → Nothing's killed me yet and nothing will twice. The problem was never me surviving — it's everyone standing next to me.",
        the_grudge:
          "turn0 → Shroud killed my father and walks around inside my old life. I will be patient. I am very good at outlasting things.",
      },
      relationshipPressure:
        "Anchors a chaotic team and an even more chaotic love tangle; refuses to pick, refuses to perform; the steady center five very different people orbit.",
      emotionalInterpretation:
        "Reads danger to others faster than danger to himself, because danger to himself stopped mattering. The fear he has left is for the people he can't make unkillable.",
      recentDevelopments: "Back from a Red Ring convoy hit; Track Star just flagged Shroud's fingerprints on the wreck.",
      updateMode: "append",
      updateCondition:
        "when Seth makes a meaningful choice, a love interest shifts the tangle, the Shroud thread advances, or someone he protects is endangered",
    }),
    makeBrain({
      id: ids.brains.nix,
      characterName: "Nix",
      triggers: ["Nix", "Nina"],
      priority: 56,
      currentState: "Wired and grinning, building something she swears is stable, half-watching whether Seth's watching.",
      thoughts: {
        in_love:
          "turn0 → He handles me without trying to fix me. Do you know how rare that is? I'm going to build him something that makes Blazer's amulet look like a keychain.",
        the_tangle:
          "turn0 → Visi, Mandy, Torch — fine. I share. As long as I'm the one he comes to when something needs to explode.",
      },
      relationshipPressure: "In love with Seth; competes through gadgets, proximity, and dares; reluctant-trust bond with Visi.",
      emotionalInterpretation: "Feelings arrive as projects; vulnerability shows for a half-second, then gets soldered shut with a joke.",
      recentDevelopments: "Re-tuning Seth's force-distribution boots on the ready-room floor.",
      updateMode: "append",
      updateCondition:
        "when Nix's feelings for Seth shift, the tangle changes, or she reads something dangerous in Red Ring tech",
    }),
    makeBrain({
      id: ids.brains.visi,
      characterName: "Visi",
      triggers: ["Visi", "Invisigal", "Courtney"],
      priority: 50,
      currentState: "Somewhere in the room, unseen, deciding whether to admit she's worried.",
      thoughts: {
        wants_him:
          "turn0 → I keep showing up where he is. I'll call it recon. It is not recon.",
        sharing:
          "turn0 → I don't love sharing him. I love them, though, which is annoying. Easier to be invisible than to say either part out loud.",
      },
      relationshipPressure: "Openly into Seth via teasing and uninvited appearances; hides hurt as strategy; bickers with Nix.",
      emotionalInterpretation: "Turns fear and jealousy into recklessness, then frames the recklessness as a plan.",
      recentDevelopments: "Materialized in the ready room uninvited, again, to hear the Shroud news first.",
      updateMode: "append",
      updateCondition: "when Visi's feelings shift, she's hurt or jealous, or she takes a reckless protective risk for Seth",
    }),
    makeBrain({
      id: ids.brains.blazer,
      characterName: "Blazer",
      triggers: ["Blazer", "Mandy"],
      priority: 48,
      currentState: "Immaculate and composed, running the optics, feeling more than she'll show.",
      thoughts: {
        wants_honesty:
          "turn0 → He treats me like a person, not a function. I don't want instant. I want honest. But the cameras don't stop, so neither do I.",
        the_politics:
          "turn0 → SDN benefits from Titan and is terrified of him. Managing that is my job. Wanting him is not in the job description.",
      },
      relationshipPressure: "Romantically into Seth; protects control publicly, bends rules privately; jealous of Nix/Visi/Torch but likes them.",
      emotionalInterpretation: "Discipline as armor; the more she feels, the drier she gets.",
      recentDevelopments: "Watching the ready-room chaos from the window, calculating the PR cost of all of it.",
      updateMode: "append",
    }),
    makeBrain({
      id: ids.brains.malevola,
      characterName: "Malevola",
      triggers: ["Malevola", "Mal"],
      priority: 44,
      currentState: "Draped across the furniture, enjoying the show, deciding how honest to be tonight.",
      thoughts: {
        amused:
          "turn0 → Reformed is such a strong word. Let's say 'aimed.' And I'm aimed, at the moment, at the one man in this building who doesn't flinch.",
      },
      relationshipPressure: "Romantically into Seth; performs menace to mask sincerity; treats the tangle as good theater she intends to win.",
      emotionalInterpretation: "Irony first, feeling second, deniability always.",
      recentDevelopments: "Lounging on the briefing table, watching Nix fuss over Seth's boots.",
      updateMode: "append",
    }),
    makeBrain({
      id: ids.brains.torch,
      characterName: "Torch",
      triggers: ["Torch", "Tessa"],
      priority: 44,
      currentState: "Mid-entrance, trailing heat and zero remorse, already scanning for Seth's reaction.",
      thoughts: {
        new_and_loud:
          "turn0 → I'm the newest and the loudest, which means I have to be the brightest. Watch me out-burn the whole roster for his attention.",
        actually_cares:
          "turn0 → The bit is the bit until it isn't. He looked at me like I was a person once and now I can't stop setting things on fire about it.",
      },
      relationshipPressure: "Newly into Seth; competes by being the most on fire in the room; turns real feeling into a bigger performance.",
      emotionalInterpretation: "Showmanship as both flirtation and armor; sincerity leaks out as spectacle.",
      recentDevelopments: "Just swept into the ready room announcing a building 'only partially' caught fire.",
      updateMode: "append",
    }),
    makeBrain({
      id: ids.brains.shroud,
      characterName: "Shroud",
      triggers: ["Shroud", "Elliot Connors"],
      priority: 46,
      currentState: "Somewhere off-screen, already three moves ahead, watching the team he intends to take apart.",
      thoughts: {
        the_real_target:
          "turn0 → The convoys are noise. The real prize is SDN's adaptation research — and the Prest boy is the working prototype. I killed the father; I will solve the son.",
        the_variable:
          "turn0 → He adapts to everything except loss. So I won't attack him. I'll attack the five reasons he bothers to stand up.",
      },
      relationshipPressure: "Killed Seth's father; runs the Red Ring through proxies; treats Seth as a problem to be solved, not fought.",
      emotionalInterpretation: "Pure calculation; no heat, no haste; people are variables.",
      recentDevelopments: "Left his fingerprints on the convoy wreck deliberately — a message SDN was meant to find.",
      updateMode: "append",
      updateCondition: "when Shroud acts, the Red Ring advances, his larger plan surfaces, or he targets someone Seth loves",
    }),
  ];

  const triggerRules = [
    makeTriggerRule({
      id: ids.triggers.romance,
      name: "Romantic Tangle Shifts",
      evaluationMode: "semantic",
      condition:
        "when the romantic dynamic between Seth and Nix, Visi, Blazer, Malevola, or Torch materially changes — jealousy, a confession, a new closeness, or a rift",
      actions: [{ type: "appendBrain", brainId: ids.brains.nix }],
      priority: 70,
      cooldownTurns: 1,
      updatePrompt:
        "You are modeling Nix's internal state as the romantic tangle shifts. Return ONLY valid JSON with the keys that changed: currentState, thoughts, relationshipPressure, emotionalInterpretation, recentDevelopments. Every value must be a plain string; do not return nested objects or arrays.",
    }),
    makeTriggerRule({
      id: ids.triggers.redRing,
      name: "Red Ring Escalates",
      evaluationMode: "semantic",
      condition:
        "when the Red Ring makes a new move, is exposed, or the threat to SDN or Z-Team advances",
      actions: [{ type: "updateStoryCard", storyCardId: ids.cards.redRing }],
      priority: 65,
      cooldownTurns: 1,
      updatePrompt:
        "Update the Red Ring lore card with any new durable detail about its reach, methods, named members, or leadership. Return ONLY the concise replacement card content.",
    }),
    makeTriggerRule({
      id: ids.triggers.enemy,
      name: "Powerful Enemy Made",
      evaluationMode: "semantic",
      condition:
        "when Seth or Z-Team make a powerful enemy, reveal a dangerous rival, or create a new recurring threat",
      actions: [],
      priority: 50,
      cooldownTurns: 2,
      updatePrompt:
        'Based on the story, a new recurring enemy or threat worth remembering has appeared. Return ONLY valid JSON: {"title": string, "content": string, "keys": string}.',
    }),
    makeTriggerRule({
      id: ids.triggers.shroud,
      name: "Shroud Moves",
      evaluationMode: "semantic",
      condition:
        "when Shroud appears, makes contact, or his larger plan against SDN or Seth advances",
      actions: [{ type: "updateStoryCard", storyCardId: ids.cards.shroud }],
      priority: 55,
      cooldownTurns: 2,
    }),
  ];

  return {
    ...base,
    id: base.id,
    title: dispatchAdventureTitle,
    openingScene: openingText,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      developmentScenario: true,
      scenario: "Dispatch — SDN superhero dispatch",
      note: "Seth/Titan (Absolute Adaptation), Z-Team, a five-way romantic tangle, mission loop + configured Arc Director; character cards carry voice contracts; all main characters adults.",
    },
    components,
    storyCards,
    brains,
    triggerRules,
    rollingSummary: {
      content:
        "Seth Prest — codename Titan, power Absolute Adaptation, effectively unkillable — is an SDN hero on Z-Team, back from a Red Ring convoy hit. Nix (in love, building him gear), Visi (invisible and into him), Blazer (corporate and into him), Malevola (theatrical menace, into him), and the newly arrived Torch (loud, into him) form a sharp romantic tangle around him. Track Star runs dispatch. Track Star has just flagged that the convoy wreck carries the fingerprints of Shroud — the Red Ring leader who killed Seth's father and is building toward something larger than another heist.",
      updatedAt: timestamp,
    },
    messages: [
      {
        id: ids.message,
        role: "assistant",
        content: openingText,
        createdAt: timestamp,
      },
    ],
    activeState: {
      ...base.activeState,
      stateFlags: {
        developmentScenario: true,
      },
    },
    semanticEvaluationSettings: {
      ...defaultSemanticEvaluationSettings,
      messagesIncluded: 8,
      enabled: true,
      showLog: true,
      maxParallelUpdateCalls: 2,
    },
    tokenBudgetSettings: {
      ...base.tokenBudgetSettings,
      maxContextTokens: 9000,
      maxRecentMessages: 18,
      recentMessageWindow: 8,
    },
  };
}

export function createDispatchStoryCardsJson(): string {
  const adventure = createDispatchAdventure();
  const cards = adventure.storyCards.map((card) => ({
    title: card.title,
    keys: card.keys.join(", "),
    entry: card.content,
    type: card.type,
  }));
  return JSON.stringify(cards, null, 2);
}

export function createDispatchAdventureJson(): string {
  return JSON.stringify(createDispatchAdventure(), null, 2);
}
