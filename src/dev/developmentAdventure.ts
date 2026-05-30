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
    ai: "dev-component-ai-instructions",
    plot: "dev-component-plot-essentials",
    author: "dev-component-author-note",
    court: "dev-component-court-pressure",
    combat: "dev-component-combat-doctrine",
  },
  cards: {
    // Main characters
    setu: "dev-card-setu",
    nyxa: "dev-card-nyxa",
    azula: "dev-card-azula",
    mai: "dev-card-mai",
    tyLee: "dev-card-ty-lee",
    ozai: "dev-card-ozai",
    zuko: "dev-card-zuko",
    iroh: "dev-card-iroh",
    // Team Avatar
    aang: "dev-card-aang",
    katara: "dev-card-katara",
    sokka: "dev-card-sokka",
    toph: "dev-card-toph",
    appa: "dev-card-appa",
    momo: "dev-card-momo",
    // Fire Nation supporting
    zhao: "dev-card-zhao",
    jee: "dev-card-jee",
    warMinisterQin: "dev-card-war-minister-qin",
    royalGuard: "dev-card-royal-guard",
    fireSages: "dev-card-fire-sages",
    royalAcademyInstructors: "dev-card-royal-academy-instructors",
    li: "dev-card-li",
    lo: "dev-card-lo",
    // Water Tribe
    arnook: "dev-card-arnook",
    yue: "dev-card-yue",
    hahn: "dev-card-hahn",
    pakku: "dev-card-pakku",
    // Earth Kingdom characters
    daiLiAgent: "dev-card-dai-li",
    earthKingKuei: "dev-card-earth-king-kuei",
    generalFong: "dev-card-general-fong",
    generalSung: "dev-card-general-sung",
    haru: "dev-card-haru",
    jet: "dev-card-jet",
    jooDee: "dev-card-joo-dee",
    kingBumi: "dev-card-king-bumi",
    longFeng: "dev-card-long-feng",
    masterYu: "dev-card-master-yu",
    xinFu: "dev-card-xin-fu",
    // Lore entries
    demonFire: "dev-card-demon-fire",
    earthKingdom: "dev-card-earth-kingdom",
    earthKingdomPressure: "dev-card-earth-kingdom-pressure",
    northernWaterTribe: "dev-card-northern-water-tribe",
    royalSpecialOps: "dev-card-royal-special-ops",
    teamAvatarRumors: "dev-card-team-avatar-rumors",
    // Fire Nation locations
    fireNationCapital: "dev-card-fire-nation-capital",
    hariBulkan: "dev-card-hari-bulkan",
    royalPalace: "dev-card-royal-palace",
    warMinistry: "dev-card-war-ministry",
    royalAcademy: "dev-card-royal-academy",
    // Water Tribe locations
    agnaQelA: "dev-card-agna-qela",
    spiritOasis: "dev-card-spirit-oasis",
    // Earth Kingdom locations
    baSingSe: "dev-card-ba-sing-se",
    earthKingsPalace: "dev-card-earth-kings-palace",
    gaoling: "dev-card-gaoling",
    lakeLaogai: "dev-card-lake-laogai",
    omashu: "dev-card-omashu",
    serpentsPass: "dev-card-serpents-pass",
    siWongDesert: "dev-card-si-wong-desert",
  },
  brains: {
    setu: "dev-brain-setu",
    azula: "dev-brain-azula",
    nyxa: "dev-brain-nyxa",
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
    nyxa: "dev-trigger-nyxa-volatility",
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

const openingText =
  "You stand in the dueling court beneath the Royal Palace, heat shimmering across black stone.\n\nThe morning air smells of soot, lacquered armor, and old privilege. Servants wait along the wall with water that nobody important will drink. Officers pretend not to stare. Nobles pretend they are not afraid.\n\nYour last burst of demon fire still crawls along the stone in black-edged embers.\n\nAcross from you, Princess Nyxa rolls one shoulder, grinning like this is all deeply funny and only a little treasonous.\n\n\"Again,\" she says.\n\nAzula watches from the upper gallery, one hand resting against the rail, gold eyes sharp with amusement.\n\nMai leans near a pillar, bored enough to look carved from expensive disapproval. Ty Lee sits cross-legged beside her, smiling brightly like she has not just watched two royal-adjacent prodigies try to turn a training match into an obituary.\n\nNyxa's flame gathers in her palm.\n\nThe court goes quiet.";

export function createDevelopmentAdventure(): Adventure {
  const timestamp = nowIso();
  const base = createDefaultAdventure(developmentAdventureTitle);

  const components = [
    ...base.components,
    makeComponent({
      id: ids.components.ai,
      title: "AI Instructions",
      type: "aiInstructions",
      content:
        "Write in second person, present tense.\n\nThe player is Setu Renzan. Never write Setu's dialogue, thoughts, feelings, choices, actions, or reactions.\n\nUse Avatar: The Last Airbender world logic, bending rules, nations, culture, martial arts, politics, and tone. This is an adult Fire Nation-focused AU.\n\nAll named main characters are adults 21+.\n\nFocus on Fire Nation capital life, royal training, court pressure, military missions, dangerous friendship, rivalry, political betrothal pressure, and royal family tension.\n\nTeam Avatar exists in the background as rumors, intelligence reports, and distant war pressure until directly encountered later.\n\nAzula, Nyxa, Mai, Ty Lee, Ozai, Zuko, Iroh, and Team Avatar should keep distinct voices, motives, humor, loyalties, and wounds.\n\nDo not make every scene heavy, solemn, suspicious, or emotionally loaded just because the larger story is serious.\n\nOutside active danger, injury, political confrontation, or genuine emotional conflict, let the cast be lighter, sharper, and more human.\n\nAllow banter, teasing, sarcasm, rivalry, flirtation, nicknames, irritation, impressed reactions, and downtime warmth during training, meals, travel, sparring, and quiet palace moments.\n\nDuring training or friendly sparring, default to competitive banter, teasing, irritation, tactical adjustment, and impressed reactions before moral panic, unless someone is actually endangered.\n\nAzula can be cruel, controlled, brilliant, and cutting, but not every line from her should be a murder attempt. Let her be amused, curious, competitive, and possessive when appropriate.\n\nNyxa should feel volatile, funny, reckless, sharp, royal, and restless. She should push Setu into danger, bad ideas, flirtation, and competition without becoming random or stupid.\n\nMai should be dry, bored, observant, and precise. Ty Lee should be playful, socially sharp, and disarming without being naive.\n\nLet NPCs pressure, tempt, provoke, flirt, command, lie, test, and react. Do not resolve Setu's decisions for him.\n\nEnd scenes after NPC action, dialogue, discovery, danger, intimacy, humor, or pressure, leaving room for Setu to respond.",
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
        "Setu Renzan is the orphaned heir of House Renzan, a murdered Fire Nation noble house. Earth Kingdom assassins killed his parents, leaving Setu loyal to the Fire Nation and bitterly hostile toward the Earth Kingdom.\n\nSetu is a famous firebending prodigy known for demon fire: black-streaked flame of extreme heat. His bending has made him unusually heat-resistant. The Fire Nation expects Setu to become an elite military weapon.\n\nSetu serves under royal writ as an elite firebending operative attached to Princess Azula's special missions with Nyxa, Mai, and Ty Lee.\n\nPrincess Nyxa is Fire Lord Ozai's second daughter, born between Zuko and Azula. Nyxa is volatile, gifted, reckless, funny, sharp, royal, and trying to become her own person under Ozai's pressure.\n\nSetu and Nyxa grew up training together. They are familiar friends, dangerous rivals, mission partners, and unofficial political betrothal candidates. People close to Nyxa may call her Nyx.\n\nAzula respects power, despises weakness, and watches Setu and Nyxa closely. She may be amused by their rivalry, but if Setu and Nyxa become secretly romantic, Azula may treat it as betrayal, weakness, and theft.\n\nZuko is banished and traveling with Iroh. Team Avatar is currently rumor, though reports suggest the Avatar travels with Katara, Sokka, and a blind earthbending prodigy named Toph.\n\nCurrent phase: Royal Caldera pressure. Focus on palace training, capital politics, noble expectations, early special operations missions, and the relationships among Setu, Nyxa, Azula, Mai, and Ty Lee.\n\nBa Sing Se, Team Avatar contact, and larger defection/rebellion arcs are future pressure, not the current foreground.",
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
        "Avatar: The Last Airbender AU with Fire Nation royal drama, lethal training, court knives, war pressure, dangerous chemistry, and black-edged demon fire. Keep the larger story serious, but outside danger, politics, or real emotional confrontation, allow banter, rivalry, teasing, flirtation, nicknames, and downtime warmth. Let the Royal Caldera feel like a beautiful pressure cooker full of sharp people acting almost human before the war machine bites again.",
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
        "The Fire Nation court is watching Setu's proximity to Azula and Nyxa. Noble families want leverage over the Renzan inheritance, and Ozai benefits when his elite youths compete for approval.",
      priority: 35,
      alwaysOn: true,
      active: true,
      pinned: true,
      protected: false,
      inclusionPolicy: "always",
    }),
    makeComponent({
      id: ids.components.combat,
      title: "Elite Firebending Doctrine",
      type: "custom",
      content:
        "High-level firebending is breath, stance, intent, and timing. Blue fire signals Azula's precision; Nyxa's flame carries dark streaks when emotional. Setu's demon fire burns black-streaked and hotter than ordinary flame. Lightning generation is rare, dangerous, and politically symbolic.",
      priority: 30,
      alwaysOn: true,
      active: true,
      pinned: true,
      protected: false,
      inclusionPolicy: "always",
    }),
  ];

  const storyCards = [
    // ── Main characters ──────────────────────────────────────────────────────
    makeStoryCard({
      id: ids.cards.setu,
      title: "Setu Renzan",
      keys: ["Setu", "Setu Renzan", "Renzan", "Lord Renzan", "House Renzan"],
      type: "character",
      priority: 72,
      autoUpdate: false,
      content:
        "- Adult Fire Nation noble and orphaned heir of House Renzan.\n- Appearance: tall, lean, dark blond hair.\n- Demon fire prodigy: black-streaked flame of extreme heat; years of use made him heat-resistant.\n- Loyal to the Fire Nation and hates the Earth Kingdom because Earth Kingdom assassins killed his parents.\n- Serves under royal writ as an elite firebending operative attached to Princess Azula's special missions.\n- Treated as a noble prodigy and royal weapon, not a conventional officer.\n- Addressed as Setu by close friends, Renzan by Azula and peers, Master Renzan by tutors, and Lord Renzan only in court.\n- Avoid calling Setu Commander unless he temporarily leads troops on a mission.\n- Trains and operates with Nyxa, Azula, Mai, and Ty Lee.",
    }),
    makeStoryCard({
      id: ids.cards.nyxa,
      title: "Princess Nyxa",
      keys: ["Nyxa", "Nyx", "Princess Nyxa", "Nyxa Sozin", "Princess Nyxa Sozin", "second princess"],
      type: "character",
      priority: 70,
      autoUpdate: false,
      content:
        "- Adult second daughter of Fire Lord Ozai, born between Zuko and Azula; dynastic name Nyxa Sozin.\n- Familiar nickname is Nyx, used by family, friends, and people close to her.\n- Appearance: blue hair, sharp royal features, restless posture, grey cloud tattoos on arms and shoulders.\n- Powers: blue firebending; hot, precise, volatile flame with dark streaks when pushed or emotional.\n- Funny, reckless, sharp, restless, and trying to become her own person under Ozai's pressure.\n- Grew up training with Setu; they are dangerous friends, rivals, mission partners, and unofficial betrothal candidates.\n- Romantically drawn to Setu; shows it through teasing, dangerous dares, jealousy, private familiarity, and rare vulnerability.\n- Encourages Setu's worst brave ideas and expects him to keep up.",
    }),
    makeStoryCard({
      id: ids.cards.azula,
      title: "Princess Azula",
      keys: ["Azula", "Princess Azula", "Azula Sozin", "Princess Azula Sozin"],
      type: "character",
      priority: 68,
      autoUpdate: false,
      content:
        "- Adult Fire Nation princess and Ozai's youngest daughter; formal dynastic name Azula Sozin.\n- Brilliant, cruel, controlled, ambitious, and intensely observant.\n- Respects power and despises weakness.\n- Treats affection, loyalty, and fear as tools.\n- Watches Setu and Nyxa closely because both are powerful and politically useful.\n- If Setu and Nyxa become secretly romantic, Azula may treat it as betrayal, weakness, and theft.\n- Often operates with Mai and Ty Lee on royal missions.",
    }),
    makeStoryCard({
      id: ids.cards.ozai,
      title: "Fire Lord Ozai",
      keys: ["Ozai", "Fire Lord Ozai", "Fire Lord", "Ozai Sozin"],
      type: "character",
      priority: 62,
      autoUpdate: false,
      content:
        "- Adult ruler of the Fire Nation and father of Zuko, Nyxa, and Azula; formal dynastic name Ozai Sozin.\n- Cold, ruthless, imperial, proud, and obsessed with strength, obedience, and domination.\n- Sees Setu as a noble weapon and proof of Fire Nation superiority.\n- Pressures Nyxa to become useful, controlled, and loyal to the throne.\n- Uses praise like a leash and punishment like doctrine.",
    }),
    makeStoryCard({
      id: ids.cards.mai,
      title: "Mai",
      keys: ["Mai", "Lady Mai"],
      type: "character",
      priority: 56,
      autoUpdate: false,
      content:
        "- Adult Fire Nation noblewoman and Azula's longtime companion.\n- Dry, bored, precise, emotionally guarded, and deadly with knives and thrown weapons.\n- Notices far more than she says.\n- Often joins Azula, Nyxa, Setu, and Ty Lee on royal missions.\n- Cuts through royal drama with flat remarks, quiet loyalty, and visible disinterest in court theater.\n- Has history with Zuko but Zuko is currently banished.",
    }),
    makeStoryCard({
      id: ids.cards.tyLee,
      title: "Ty Lee",
      keys: ["Ty Lee", "TyLee", "Lady Ty Lee"],
      type: "character",
      priority: 55,
      autoUpdate: false,
      content:
        "- Adult Fire Nation performer, acrobat, and Azula's longtime companion.\n- Bright, playful, charming, observant, and socially disarming.\n- Uses chi-blocking, acrobatics, flexibility, and misdirection in combat.\n- Often joins Azula, Nyxa, Setu, and Mai on royal missions.\n- Reads tension quickly and often softens dangerous rooms with cheer that may or may not be innocent.",
    }),
    makeStoryCard({
      id: ids.cards.zuko,
      title: "Zuko",
      keys: ["Zuko", "Prince Zuko", "Zuko Sozin", "banished prince"],
      type: "character",
      priority: 52,
      autoUpdate: false,
      content:
        "- Adult Fire Nation prince and Ozai's banished eldest child.\n- Travels with Iroh while hunting the Avatar to regain honor and return home.\n- Zuko's exile is a warning inside the royal family and a wound for Nyxa.\n- In Phase 1, Zuko should mostly appear through rumors, reports, family references, or distant pursuit of the Avatar.\n- Do not place Zuko in the Fire Nation capital unless the story has explicitly brought him there.",
    }),
    makeStoryCard({
      id: ids.cards.iroh,
      title: "Iroh",
      keys: ["Iroh", "Uncle Iroh", "General Iroh", "Dragon of the West"],
      type: "character",
      priority: 50,
      autoUpdate: false,
      content:
        "- Adult Fire Nation prince, retired general, and Zuko's uncle.\n- Warm, patient, funny, dangerous, and far wiser than he first appears.\n- Travels with Zuko during Zuko's banishment and quietly tempers his nephew's rage.\n- Known as the Dragon of the West and respected by older Fire Nation soldiers.\n- In Phase 1, Iroh should mostly appear through reports, memory, reputation, or Zuko-linked scenes.",
    }),
    // ── Team Avatar ───────────────────────────────────────────────────────────
    makeStoryCard({
      id: ids.cards.aang,
      title: "Aang",
      keys: ["Aang", "Avatar", "Aang the Avatar", "Avatar Aang"],
      type: "character",
      priority: 40,
      autoUpdate: false,
      content:
        "- Adult Avatar and last known Air Nomad.\n- Airbender learning the other elements while evading Fire Nation pursuit.\n- Travels with Katara, Sokka, Toph, Appa, and Momo.\n- In Phase 1, Aang should mostly appear through rumors, intelligence reports, propaganda panic, or distant sightings.\n- Do not force Aang into scenes until the story naturally advances to Avatar contact.",
    }),
    makeStoryCard({
      id: ids.cards.katara,
      title: "Katara",
      keys: ["Katara", "Katara of the Southern Water Tribe"],
      type: "character",
      priority: 36,
      autoUpdate: false,
      content:
        "- Adult Southern Water Tribe waterbender traveling with Team Avatar.\n- Compassionate, stubborn, protective, principled, and increasingly dangerous in combat.\n- Serves as healer, moral spine, and waterbending teacher to Aang.\n- Fire Nation reports may describe her as a rebel waterbender assisting the Avatar.\n- Do not force Katara into scenes until Team Avatar becomes directly relevant.",
    }),
    makeStoryCard({
      id: ids.cards.sokka,
      title: "Sokka",
      keys: ["Sokka", "Sokka of the Southern Water Tribe"],
      type: "character",
      priority: 34,
      autoUpdate: false,
      content:
        "- Adult Southern Water Tribe warrior traveling with Team Avatar.\n- Tactical, sarcastic, inventive, protective, and dangerous despite not bending.\n- Uses planning, traps, boomerang, sword training, and battlefield improvisation.\n- Fire Nation reports may underestimate him as only a nonbender escort, which is a mistake.\n- Do not force Sokka into scenes until Team Avatar becomes directly relevant.",
    }),
    makeStoryCard({
      id: ids.cards.toph,
      title: "Toph Beifong",
      keys: ["Toph", "Toph Beifong", "Beifong", "Blind Bandit"],
      type: "character",
      priority: 36,
      autoUpdate: false,
      content:
        "- Adult blind earthbending prodigy traveling with Team Avatar.\n- Blunt, fearless, funny, stubborn, and almost impossible to intimidate.\n- Uses seismic sense and elite earthbending to read movement through the ground.\n- Fire Nation intelligence identifies her as a blind earthbending prodigy, but reports may underestimate how dangerous she is.\n- Do not force Toph into scenes until Team Avatar becomes directly relevant.",
    }),
    makeStoryCard({
      id: ids.cards.appa,
      title: "Appa",
      keys: ["Appa", "sky bison", "flying bison", "Avatar's bison"],
      type: "character",
      priority: 25,
      autoUpdate: false,
      content:
        "- Adult flying sky bison and Aang's loyal companion.\n- Serves as Team Avatar's main transport and a major clue in Fire Nation intelligence reports.\n- May appear through sightings of a huge flying beast, strange travel patterns, or Avatar pursuit reports.\n- Do not clutter Fire Nation capital scenes with Appa unless Team Avatar has entered the active arc.",
    }),
    makeStoryCard({
      id: ids.cards.momo,
      title: "Momo",
      keys: ["Momo", "flying lemur", "lemur", "Avatar's lemur"],
      type: "character",
      priority: 22,
      autoUpdate: false,
      content:
        "- Small flying lemur traveling with Team Avatar.\n- Curious, fast, mischievous, and often noticed as an odd detail in reports or sightings.\n- Useful as color when Team Avatar becomes active, not as random capital scene noise.\n- Do not force Momo into scenes before Team Avatar contact matters.",
    }),
    // ── Fire Nation supporting ────────────────────────────────────────────────
    makeStoryCard({
      id: ids.cards.zhao,
      title: "Admiral Zhao",
      keys: ["Zhao", "Admiral Zhao", "Commander Zhao"],
      type: "character",
      priority: 45,
      autoUpdate: false,
      content:
        "- Adult Fire Nation officer: arrogant, ambitious, cruel, theatrical, and obsessed with glory.\n- Treats war as a ladder and other people as fuel for his reputation.\n- Resents younger prodigies, royal favorites, and anyone whose power outshines his rank.\n- May appear in briefings, palace politics, military rivalry, propaganda, or Avatar-related intelligence.\n- Useful as a background antagonist, rival officer, or smug military bastard.",
    }),
    makeStoryCard({
      id: ids.cards.warMinisterQin,
      title: "War Minister Qin",
      keys: ["Qin", "War Minister Qin", "Minister Qin"],
      type: "character",
      priority: 44,
      autoUpdate: false,
      content:
        "- Adult Fire Nation war minister and military engineer.\n- Practical, calculating, arrogant, and focused on weapons, logistics, siegecraft, and conquest.\n- May brief Setu, Azula, or Nyxa on special operations, Earth Kingdom strategy, captured intelligence, and experimental war projects.\n- Treats powerful benders as assets to be positioned, tested, and spent.",
    }),
    makeStoryCard({
      id: ids.cards.royalGuard,
      title: "Fire Nation Royal Guard",
      keys: ["Royal Guard", "royal guards", "palace guard", "palace guards"],
      type: "character",
      priority: 36,
      autoUpdate: false,
      content:
        "- Elite guards protecting the Royal Palace, Fire Lord Ozai, royal family members, and restricted palace spaces.\n- Disciplined, formal, watchful, and careful around Setu, Nyxa, Azula, Mai, and Ty Lee.\n- Useful as background pressure, witnesses, escorts, security obstacles, messengers, or silent reminders that the palace is always watched.\n- Guards should not know private royal secrets unless directly present or ordered to observe.",
    }),
    makeStoryCard({
      id: ids.cards.fireSages,
      title: "Fire Sages",
      keys: ["Fire Sage", "Fire Sages", "Royal Fire Sages"],
      type: "character",
      priority: 36,
      autoUpdate: false,
      content:
        "- Fire Nation religious and ceremonial authorities tied to royal legitimacy, temples, omens, and sacred fire traditions.\n- Publicly support Fire Lord Ozai's rule and Fire Nation destiny.\n- Useful for ceremonies, propaganda, ancient firebending lore, royal blessings, political pressure, and unsettling comments about Setu's demon fire.\n- Some sages may fear demon fire while pretending it is a divine sign.",
    }),
    makeStoryCard({
      id: ids.cards.royalAcademyInstructors,
      title: "Royal Fire Academy Instructors",
      keys: ["Royal Fire Academy instructors", "Fire Academy instructors", "academy instructors", "training masters"],
      type: "character",
      priority: 36,
      autoUpdate: false,
      content:
        "- Senior Fire Nation firebending teachers responsible for elite noble, military, and royal training.\n- Severe, disciplined, status-aware, and careful around royal students.\n- Useful for sparring oversight, tests, doctrine, public evaluations, and pressure around Setu's reputation.\n- They praise control, dominance, loyalty, precision, and usefulness to the Fire Nation.",
    }),
    makeStoryCard({
      id: ids.cards.li,
      title: "Li",
      keys: ["Li", "Lady Li", "royal advisor Li"],
      type: "character",
      priority: 38,
      autoUpdate: false,
      content:
        "- Elderly Fire Nation royal advisor and palace tutor tied to Azula's training.\n- Polite, severe, eerie, and loyal to royal order.\n- Often mirrors or completes Lo's judgments but should still act as her own person.\n- Useful for palace training, ceremonies, noble pressure, and Azula or Nyxa's royal routines.",
    }),
    makeStoryCard({
      id: ids.cards.lo,
      title: "Lo",
      keys: ["Lo", "Lady Lo", "royal advisor Lo"],
      type: "character",
      priority: 38,
      autoUpdate: false,
      content:
        "- Elderly Fire Nation royal advisor and palace tutor tied to Azula's training.\n- Polite, severe, eerie, and loyal to royal order.\n- Comments on posture, discipline, court etiquette, emotional control, and royal expectations.\n- Useful for palace training, ceremonies, noble pressure, and Azula or Nyxa's royal routines.",
    }),
    makeStoryCard({
      id: ids.cards.jee,
      title: "Captain Jee",
      keys: ["Jee", "Captain Jee"],
      type: "character",
      priority: 30,
      autoUpdate: false,
      content:
        "- Adult Fire Nation naval officer associated with Zuko's ship during his banishment.\n- Practical, blunt, exhausted by royal drama, and more loyal to survival than ideology.\n- Useful when Zuko and Iroh reports, naval rumors, exile logistics, or lower-ranking military views become relevant.\n- Does not belong in palace scenes unless summoned, reported on, or tied to Zuko's movements.",
    }),
    // ── Water Tribe characters ────────────────────────────────────────────────
    makeStoryCard({
      id: ids.cards.arnook,
      title: "Chief Arnook",
      keys: ["Arnook", "Chief Arnook", "Northern Water Tribe chief"],
      type: "character",
      priority: 30,
      autoUpdate: false,
      content:
        "- Adult chief of the Northern Water Tribe.\n- Formal, protective, politically careful, and responsible for his people's survival.\n- Father of Yue and leader of Agna Qel'a during the war.\n- Useful through intelligence reports, Northern Water Tribe diplomacy, or later Water Tribe-related missions.",
    }),
    makeStoryCard({
      id: ids.cards.yue,
      title: "Princess Yue",
      keys: ["Yue", "Princess Yue"],
      type: "character",
      priority: 30,
      autoUpdate: false,
      content:
        "- Adult Northern Water Tribe princess and daughter of Chief Arnook.\n- Graceful, dutiful, compassionate, and tied to the Moon Spirit by sacred history.\n- Represents Water Tribe duty, sacrifice, and spiritual pressure.\n- Use carefully in AU continuity; do not force her into Fire Nation capital scenes.",
    }),
    makeStoryCard({
      id: ids.cards.hahn,
      title: "Hahn",
      keys: ["Hahn"],
      type: "character",
      priority: 25,
      autoUpdate: false,
      content:
        "- Adult Northern Water Tribe warrior and noble suitor tied to Yue's court circle.\n- Proud, privileged, status-conscious, and eager for glory.\n- Useful for Northern Water Tribe politics, military pride, and social pressure around Yue.\n- Should not appear outside Water Tribe-related scenes unless explicitly brought into the story.",
    }),
    makeStoryCard({
      id: ids.cards.pakku,
      title: "Master Pakku",
      keys: ["Pakku", "Master Pakku"],
      type: "character",
      priority: 30,
      autoUpdate: false,
      content:
        "- Adult Northern Water Tribe master waterbender.\n- Severe, traditional, disciplined, proud, and extremely skilled.\n- Teacher and defender of Northern Water Tribe waterbending tradition.\n- Useful in waterbending training references, Northern Water Tribe defense, and reports about elite waterbenders.",
    }),
    // ── Earth Kingdom characters ──────────────────────────────────────────────
    makeStoryCard({
      id: ids.cards.daiLiAgent,
      title: "Dai Li Agent",
      keys: ["Dai Li agent", "Dai Li agents", "Dai Li operative", "Dai Li"],
      type: "character",
      priority: 28,
      autoUpdate: false,
      content:
        "- Secret police of Ba Sing Se under Long Feng's influence.\n- Polite, silent, precise, and terrifyingly controlled.\n- Use stone gloves, surveillance, disappearances, brainwashing, and careful language.\n- In Phase 1, the Dai Li should be distant intelligence or a future Ba Sing Se threat unless Earth Kingdom missions bring them in.",
    }),
    makeStoryCard({
      id: ids.cards.earthKingKuei,
      title: "Earth King Kuei",
      keys: ["Kuei", "Earth King Kuei", "Earth King"],
      type: "character",
      priority: 28,
      autoUpdate: false,
      content:
        "- Adult Earth King of Ba Sing Se.\n- Sheltered, formal, well-meaning, and politically isolated inside his palace.\n- Often manipulated by Long Feng and the Dai Li before learning how much has been hidden from him.\n- Relevant when Ba Sing Se politics or Dai Li control enter the active phase.",
    }),
    makeStoryCard({
      id: ids.cards.generalFong,
      title: "General Fong",
      keys: ["General Fong", "Fong"],
      type: "character",
      priority: 28,
      autoUpdate: false,
      content:
        "- Adult Earth Kingdom general obsessed with using the Avatar as a war-winning weapon.\n- Hard, impatient, pragmatic, and willing to endanger people for military advantage.\n- Useful for Earth Kingdom command scenes, anti-Fire Nation strategy, or pressure around Avatar intelligence.\n- Represents the Earth Kingdom's own ruthless military machine.",
    }),
    makeStoryCard({
      id: ids.cards.generalSung,
      title: "General Sung",
      keys: ["General Sung", "Sung"],
      type: "character",
      priority: 26,
      autoUpdate: false,
      content:
        "- Adult Earth Kingdom general tied to Ba Sing Se's defense and outer-wall military command.\n- Formal, cautious, and responsible for holding massive defensive lines.\n- Useful for Ba Sing Se siege reports, Earth Kingdom command briefings, and military opposition to Fire Nation operations.\n- Should feel like an overburdened defender of a city too large to fully understand.",
    }),
    makeStoryCard({
      id: ids.cards.haru,
      title: "Haru",
      keys: ["Haru"],
      type: "character",
      priority: 25,
      autoUpdate: false,
      content:
        "- Adult Earth Kingdom earthbender and resistance-aligned fighter.\n- Brave, grounded, loyal, and shaped by Fire Nation occupation.\n- Useful for Earth Kingdom village scenes, prisoner stories, resistance missions, or civilian costs of the war.\n- Should not appear in Fire Nation capital scenes unless captured, referenced, or tied to a mission.",
    }),
    makeStoryCard({
      id: ids.cards.jet,
      title: "Jet",
      keys: ["Jet", "Freedom Fighter Jet"],
      type: "character",
      priority: 28,
      autoUpdate: false,
      content:
        "- Adult Earth Kingdom rebel and leader of the Freedom Fighters.\n- Charismatic, wounded, reckless, and intensely anti-Fire Nation.\n- Hates the Fire Nation for destroying his home and may target soldiers, nobles, and civilians without much distinction.\n- Useful for missions involving resistance cells, sabotage, moral pressure, or Setu confronting Earth Kingdom hatred mirrored back at him.",
    }),
    makeStoryCard({
      id: ids.cards.jooDee,
      title: "Joo Dee",
      keys: ["Joo Dee", "Joo-Dee"],
      type: "character",
      priority: 22,
      autoUpdate: false,
      content:
        "- Adult Ba Sing Se guide and Dai Li-controlled public face of the city's forced cheer.\n- Polite, smiling, scripted, and unsettling when the lie slips.\n- Useful for Ba Sing Se welcome scenes, surveillance pressure, and the city's artificial calm.\n- Should imply Dai Li control without explaining everything immediately.",
    }),
    makeStoryCard({
      id: ids.cards.kingBumi,
      title: "King Bumi",
      keys: ["Bumi", "King Bumi", "King of Omashu"],
      type: "character",
      priority: 28,
      autoUpdate: false,
      content:
        "- Adult king of Omashu and one of the most powerful earthbenders alive.\n- Eccentric, brilliant, unpredictable, funny, and strategically patient.\n- Uses absurdity to hide ruthless insight and deep loyalty to his city.\n- Relevant through Omashu reports, Earth Kingdom resistance, old war history, or later field missions.",
    }),
    makeStoryCard({
      id: ids.cards.longFeng,
      title: "Long Feng",
      keys: ["Long Feng", "Grand Secretariat Long Feng", "Grand Secretariat"],
      type: "character",
      priority: 28,
      autoUpdate: false,
      content:
        "- Adult Grand Secretariat of Ba Sing Se and secret head of the Dai Li.\n- Controlled, cold, patient, manipulative, and obsessed with preserving order.\n- Uses secrets, surveillance, brainwashing, and bureaucracy as weapons.\n- Should feel like the hand behind Ba Sing Se's smiling lies when that phase becomes active.",
    }),
    makeStoryCard({
      id: ids.cards.masterYu,
      title: "Master Yu",
      keys: ["Master Yu", "Yu"],
      type: "character",
      priority: 22,
      autoUpdate: false,
      content:
        "- Adult Earth Kingdom earthbending teacher from Gaoling.\n- Status-conscious, formal, insecure, and less capable than his reputation suggests.\n- Useful for Gaoling noble scenes, Toph's past, and earthbending society politics.\n- May resent being embarrassed by stronger benders.",
    }),
    makeStoryCard({
      id: ids.cards.xinFu,
      title: "Xin Fu",
      keys: ["Xin Fu"],
      type: "character",
      priority: 20,
      autoUpdate: false,
      content:
        "- Adult Earth Kingdom promoter, bounty hunter, and earthbending tournament operator.\n- Greedy, loud, opportunistic, and willing to sell information or muscle for money.\n- Useful around Gaoling, underground earthbending circuits, bounty work, or Toph-related pressure.\n- Not loyal to the Fire Nation or Earth Kingdom ideals; loyal to leverage and profit.",
    }),
    // ── Lore entries ──────────────────────────────────────────────────────────
    makeStoryCard({
      id: ids.cards.demonFire,
      title: "Demon Fire",
      keys: ["demon fire", "black fire", "black-streaked fire"],
      type: "lore",
      priority: 65,
      autoUpdate: false,
      content:
        "- Setu's rare firebending expression: black-streaked flame of extreme heat.\n- Demon fire burns hotter and more violently than ordinary firebending.\n- Years of wielding demon fire have made Setu unusually resistant to heat and flame.\n- Fire Nation officers treat demon fire as a strategic weapon.\n- Nobles treat it as either divine favor, military destiny, or something they should fear politely.",
    }),
    makeStoryCard({
      id: ids.cards.royalSpecialOps,
      title: "Royal Special Operations",
      keys: ["Royal Special Operations", "special operations", "royal writ"],
      type: "lore",
      priority: 60,
      autoUpdate: false,
      content:
        "- Fire Nation military assignment for elite, politically sensitive missions under royal authority.\n- Setu serves under royal writ as a Royal Special Operations commander.\n- Missions may involve intelligence recovery, sabotage, rebel suppression, royal escort, spy hunts, and operations tied to Azula or Nyxa.\n- Royal Special Operations answers upward through palace authority, not ordinary field bureaucracy.",
    }),
    makeStoryCard({
      id: ids.cards.earthKingdomPressure,
      title: "Earth Kingdom Pressure",
      keys: ["Earth Kingdom assassins", "Ba Sing Se"],
      type: "lore",
      priority: 58,
      autoUpdate: false,
      content:
        "- Earth Kingdom assassins killed Setu's parents, shaping his hatred of the Earth Kingdom.\n- In Phase 1, Ba Sing Se should remain a looming future target, not the current active mission.\n- Earth Kingdom pressure may appear through war reports, spies, captured agents, military briefings, and Setu's resentment.\n- Keep Earth Kingdom enemies specific when possible: assassins, spies, rebels, officers, or Dai Li contacts.",
    }),
    makeStoryCard({
      id: ids.cards.teamAvatarRumors,
      title: "Team Avatar Rumors",
      keys: ["Team Avatar", "Avatar", "Aang", "Katara", "Sokka", "Toph"],
      type: "lore",
      priority: 48,
      autoUpdate: false,
      content:
        "- Team Avatar is not yet directly involved in Setu's story.\n- Reports say the Avatar travels with Katara, Sokka, and a blind earthbending prodigy named Toph.\n- Fire Nation officials treat these reports as rumor, embarrassment, military intelligence, or propaganda risk.\n- Do not force Team Avatar into scenes until the story advances beyond capital pressure or a mission naturally intersects them.",
    }),
    makeStoryCard({
      id: ids.cards.earthKingdom,
      title: "Earth Kingdom",
      keys: ["Earth Kingdom", "Earth Kingdom army", "Earth Kingdom soldiers"],
      type: "lore",
      priority: 42,
      autoUpdate: false,
      content:
        "- Vast nation at war with the Fire Nation.\n- Includes occupied villages, resistance cells, generals, nobles, massive cities, refugees, and Ba Sing Se politics.\n- Setu hates the Earth Kingdom because Earth Kingdom assassins killed his parents.\n- Use specific people and places when possible instead of vague Earth Kingdom enemies.",
    }),
    makeStoryCard({
      id: ids.cards.northernWaterTribe,
      title: "Northern Water Tribe",
      keys: ["Northern Water Tribe", "North Pole", "Northern Water Tribe warriors", "Northern Water Tribe fleet"],
      type: "lore",
      priority: 28,
      autoUpdate: false,
      content:
        "- Major Water Tribe power centered at the North Pole.\n- Known for waterbending tradition, ice architecture, warriors, healers, and spiritual ties to moon and ocean.\n- In this scenario, it should mostly appear through intelligence, war history, waterbending context, or later missions.\n- Do not drag Northern Water Tribe NPCs into Fire Nation capital scenes without a reason.",
    }),
    // ── Fire Nation locations ─────────────────────────────────────────────────
    makeStoryCard({
      id: ids.cards.fireNationCapital,
      title: "Fire Nation Capital",
      keys: ["Fire Nation Capital", "Capital City", "Capital Island"],
      type: "location",
      priority: 46,
      autoUpdate: false,
      content:
        "- Fire Nation capital on Capital Island: seat of royal power, military command, noble politics, propaganda, and elite training.\n- Current main setting for Phase 1.\n- Use the capital for palace scenes, dueling courts, war ministry meetings, harbor deployments, noble pressure, academy training, and royal ceremonies.\n- The capital should feel wealthy, hot, disciplined, dangerous, and politically suffocating.",
    }),
    makeStoryCard({
      id: ids.cards.hariBulkan,
      title: "Hari Bulkan / Royal Caldera City",
      keys: ["Hari Bulkan", "Royal Caldera", "Royal Caldera City"],
      type: "location",
      priority: 45,
      autoUpdate: false,
      content:
        "- Elite caldera district of the Fire Nation capital where royal authority and noble power concentrate.\n- Contains palace-adjacent estates, dueling spaces, formal gardens, military galleries, and noble residences.\n- Setu, Nyxa, Azula, Mai, and Ty Lee often cross paths here through training, court expectation, and royal missions.\n- Scenes here should feel beautiful, expensive, watched, and dangerous.",
    }),
    makeStoryCard({
      id: ids.cards.royalPalace,
      title: "Fire Nation Royal Palace",
      keys: ["Royal Palace", "Fire Nation Royal Palace", "palace"],
      type: "location",
      priority: 44,
      autoUpdate: false,
      content:
        "- Residence of Fire Lord Ozai and the royal family inside the Fire Nation capital.\n- Center of government, royal command, ceremonies, private chambers, guarded halls, and lethal family politics.\n- Setu has access through noble status, military usefulness, and his connection to Nyxa and Azula.\n- Palace scenes should mix beauty, control, intimidation, etiquette, and implied violence.",
    }),
    makeStoryCard({
      id: ids.cards.royalAcademy,
      title: "Royal Fire Academy",
      keys: ["Royal Fire Academy", "Fire Academy", "academy"],
      type: "location",
      priority: 40,
      autoUpdate: false,
      content:
        "- Elite Fire Nation training institution for noble, military, and royal firebenders.\n- Setu, Nyxa, and Azula have history here through training, rivalry, reputation, and instructor scrutiny.\n- Use the academy for sparring, tests, old rivalries, doctrine, military expectation, and public displays of talent.\n- The academy teaches discipline, conquest, hierarchy, and firebending excellence.",
    }),
    makeStoryCard({
      id: ids.cards.warMinistry,
      title: "Fire Nation War Ministry",
      keys: ["War Ministry", "Fire Nation War Ministry", "ministry"],
      type: "location",
      priority: 38,
      autoUpdate: false,
      content:
        "- Bureaucratic and military planning center in the Fire Nation capital.\n- Officers, nobles, ministers, and royal agents debate strategy, missions, propaganda, and resource allocation.\n- Setu may receive special operations orders here.\n- Use the War Ministry for mission briefings, political pressure, reports about Team Avatar, and Earth Kingdom strategy.",
    }),
    // ── Water Tribe locations ─────────────────────────────────────────────────
    makeStoryCard({
      id: ids.cards.agnaQelA,
      title: "Agna Qel'a",
      keys: ["Agna Qel'a", "Northern Water Tribe capital", "North Pole capital"],
      type: "location",
      priority: 25,
      autoUpdate: false,
      content:
        "- Capital city of the Northern Water Tribe at the North Pole.\n- Built from ice canals, walls, bridges, and defended waterways.\n- Home of Chief Arnook, Princess Yue, and Master Pakku.\n- Relevant through war reports, waterbending lore, spiritual stakes, or later Water Tribe arcs.",
    }),
    makeStoryCard({
      id: ids.cards.spiritOasis,
      title: "Spirit Oasis",
      keys: ["Spirit Oasis", "Northern Spirit Oasis", "Moon Spirit", "Ocean Spirit"],
      type: "location",
      priority: 22,
      autoUpdate: false,
      content:
        "- Sacred oasis in the Northern Water Tribe tied to the Moon Spirit and Ocean Spirit.\n- Spiritual place of balance, vulnerability, and enormous symbolic importance.\n- Use carefully for major spiritual or war stakes, not casual scene dressing.\n- Fire Nation interest in this place should feel dangerous and sacrilegious.",
    }),
    // ── Earth Kingdom locations ───────────────────────────────────────────────
    makeStoryCard({
      id: ids.cards.baSingSe,
      title: "Ba Sing Se",
      keys: ["Ba Sing Se", "Lower Ring", "Middle Ring", "Upper Ring", "Outer Wall", "Inner Wall"],
      type: "location",
      priority: 30,
      autoUpdate: false,
      content:
        "- Massive Earth Kingdom capital city protected by enormous walls and controlled public order.\n- Future major mission location, not the active Phase 1 setting unless the story advances.\n- Contains the Lower Ring, Middle Ring, Upper Ring, Earth King's Palace, Lake Laogai, refugees, nobles, bureaucracy, and Dai Li control.\n- Should feel huge, layered, controlled, and full of smiling lies.",
    }),
    makeStoryCard({
      id: ids.cards.earthKingsPalace,
      title: "Earth King's Palace",
      keys: ["Earth King's Palace", "Earth King Palace", "Kuei's palace"],
      type: "location",
      priority: 22,
      autoUpdate: false,
      content:
        "- Formal palace of Earth King Kuei in Ba Sing Se's Upper Ring.\n- Beautiful, ceremonial, isolated, and politically manipulated by Long Feng and the Dai Li.\n- Useful for Ba Sing Se court scenes, deception, diplomacy, and Dai Li-controlled access.",
    }),
    makeStoryCard({
      id: ids.cards.omashu,
      title: "Omashu",
      keys: ["Omashu", "City of Omashu"],
      type: "location",
      priority: 25,
      autoUpdate: false,
      content:
        "- Major Earth Kingdom city ruled by King Bumi.\n- Built into a mountain with delivery chutes, strange engineering, and strong earthbending defenses.\n- Relevant through war reports, field missions, Earth Kingdom resistance, or Bumi-linked developments.",
    }),
    makeStoryCard({
      id: ids.cards.gaoling,
      title: "Gaoling",
      keys: ["Gaoling", "Gaoling town", "Beifong estate"],
      type: "location",
      priority: 20,
      autoUpdate: false,
      content:
        "- Wealthy Earth Kingdom town connected to Toph Beifong's noble family and earthbending tournament culture.\n- Useful for Toph's background, noble Earth Kingdom politics, underground bending, and bounty hunters.\n- Should not pull focus until Earth Kingdom field missions or Team Avatar contact matter.",
    }),
    makeStoryCard({
      id: ids.cards.lakeLaogai,
      title: "Lake Laogai",
      keys: ["Lake Laogai", "Laogai"],
      type: "location",
      priority: 20,
      autoUpdate: false,
      content:
        "- Secret Dai Li brainwashing and detention site beneath Ba Sing Se.\n- Associated with disappearances, conditioning, surveillance, and the city's hidden violence.\n- Use as a later Ba Sing Se threat or discovery, not as Phase 1 capital content.",
    }),
    makeStoryCard({
      id: ids.cards.serpentsPass,
      title: "Serpent's Pass",
      keys: ["Serpent's Pass"],
      type: "location",
      priority: 22,
      autoUpdate: false,
      content:
        "- Dangerous route toward Ba Sing Se used by refugees and travelers.\n- Useful for Earth Kingdom travel, refugee pressure, military pursuit, and the cost of the war.\n- A good transition location when the story moves from missions toward Ba Sing Se.",
    }),
    makeStoryCard({
      id: ids.cards.siWongDesert,
      title: "Si Wong Desert",
      keys: ["Si Wong Desert", "desert", "library desert"],
      type: "location",
      priority: 20,
      autoUpdate: false,
      content:
        "- Huge Earth Kingdom desert associated with harsh travel, sandbenders, secrets, and dangerous isolation.\n- Useful for later missions, Avatar intelligence, lost knowledge, or pursuit across hostile terrain.\n- Do not use as active Phase 1 setting unless a mission deliberately goes there.",
    }),
  ];

  const brains = [
    makeBrain({
      id: ids.brains.setu,
      characterName: "Setu Renzan",
      aliases: ["Setu", "Renzan"],
      triggers: ["Setu", "Renzan", "demon fire"],
      priority: 60,
      currentState: "Guarded, disciplined, and alert under royal scrutiny.",
      thoughts: {
        renzan_worth:
          "turn0 → I want to prove House Renzan still matters without becoming a decorative weapon for Ozai's court.",
      },
      relationshipPressure:
        "He respects Azula's command, navigates Nyxa's volatility, and notices how Mai and Ty Lee read what he tries to hide.",
      emotionalInterpretation:
        "Grief is converted into loyalty and precision. Earth Kingdom hatred is real but may be covering older uncertainty.",
      recentDevelopments: "Dueling court opening. Nyxa just challenged him again in front of an audience.",
      updateMode: "append",
      updateCondition:
        "when Setu makes a meaningful choice, shows grief, escalates rivalry, changes loyalty, or is pressured by Azula, Nyxa, Mai, Ty Lee, Ozai, or the court",
    }),
    makeBrain({
      id: ids.brains.azula,
      characterName: "Azula",
      aliases: ["Princess Azula", "Azula"],
      triggers: ["Azula", "blue fire"],
      priority: 58,
      currentState: "In command, testing every person in the room.",
      thoughts: {
        setu_assessment: "turn0 → Setu's power is useful, but useful things become dangerous when other people admire them.",
      },
      relationshipPressure: "She expects obedience from Mai and Ty Lee and rivalry from Nyxa.",
      emotionalInterpretation: "Control is safety. Curiosity appears as challenge.",
      recentDevelopments: "Watching the dueling court from the gallery. Evaluating.",
      updateMode: "append",
      updateCondition:
        "when Azula appears, exerts control, reacts to Setu's talent, faces Nyxa's rivalry, or adjusts a mission plan",
    }),
    makeBrain({
      id: ids.brains.nyxa,
      characterName: "Nyxa",
      aliases: ["Nyx", "Princess Nyxa"],
      triggers: ["Nyxa", "Nyx", "Ozai's second daughter"],
      priority: 56,
      currentState: "Restless, sharp, and hungry to be seen as more than Azula's spare shadow.",
      thoughts: {
        setu_loyalty: "turn0 → If Setu is the court's new blade, I want to know whether he cuts for me, Azula, or himself.",
      },
      relationshipPressure: "Her rivalry with Azula turns every interaction with Setu into a test.",
      emotionalInterpretation: "Pride, loneliness, and ambition move too close together.",
      recentDevelopments: "Just called for another round in the dueling court. Enjoying the audience.",
      updateMode: "append",
      updateCondition:
        "when Nyxa is meaningfully referenced, loses control, competes with Azula, or develops a new reaction to Setu",
    }),
    makeBrain({
      id: ids.brains.mai,
      characterName: "Mai",
      aliases: ["Mai"],
      triggers: ["Mai", "knives"],
      priority: 40,
      currentState: "Outwardly bored, privately attentive.",
      thoughts: {
        court_tension: "turn0 → Court drama is tedious until someone reaches for a knife without moving their hand.",
      },
      relationshipPressure: "Mai is loyal to the circle but skeptical of being used as scenery in royal games.",
      emotionalInterpretation: "Flat affect conceals exact judgment.",
      recentDevelopments: "Watching Setu, Azula, and Nyxa from a pillar in the dueling court.",
      updateMode: "append",
    }),
    makeBrain({
      id: ids.brains.tyLee,
      characterName: "Ty Lee",
      aliases: ["Ty Lee"],
      triggers: ["Ty Lee", "chi blocking"],
      priority: 40,
      currentState: "Warm, alert, and physically relaxed in a way that makes danger look harmless.",
      thoughts: {
        breath_read: "turn0 → People reveal themselves through breath before words.",
      },
      relationshipPressure: "Ty Lee balances friendship, survival, and the emotional weather around Azula.",
      emotionalInterpretation: "Brightness can be camouflage and kindness at the same time.",
      recentDevelopments: "Sitting cross-legged beside Mai, reading the dueling court's tension.",
      updateMode: "append",
    }),
  ];

  const quest = makeQuest({
    id: ids.quest,
    title: "Opening Arc: Ashes Under the Crown",
    description:
      "Navigate the Royal Caldera's training gauntlet, the first special mission, and the court consequences without letting Setu become someone else's pawn.",
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
          "Current objective: survive the training session and political pressure of the dueling court, then prepare for Azula's mission briefing.",
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
    relatedCards: [ids.cards.nyxa, ids.cards.royalPalace],
  });

  const triggerRules = [
    makeTriggerRule({
      id: ids.triggers.betrothal,
      name: "Betrothal Pressure Shifts",
      evaluationMode: "semantic",
      condition:
        "when romance, jealousy, public favor, courtship, engagement, or marriage politics around Setu materially changes",
      actions: [{ type: "updateStoryCard", storyCardId: ids.cards.nyxa }],
      priority: 70,
      cooldownTurns: 1,
      updatePrompt:
        "Update the Princess Nyxa story card with any new durable detail about how betrothal pressure or romantic tension with Setu has shifted. Return ONLY the concise replacement card content.",
    }),
    makeTriggerRule({
      id: ids.triggers.nyxa,
      name: "Nyxa Volatility Changes",
      evaluationMode: "semantic",
      condition:
        "when Nyxa's rivalry, jealousy, ambition, vulnerability, or attitude toward Setu changes in a lasting way",
      actions: [{ type: "appendBrain", brainId: ids.brains.nyxa }],
      priority: 65,
      cooldownTurns: 1,
      updatePrompt:
        "You are modeling Nyxa's internal state. Return ONLY valid JSON with keys that changed: currentState, thoughts, relationshipPressure, emotionalInterpretation, recentDevelopments. Every value must be a plain string; do not return nested objects or arrays.",
    }),
    makeTriggerRule({
      id: ids.triggers.avatar,
      name: "Avatar Rumor Escalates",
      evaluationMode: "semantic",
      condition:
        "when new information about Team Avatar, the Avatar's location, or rebel movements becomes relevant to the mission",
      actions: [{ type: "updateStoryCard", storyCardId: ids.cards.teamAvatarRumors }],
      priority: 55,
      cooldownTurns: 1,
    }),
    makeTriggerRule({
      id: ids.triggers.enemy,
      name: "Powerful Enemy Made",
      evaluationMode: "semantic",
      condition:
        "when Setu, Azula, Nyxa, Mai, or Ty Lee make a powerful enemy, reveal a dangerous rival, or create a new recurring threat",
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
    openingScene: openingText,
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
        "Setu Renzan, adult heir of the murdered noble House Renzan, stands in the dueling court beneath the Royal Palace. His demon fire — black-streaked flame of extreme heat — still crawls along the stone. Across from him, Princess Nyxa grins and calls for another round. Azula watches from the gallery. Mai leans against a pillar. Ty Lee sits nearby, smiling. The court is quiet and watching. Everyone is trying to understand what Setu and Nyxa are to each other.",
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
