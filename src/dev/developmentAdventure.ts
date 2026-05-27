import type { Adventure, QuestStep } from "../types/adventure";
import {
  createDefaultAdventure,
  defaultAutoCardSettings,
  defaultSemanticEvaluationSettings,
  makeBrain,
  makeComponent,
  makeQuest,
  makeStoryCard,
  makeTriggerRule,
} from "../state/defaults";
import { nowIso } from "../utils/id";

export const developmentAdventureTitle = "Dev Scenario: Fire Nation Special Missions";

const ids = {
  components: {
    ai: "dev-component-adult-au-rules",
    plot: "dev-component-plot-essentials",
    author: "dev-component-author-note",
    court: "dev-component-court-pressure",
    combat: "dev-component-combat-doctrine",
  },
  cards: {
    setu: "dev-card-setu-renzan",
    azula: "dev-card-azula",
    mai: "dev-card-mai",
    tyLee: "dev-card-ty-lee",
    nyx: "dev-card-nyx",
    renzanHouse: "dev-card-renzan-house",
    royalWrit: "dev-card-royal-writ",
    court: "dev-card-fire-court",
    avatarRumors: "dev-card-avatar-rumors",
    betrothal: "dev-card-betrothal-pressure",
    firebending: "dev-card-elite-firebending",
  },
  brains: {
    setu: "dev-brain-setu",
    azula: "dev-brain-azula",
    nyx: "dev-brain-nyx",
    mai: "dev-brain-mai",
    tyLee: "dev-brain-ty-lee",
  },
  quest: "dev-quest-opening-arc",
  steps: {
    briefing: "dev-step-war-room-briefing",
    mission: "dev-step-first-mission",
    court: "dev-step-court-fallout",
  },
  triggers: {
    betrothal: "dev-trigger-betrothal-shift",
    nyx: "dev-trigger-nyx-volatility",
    avatar: "dev-trigger-avatar-rumor",
    enemy: "dev-trigger-powerful-enemy",
  },
  message: "dev-msg-opening",
};

function devStep(overrides: Partial<QuestStep> & Pick<QuestStep, "id" | "title" | "objective" | "contextText">): QuestStep {
  return {
    id: overrides.id,
    title: overrides.title,
    objective: overrides.objective,
    status: overrides.status ?? "pending",
    completionCondition: overrides.completionCondition ?? "",
    triggerConditions: overrides.triggerConditions ?? [],
    onStartActions: overrides.onStartActions ?? [],
    onCompleteActions: overrides.onCompleteActions ?? [],
    contextText: overrides.contextText,
  };
}

export function createDevelopmentAdventure(): Adventure {
  const timestamp = nowIso();
  const base = createDefaultAdventure(developmentAdventureTitle);

  const components = [
    ...base.components,
    makeComponent({
      id: ids.components.ai,
      title: "Adult AU Safety and Tone",
      type: "aiInstructions",
      content:
        "This is an adult alternate universe: Setu, Azula, Mai, Ty Lee, Nyx, and other central mission characters are 21 or older. Write political intrigue, rivalry, combat, loyalty conflicts, and romantic tension without explicit sexual content. Preserve continuity, avoid meta commentary, and give the player concrete openings for action.",
      priority: 95,
      alwaysOn: true,
      pinned: true,
      protected: true,
    }),
    makeComponent({
      id: ids.components.plot,
      title: "Opening Arc Plot Essentials",
      type: "plotEssentials",
      content:
        "Adult ATLA Fire Nation AU. Setu Renzan is the orphaned heir of a murdered noble house and the strongest firebending prodigy in generations. He serves under royal writ on Azula's special missions, loyal to the Fire Nation and bitter toward the Earth Kingdom. He trains and operates alongside Azula, Mai, Ty Lee, and Princess Nyx, Ozai's volatile second daughter. Court pressure, dangerous rivalry, political betrothal tension, elite firebending, and rumors of Team Avatar frame the opening arc.",
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
        "Keep scenes grounded in power, etiquette, martial discipline, and private consequence. Azula should be brilliant and dangerous, not cartoonish. Setu should be formidable but emotionally controlled, with grief and loyalty pulling against each other. Let political pressure create choices instead of exposition dumps.",
      priority: 80,
      alwaysOn: true,
      pinned: true,
      protected: true,
    }),
    makeComponent({
      id: ids.components.court,
      title: "Court Pressure Meter",
      type: "memory",
      content:
        "The Fire Nation court is watching Setu's proximity to Azula and Nyx. Noble families want leverage over the Renzan inheritance, and Ozai benefits when his elite youths compete for approval.",
      priority: 35,
      alwaysOn: false,
      active: true,
      pinned: false,
      protected: false,
      inclusionPolicy: "manual",
    }),
    makeComponent({
      id: ids.components.combat,
      title: "Elite Firebending Doctrine",
      type: "custom",
      content:
        "High-level firebending is breath, stance, intent, and timing. Blue fire signals Azula's precision; Setu's flame is white-gold under extreme focus. Lightning generation is rare, dangerous, and politically symbolic.",
      priority: 30,
      alwaysOn: false,
      active: true,
      pinned: false,
      protected: false,
      inclusionPolicy: "manual",
    }),
  ];

  const storyCards = [
    makeStoryCard({
      id: ids.cards.setu,
      title: "Setu Renzan",
      keys: ["Setu", "Renzan", "white-gold fire", "Renzan heir"],
      type: "character",
      priority: 70,
      content:
        "Setu Renzan is the adult heir of a murdered Fire Nation noble house. He is a prodigious firebender serving under royal writ on Azula's special missions. He is loyal to the Fire Nation, bitter toward the Earth Kingdom, and careful not to show how much his house's murder still governs him.",
    }),
    makeStoryCard({
      id: ids.cards.azula,
      title: "Princess Azula",
      keys: ["Azula", "blue fire", "Princess Azula"],
      type: "character",
      priority: 68,
      content:
        "Azula is an adult Fire Nation princess leading special missions with brilliant tactical control. She values precision, loyalty, fear, and usefulness, and she tests Setu because his talent is both asset and threat.",
    }),
    makeStoryCard({
      id: ids.cards.mai,
      title: "Mai",
      keys: ["Mai", "knives", "throwing knives"],
      type: "character",
      priority: 54,
      content:
        "Mai is an adult noble operative attached to Azula's mission circle. Her dry restraint hides careful observation, lethal accuracy, and a quiet dislike of court theatrics.",
    }),
    makeStoryCard({
      id: ids.cards.tyLee,
      title: "Ty Lee",
      keys: ["Ty Lee", "chi blocking", "acrobat"],
      type: "character",
      priority: 54,
      content:
        "Ty Lee is an adult acrobat and chi blocker whose bright social ease masks a precise read of pressure, fear, and attraction. She often notices emotional shifts before anyone names them.",
    }),
    makeStoryCard({
      id: ids.cards.nyx,
      title: "Princess Nyx",
      keys: ["Nyx", "Princess Nyx", "Ozai's second daughter"],
      type: "character",
      priority: 66,
      content:
        "Princess Nyx is Ozai's adult second daughter, volatile, talented, and politically inconvenient. She wants recognition separate from Azula's shadow and sees Setu as either proof, rival, weapon, or escape route depending on the moment.",
    }),
    makeStoryCard({
      id: ids.cards.renzanHouse,
      title: "Murder of House Renzan",
      keys: ["House Renzan", "Renzan massacre", "murdered house", "Setu's family"],
      type: "plot",
      priority: 62,
      content:
        "House Renzan was murdered when Setu was young. Officially, Earth Kingdom agents were blamed. Quiet contradictions remain: sealed archives, missing witnesses, and courtiers who know more than they admit.",
    }),
    makeStoryCard({
      id: ids.cards.royalWrit,
      title: "Royal Writ",
      keys: ["royal writ", "special missions", "Azula's missions"],
      type: "lore",
      priority: 58,
      content:
        "Setu serves under a royal writ that places him on Azula's special missions while binding him directly to the Fire Lord's authority. The writ protects him from lesser nobles but makes disobedience treasonous.",
    }),
    makeStoryCard({
      id: ids.cards.court,
      title: "Fire Nation Court",
      keys: ["court", "noble families", "war council", "capital"],
      type: "location",
      priority: 46,
      content:
        "The Fire Nation court treats young elite soldiers as weapons and marriage pieces. Public honor, private leverage, and family survival shape every invitation, duel, and rumor.",
    }),
    makeStoryCard({
      id: ids.cards.avatarRumors,
      title: "Rumors of Team Avatar",
      keys: ["Avatar", "Team Avatar", "Aang", "Water Tribe", "rumors"],
      type: "plot",
      priority: 50,
      content:
        "Reports of the Avatar and his allies are contradictory but increasing. Some officers dismiss them as rebel myth; Azula suspects pattern, timing, and weakness worth exploiting.",
    }),
    makeStoryCard({
      id: ids.cards.betrothal,
      title: "Political Betrothal Pressure",
      keys: ["betrothal", "marriage alliance", "courtship", "proposal", "engagement"],
      type: "plot",
      priority: 64,
      content:
        "Court factions are testing whether Setu should be tied by marriage to a royal or noble line. Any hint of affection, rivalry, jealousy, or public favor can become a political weapon.",
    }),
    makeStoryCard({
      id: ids.cards.firebending,
      title: "Elite Firebending Signals",
      keys: ["Agni Kai", "lightning", "white-gold fire", "blue fire", "firebending"],
      type: "lore",
      priority: 52,
      content:
        "Elite firebending doubles as combat language and court theater. Flame color, restraint, lightning control, and whether a fighter burns or spares an opponent all carry political meaning.",
    }),
  ];

  const brains = [
    makeBrain({
      id: ids.brains.setu,
      characterName: "Setu Renzan",
      aliases: ["Setu", "Renzan"],
      triggers: ["Setu", "Renzan", "white-gold fire"],
      priority: 60,
      currentState: "Guarded, disciplined, and alert under royal scrutiny.",
      thoughts:
        "Setu wants to prove House Renzan still matters without becoming a decorative weapon for Ozai's court.",
      relationshipPressure:
        "He respects Azula's command, distrusts Nyx's volatility, and notices how Mai and Ty Lee read what he tries to hide.",
      emotionalInterpretation:
        "Grief is converted into loyalty and precision. Earth Kingdom hatred is real but may be covering older uncertainty.",
      recentDevelopments: "Opening briefing pending.",
      updateMode: "append",
      updateCondition:
        "when Setu makes a meaningful choice, shows grief, escalates rivalry, changes loyalty, or is pressured by Azula, Nyx, Mai, Ty Lee, Ozai, or the court",
    }),
    makeBrain({
      id: ids.brains.azula,
      characterName: "Azula",
      aliases: ["Princess Azula", "Azula"],
      triggers: ["Azula", "blue fire"],
      priority: 58,
      currentState: "In command, testing every person in the room.",
      thoughts: "Setu's power is useful, but useful things become dangerous when other people admire them.",
      relationshipPressure: "She expects obedience from Mai and Ty Lee and rivalry from Nyx.",
      emotionalInterpretation: "Control is safety. Curiosity appears as challenge.",
      recentDevelopments: "Preparing to brief the mission circle.",
      updateMode: "append",
      updateCondition:
        "when Azula appears, exerts control, reacts to Setu's talent, faces Nyx's rivalry, or adjusts a mission plan",
    }),
    makeBrain({
      id: ids.brains.nyx,
      characterName: "Nyx",
      aliases: ["Princess Nyx", "Nyx"],
      triggers: ["Nyx", "Ozai's second daughter"],
      priority: 56,
      currentState: "Restless, sharp, and hungry to be seen as more than Azula's spare shadow.",
      thoughts: "If Setu is the court's new blade, Nyx wants to know whether he cuts for her, Azula, or himself.",
      relationshipPressure: "Her rivalry with Azula turns every interaction with Setu into a test.",
      emotionalInterpretation: "Pride, loneliness, and ambition move too close together.",
      recentDevelopments: "Entering the mission circle under pressure.",
      updateMode: "append",
      updateCondition:
        "when Nyx is meaningfully referenced, loses control, competes with Azula, or develops a new reaction to Setu",
    }),
    makeBrain({
      id: ids.brains.mai,
      characterName: "Mai",
      aliases: ["Mai"],
      triggers: ["Mai", "knives"],
      priority: 40,
      currentState: "Outwardly bored, privately attentive.",
      thoughts: "Court drama is tedious until someone reaches for a knife without moving their hand.",
      relationshipPressure: "Mai is loyal to the circle but skeptical of being used as scenery in royal games.",
      emotionalInterpretation: "Flat affect conceals exact judgment.",
      recentDevelopments: "Watching Setu, Azula, and Nyx establish the room's fault lines.",
      updateMode: "append",
    }),
    makeBrain({
      id: ids.brains.tyLee,
      characterName: "Ty Lee",
      aliases: ["Ty Lee"],
      triggers: ["Ty Lee", "chi blocking"],
      priority: 40,
      currentState: "Warm, alert, and physically relaxed in a way that makes danger look harmless.",
      thoughts: "People reveal themselves through breath before words.",
      relationshipPressure: "Ty Lee balances friendship, survival, and the emotional weather around Azula.",
      emotionalInterpretation: "Brightness can be camouflage and kindness at the same time.",
      recentDevelopments: "Reading the mission circle's tension.",
      updateMode: "append",
    }),
  ];

  const quest = makeQuest({
    id: ids.quest,
    title: "Opening Arc: Ashes Under the Crown",
    description:
      "Navigate Azula's special mission briefing, the first strike, and the court consequences without letting Setu become someone else's pawn.",
    status: "active",
    currentStepId: ids.steps.briefing,
    priority: 65,
    pinned: true,
    steps: [
      devStep({
        id: ids.steps.briefing,
        title: "War Room Briefing",
        objective: "Hear Azula's mission parameters and decide how Setu presents himself to the room.",
        status: "active",
        completionCondition:
          "when Azula gives the mission parameters and Setu commits to a public role in the operation",
        contextText:
          "Current objective: survive the war room briefing, understand Azula's mission, and choose how Setu presents his loyalty and ambition.",
        onCompleteActions: [
          {
            type: "createMilestoneCard",
            questId: ids.quest,
            title: "War Room Briefing Outcome",
            content: "Record how Setu publicly positioned himself during Azula's mission briefing.",
          },
        ],
      }),
      devStep({
        id: ids.steps.mission,
        title: "First Strike",
        objective: "Execute the first special mission without losing control of the political narrative.",
        completionCondition:
          "when the mission objective is completed or decisively fails and the team must face consequences",
        contextText:
          "Current objective: carry out the special mission while tracking who gains leverage from Setu's choices.",
      }),
      devStep({
        id: ids.steps.court,
        title: "Court Fallout",
        objective: "Handle court reaction, betrothal pressure, and rumors before they harden into policy.",
        completionCondition:
          "when the court formally reacts to the mission and Setu either accepts, rejects, or redirects the proposed political consequence",
        contextText:
          "Current objective: manage court fallout and prevent one rumor from becoming Setu's cage.",
      }),
    ],
    relatedCards: [ids.cards.betrothal, ids.cards.court],
  });

  const triggerRules = [
    makeTriggerRule({
      id: ids.triggers.betrothal,
      name: "Betrothal Pressure Shifts",
      evaluationMode: "semantic",
      condition:
        "when romance, jealousy, public favor, courtship, engagement, or marriage politics around Setu materially changes",
      actions: [{ type: "updateStoryCard", storyCardId: ids.cards.betrothal }],
      priority: 70,
      cooldownTurns: 1,
      updatePrompt:
        "Update the Political Betrothal Pressure story card with the new durable political implication. Return ONLY the concise replacement card content.",
    }),
    makeTriggerRule({
      id: ids.triggers.nyx,
      name: "Nyx Volatility Changes",
      evaluationMode: "semantic",
      condition:
        "when Nyx's rivalry, jealousy, ambition, vulnerability, or attitude toward Setu changes in a lasting way",
      actions: [{ type: "appendBrain", brainId: ids.brains.nyx }],
      priority: 65,
      cooldownTurns: 1,
      updatePrompt:
        "You are modeling Nyx's internal state. Return ONLY valid JSON with keys that changed: currentState, thoughts, relationshipPressure, emotionalInterpretation, recentDevelopments.",
    }),
    makeTriggerRule({
      id: ids.triggers.avatar,
      name: "Avatar Rumor Escalates",
      evaluationMode: "semantic",
      condition:
        "when new information about Team Avatar, the Avatar's location, or rebel movements becomes relevant to the mission",
      actions: [{ type: "updateStoryCard", storyCardId: ids.cards.avatarRumors }],
      priority: 55,
      cooldownTurns: 1,
    }),
    makeTriggerRule({
      id: ids.triggers.enemy,
      name: "Powerful Enemy Made",
      evaluationMode: "semantic",
      condition:
        "when Setu, Azula, Nyx, Mai, or Ty Lee make a powerful enemy, reveal a dangerous rival, or create a new recurring threat",
      actions: [{ type: "createAutoCard" }],
      priority: 45,
      cooldownTurns: 2,
      updatePrompt:
        'Based on the story, a new recurring enemy or threat worth remembering has appeared. Return ONLY valid JSON: {"title": string, "content": string, "keys": string}.',
    }),
  ];

  return {
    ...base,
    id: base.id,
    title: developmentAdventureTitle,
    openingScene:
      "Protected opening: The adult mission circle gathers in the Fire Nation palace war room under royal writ. The Fire Lord's court is watching what Azula commands, what Setu reveals, and how Nyx reacts.",
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      developmentScenario: true,
      scenario: "Adult ATLA Fire Nation AU",
      note: "All central named mission characters are adults.",
    },
    components,
    storyCards,
    brains,
    triggerRules,
    quests: [quest],
    rollingSummary: {
      content:
        "Setu Renzan, adult heir of the murdered noble House Renzan, serves under royal writ on Azula's special missions. He is loyal to the Fire Nation, bitter toward the Earth Kingdom, and increasingly valuable to a court that wants to bind him. The opening arc begins with Azula, Mai, Ty Lee, and Princess Nyx gathering for a mission briefing under Ozai's shadow while rumors of Team Avatar grow harder to dismiss.",
      updatedAt: timestamp,
    },
    messages: [
      {
        id: ids.message,
        role: "assistant",
        content:
          "The palace war room is too warm for anyone who has not earned the right to sweat.\n\nMaps of the Earth Kingdom lie pinned beneath brass weights. Red lacquer screens hold back the corridor noise. Azula stands at the head of the table with blue fire ghosting once across her knuckles, a silent warning to every court observer pretending not to listen. Mai leans near the wall with one sleeve hiding enough steel to end an argument. Ty Lee smiles as if the room is not full of knives. Princess Nyx arrives late enough to be noticed and early enough to deny it.\n\nSetu Renzan is placed at Azula's right by royal writ, where everyone can see the orphaned heir of House Renzan and wonder which royal hand will close around him first.\n\nAzula looks from the sealed mission tube to Setu. \"You will tell us what kind of weapon you intend to be.\"",
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
    autoCardSettings: {
      ...defaultAutoCardSettings,
      enabled: true,
      detectionCondition:
        "when a new named adult character, location, organization, military unit, faction, or significant object is introduced that does not already have a Story Card",
      generationPrompt:
        'Based on the story, a new durable entity or fact worth remembering has appeared. Write a concise Story Card for it. Return ONLY valid JSON: {"title": string, "content": string, "keys": string}.',
      cooldownTurns: 3,
    },
    tokenBudgetSettings: {
      ...base.tokenBudgetSettings,
      maxContextTokens: 9000,
      maxRecentMessages: 18,
      recentMessageWindow: 8,
    },
  };
}

export function createDevelopmentStoryCardsJson(): string {
  const adventure = createDevelopmentAdventure();
  const cards = adventure.storyCards.map((card) => ({
    title: card.title,
    keys: card.keys.join(", "),
    entry: card.content,
    type: card.type,
  }));
  return JSON.stringify(cards, null, 2);
}

export function createDevelopmentAdventureJson(): string {
  return JSON.stringify(createDevelopmentAdventure(), null, 2);
}

