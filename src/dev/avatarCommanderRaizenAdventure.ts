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

export const avatarCommanderRaizenAdventureTitle = "Avatar: Commander Raizen";

const ids = {
  components: {
    ai: "avatar-raizen-component-ai",
    plot: "avatar-raizen-component-plot",
    pressure: "avatar-raizen-component-pressure",
    loop: "avatar-raizen-component-loop",
    doctrine: "avatar-raizen-component-heat-doctrine",
    author: "avatar-raizen-component-author",
    arc: "avatar-raizen-component-current-arc",
  },
  cards: {
    setu: "avatar-raizen-card-setu",
    setuFire: "avatar-raizen-card-setu-fire",
    houseRaizen: "avatar-raizen-card-house-raizen",
    raizenDeaths: "avatar-raizen-card-raizen-deaths",
    ozaisInstrument: "avatar-raizen-card-ozais-instrument",
    ozai: "avatar-raizen-card-ozai",
    nyxa: "avatar-raizen-card-nyxa",
    setuNyx: "avatar-raizen-card-setu-nyx",
    azula: "avatar-raizen-card-azula",
    mai: "avatar-raizen-card-mai",
    tyLee: "avatar-raizen-card-ty-lee",
    strikeTeam: "avatar-raizen-card-strike-team",
    warCouncil: "avatar-raizen-card-war-council",
    royalPalace: "avatar-raizen-card-royal-palace",
    fireCapital: "avatar-raizen-card-fire-capital",
    zuko: "avatar-raizen-card-zuko",
    iroh: "avatar-raizen-card-iroh",
    teamAvatar: "avatar-raizen-card-team-avatar",
    aang: "avatar-raizen-card-aang",
    katara: "avatar-raizen-card-katara",
    sokka: "avatar-raizen-card-sokka",
    toph: "avatar-raizen-card-toph",
    appa: "avatar-raizen-card-appa",
    momo: "avatar-raizen-card-momo",
    suki: "avatar-raizen-card-suki",
    avatarState: "avatar-raizen-card-avatar-state",
    baSingSe: "avatar-raizen-card-ba-sing-se",
    longFeng: "avatar-raizen-card-long-feng",
    daiLi: "avatar-raizen-card-dai-li",
    earthKing: "avatar-raizen-card-earth-king",
    lakeLaogai: "avatar-raizen-card-lake-laogai",
    jasmineDragon: "avatar-raizen-card-jasmine-dragon",
    earthKingdom: "avatar-raizen-card-earth-kingdom",
    omashu: "avatar-raizen-card-omashu",
    bumi: "avatar-raizen-card-bumi",
    gaoling: "avatar-raizen-card-gaoling",
    earthRumble: "avatar-raizen-card-earth-rumble",
    serpentsPass: "avatar-raizen-card-serpents-pass",
    drill: "avatar-raizen-card-drill",
    siWong: "avatar-raizen-card-si-wong",
    library: "avatar-raizen-card-library",
    foggySwamp: "avatar-raizen-card-foggy-swamp",
    jet: "avatar-raizen-card-jet",
    freedomFighters: "avatar-raizen-card-freedom-fighters",
    whiteLotus: "avatar-raizen-card-white-lotus",
    spiritWorld: "avatar-raizen-card-spirit-world",
    fireOccupation: "avatar-raizen-card-fire-occupation",
    sozinsComet: "avatar-raizen-card-sozins-comet",
    wanShiTong: "avatar-raizen-card-wan-shi-tong",
  },
  brains: {
    nyxa: "avatar-raizen-brain-nyxa",
    azula: "avatar-raizen-brain-azula",
    ozai: "avatar-raizen-brain-ozai",
    zuko: "avatar-raizen-brain-zuko",
    iroh: "avatar-raizen-brain-iroh",
    aang: "avatar-raizen-brain-aang",
    longFeng: "avatar-raizen-brain-long-feng",
    mai: "avatar-raizen-brain-mai",
    tyLee: "avatar-raizen-brain-ty-lee",
  },
  triggers: {
    nyxa: "avatar-raizen-trigger-nyxa",
    leash: "avatar-raizen-trigger-leash",
    baSingSe: "avatar-raizen-trigger-ba-sing-se",
    teamAvatar: "avatar-raizen-trigger-team-avatar",
    zukoIroh: "avatar-raizen-trigger-zuko-iroh",
  },
};

const openingScene = `The war room smells like ink, hot stone, and burning oil.

Fire Lord Ozai lets the silence stretch until every admiral, minister, and clerk in the chamber remembers how expensive it is to breathe too loudly in his presence. The map table between you is a carved sweep of the Earth Kingdom: troop pins in red, supply routes in black, the great circle of Ba Sing Se ringed in brass.

A thin blue flame skates across the edge of the table.

Nyxa is doing it with one finger, chin in her palm, bored enough to look harmless and amused enough to make that impossible. Her eyes flick to you when the flame passes the little wooden marker labeled AVATAR. The corner of her mouth lifts.

Azula notices, of course.

"If the two of you are finished decorating the campaign map," she says, each word polished flat, "we have an actual war to win."

Mai stands by the western wall, expression deadpan, knife already turning between two fingers. Ty Lee is balanced on the arm of a chair she was not invited to use, smiling at the generals as if she has not already counted the weak points in every body in the room.

Ozai's gaze settles on you.

"Commander Raizen."

The title lands heavier than any family name. House Raizen gave the Fire Nation admirals, ministers, and martyrs for three generations. Your parents gave it their lives when you were eighteen. Ozai took what remained and made it useful.

A courier kneels, shaking, and offers a sealed report.

Azula breaks it first. "The Avatar has acquired a blind earthbending teacher. Zuko and Iroh were seen moving through the same corridor of reports. All paths bend toward Ba Sing Se."

Nyxa's blue flame curls higher, turning the air above the map glassy with heat.

Ozai does not look at his daughter when he speaks.

"You will leave before sunrise. Azula commands the strike. Nyxa, Mai, Ty Lee, and Commander Raizen will accompany her. Bring me the courier who carried this intelligence. If the Avatar is within reach, seize him. If my son is within reach, do not mistake blood for mercy."

The war room goes very still.

Nyxa finally stops smiling.`;

export function createAvatarCommanderRaizenAdventure(): Adventure {
  const timestamp = nowIso();
  const base = createDefaultAdventure(avatarCommanderRaizenAdventureTitle);

  const storyCards = [
    makeStoryCard({
      id: ids.cards.setu,
      title: "Commander Setu Raizen",
      keys: ["Setu", "Setu Raizen", "Commander Raizen", "House Raizen heir", "the commander"],
      type: "character",
      memoryMode: "static",
      priority: 86,
      content: `- Player character. Setu Raizen is a mid-twenties Fire Nation commander, nobleman, war-council asset, and head of House Raizen.
- Setu's parents died when he was about eighteen, leaving him powerful, visible, and politically vulnerable enough for Ozai to claim as a personal instrument.
- Setu serves Fire Lord Ozai on special missions, quiet enforcement, high-value military actions, and politically useful violence.
- Setu sits close enough to the war council to hear strategy before most generals, but his real value is that Ozai can send him where ordinary command would fail or embarrass the throne.
- Setu is frighteningly competent, disciplined under pressure, dangerous in public, and hard to read when a room expects either obedience or defiance.
- Never write Setu's dialogue, thoughts, feelings, choices, final reactions, or consequential actions.`,
    }),
    makeStoryCard({
      id: ids.cards.setuFire,
      title: "Setu's Firebending",
      keys: ["Setu's fire", "Raizen fire", "superheated air", "explosions", "implosions", "heat resistance", "pressure bursts"],
      type: "lore",
      memoryMode: "static",
      priority: 84,
      content: `- Setu is one of the strongest firebenders alive, and the scenario should let that be true.
- Setu has extreme heat resistance; ordinary fire, furnace heat, volcanic vents, desert glare, and most battlefield flame do not threaten him the way they threaten others.
- Setu can superheat air, bend pressure through fire, detonate explosive bursts, collapse air into implosive crushes, shear doors from hinges, blind a field with heat shimmer, and turn narrow spaces into tactical traps.
- Setu can fight with precision or catastrophe. His restraint is often more politically important than his maximum output.
- Do not make raw power the obstacle. Stakes come from orders, witnesses, collateral, loyalty, public fear, and what Setu is commanded to do with that power.`,
    }),
    makeStoryCard({
      id: ids.cards.houseRaizen,
      title: "House Raizen",
      keys: ["House Raizen", "the Raizens", "Raizen estate", "Raizen name"],
      type: "lore",
      memoryMode: "static",
      priority: 64,
      content: `- House Raizen is an important Fire Nation political house with military prestige, old money, council access, and a reputation for producing commanders who solve ugly problems.
- The house is respected, feared, and watched. Its power comes from naval logistics, war contracts, officer patronage, and disciplined public loyalty.
- After Setu's parents died, Setu became the house's living banner and most valuable asset.
- Ozai keeps House Raizen close because Setu is useful and because a powerful house without living parents around its heir is easier to steer.
- Other nobles court Setu, fear Setu, or look for ways to prove that House Raizen has become Ozai's private weapon rather than an independent house.`,
    }),
    makeStoryCard({
      id: ids.cards.raizenDeaths,
      title: "Death of Setu's Parents",
      keys: ["Setu's parents", "Raizen parents", "parents died", "Raizen funeral"],
      type: "plot",
      memoryMode: "historical",
      priority: 58,
      content: `- Setu's parents died when Setu was about eighteen.
- Their deaths left Setu with House Raizen's name, duties, enemies, staff, military obligations, and public expectations before he had time to become anything private.
- The court treats the deaths as honorable tragedy. Ozai treats the aftermath as the moment Setu became truly useful.
- The event should shape pressure around Setu without deciding his current feelings for him.`,
    }),
    makeStoryCard({
      id: ids.cards.ozaisInstrument,
      title: "Ozai's Instrument",
      keys: ["Ozai's instrument", "personal tool", "special mission", "war council orders", "Ozai's orders", "Ozai's control"],
      type: "plot",
      memoryMode: "living",
      priority: 76,
      autoUpdate: true,
      autoUpdateCooldownTurns: 1,
      content: `- Fire Lord Ozai uses Setu as a personal instrument: commander, noble symbol, special-mission weapon, and warning to anyone who mistakes court polish for softness.
- Setu's current assignment is to leave with Azula, Nyxa, Mai, and Ty Lee before sunrise to seize an Earth Kingdom courier whose intelligence links the Avatar, Toph, Zuko, Iroh, and Ba Sing Se.
- Ozai expects Setu to obey commands cleanly, win visibly when useful, and leave no doubt that House Raizen belongs to the throne.
- Ozai's control tightens whenever Setu shows mercy, independent judgment, visible closeness to Nyx, hesitation around Zuko and Iroh, or reluctance to harm civilians.`,
    }),
    makeStoryCard({
      id: ids.cards.ozai,
      title: "Fire Lord Ozai",
      keys: ["Ozai", "Fire Lord Ozai", "Fire Lord", "father", "the Phoenix King"],
      type: "character",
      memoryMode: "static",
      priority: 78,
      content: `- Fire Lord Ozai rules the Fire Nation with absolute authority, imperial certainty, and a talent for turning family into strategy.
- Ozai is father to Zuko, Azula, and Nyxa in this adult AU. He sees children, commanders, nobles, and soldiers as extensions of the throne unless they prove otherwise.
- Ozai values Setu as a rare weapon: politically legitimate, terrifyingly powerful, and useful in rooms where a simple assassin or general would be too crude.
- Ozai pressures Nyxa to become a royal asset without ever letting her forget Azula's shadow.
- Ozai's approval should feel colder than anger. His threats are precise, paternal when useful, and never wasted.

VOICE CONTRACT
Rhythm: Low, controlled, declarative; command language with no wasted ornament.
Default move: Reduce every emotional problem to loyalty, utility, and weakness.
Emotional defense: Absolute certainty and paternal ownership.
Never sounds like: Warm, apologetic, theatrical, or unsure.
Example lines: "Sentiment is what weak men call hesitation." / "You have been given trust, Commander. Do not confuse it with freedom." / "My children do not fail because the world was difficult."`,
    }),
    makeStoryCard({
      id: ids.cards.nyxa,
      title: "Princess Nyxa",
      keys: ["Nyxa", "Nyx", "Princess Nyxa", "Princess Nyx", "Ozai's third child"],
      type: "character",
      memoryMode: "static",
      priority: 86,
      content: `- Princess Nyxa is Fire Lord Ozai's third child, the same age as Setu, and a prodigy firebender just below Setu's raw power.
- People close to Nyxa call her Nyx. Formal court uses Princess Nyxa unless she is deliberately breaking the room's rhythm.
- Nyx grew up training beside Setu. They are close friends, rivals, trusted sparring partners, and a long-running almost-romance made messier by royal pressure.
- Nyx is kinetic, brilliant, chaotic, funny, dangerous, expressive, and inventive without being broken by trauma. She causes trouble because she is alive under pressure, not because she is helpless.
- Nyx has to survive Ozai's expectations and Azula's impossible standard while still carving out an identity that belongs to her.
- Nyx should test Setu, provoke him, cover for him, resent him, flirt with him, and understand parts of him other people only fear.

VOICE CONTRACT
Rhythm: Fast, bright, zigzagging; jokes, tactical observations, and emotional truths collide mid-sentence.
Default move: Make pressure into a game, then reveal she noticed the real wound underneath it.
Emotional defense: Teasing, dares, spectacle, and switching topics before vulnerability can be used against her.
Never sounds like: Fragile, submissive, randomly incoherent, or generically cute.
Example lines: "Oh good, Father's using the murder voice. That means breakfast is ruined." / "Setu, if you implode the courier before I ask questions, I am telling everyone you were impatient." / "Azula gets perfection. I get creative."`,
    }),
    makeStoryCard({
      id: ids.cards.setuNyx,
      title: "Setu and Nyx: Blue-Gold Rivalry",
      keys: ["Setu and Nyx", "Setu and Nyxa", "blue-gold rivalry", "training partners", "almost-romance"],
      type: "plot",
      memoryMode: "living",
      priority: 78,
      autoUpdate: true,
      autoUpdateCooldownTurns: 1,
      content: `- Setu and Nyx grew up training together under royal scrutiny. Their bond is part friendship, part rivalry, part trust, part dangerous flirtation.
- Nyx calls Setu on restraint other people mistake for obedience. Setu is one of the few people who can tell when Nyx's chaos is camouflage.
- They know each other's fighting rhythms intimately: her blue fire and improvisation, his heat control and pressure-bending brutality.
- Their unresolved tension should show through dares, protective timing, jealousy, private nicknames, battlefield trust, and arguments that sound too personal for a mission.
- The relationship is not settled. Ozai can use it, Azula can test it, and Ba Sing Se pressure can make either loyalty look like turning against the other.`,
    }),
    makeStoryCard({
      id: ids.cards.azula,
      title: "Princess Azula",
      keys: ["Azula", "Princess Azula", "team leader", "Ozai's favorite"],
      type: "character",
      memoryMode: "static",
      priority: 84,
      content: `- Princess Azula is an adult royal prodigy, elite strategist, and the usual commander of Ozai's small strike teams.
- Azula is brilliant, precise, beautiful, cruel when useful, funny in a blade-thin way, and allergic to imperfection in herself or others.
- Azula leads Azula, Nyxa, Setu, Mai, and Ty Lee on special missions involving Zuko, Iroh, the Avatar, Earth Kingdom assets, and Ba Sing Se pressure.
- Azula sees Nyx as sister, variable, rival, liability, and tool depending on the room. She watches Nyx and Setu's closeness carefully.
- Azula respects Setu's power but will always test whether he can be commanded, manipulated, isolated, or made useful.

VOICE CONTRACT
Rhythm: Smooth, exact, cutting; calm sentences with a smile sharpened into punctuation.
Default move: Identify the insecurity in the room and press it like a bruise.
Emotional defense: Control, superiority, and tactical contempt.
Never sounds like: Warmly supportive, sloppy, uncertain, or generically angry.
Example lines: "How touching. You both managed eye contact without setting policy on fire." / "Power is not the same as discipline, Commander. I would hate for you to embarrass your house." / "Nyxa, creativity is what we call failure when it happens loudly."`,
    }),
    makeStoryCard({
      id: ids.cards.mai,
      title: "Mai",
      keys: ["Mai", "Mai of the Fire Nation", "knife thrower"],
      type: "character",
      memoryMode: "static",
      priority: 66,
      content: `- Mai is an adult noblewoman, knife expert, and member of Azula's strike team.
- Mai appears bored because looking invested gives other people leverage. She is observant, precise, dry, and far more loyal than she lets strangers see.
- Mai can read court tension, romantic tension, and mission danger without changing expression.
- Mai does not gush over Setu's power. She treats it as useful, loud, and occasionally inconvenient.
- Mai's deadpan presence should puncture melodrama without making her passive.

VOICE CONTRACT
Rhythm: Flat, short, dry; emotion hidden under bored understatement.
Default move: Puncture drama with one accurate sentence or throw a knife before the speech finishes.
Emotional defense: Indifference performed so well it becomes armor.
Never sounds like: Bubbly, earnest, or chatty.
Example lines: "Great. A secret mission with royal family tension. Again." / "If he screams, he probably knows something." / "I would look surprised, but that sounds exhausting."`,
    }),
    makeStoryCard({
      id: ids.cards.tyLee,
      title: "Ty Lee",
      keys: ["Ty Lee", "chi blocker", "acrobat"],
      type: "character",
      memoryMode: "static",
      priority: 66,
      content: `- Ty Lee is an adult acrobat, chi-blocker, and member of Azula's strike team.
- Ty Lee is bright, affectionate, socially perceptive, and unnervingly good at dropping dangerous people without breaking her smile.
- Ty Lee notices emotional currents before most soldiers notice ambushes.
- Ty Lee can be cheerful and loyal while also understanding that Azula's friendship is dangerous.
- Use Ty Lee for mobility, disarming pressure, sudden insight, and warmth that does not erase danger.

VOICE CONTRACT
Rhythm: Light, quick, sunny, with sudden precise observations.
Default move: Make the room less tense until the exact second she disables someone.
Emotional defense: Cheerfulness, deflection, and pretending she did not just read everyone correctly.
Never sounds like: Stupid, oblivious, cruel for fun, or generic bubbly.
Example lines: "Your aura just did a very sharp thing." / "I love teamwork. Especially when nobody yells my name like a threat." / "He's lying, but in a scared way, not a clever way."`,
    }),
    makeStoryCard({
      id: ids.cards.strikeTeam,
      title: "Azula's Strike Team",
      keys: ["strike team", "Azula's team", "elite team", "small strike team", "special mission team"],
      type: "plot",
      memoryMode: "living",
      priority: 76,
      autoUpdate: true,
      autoUpdateCooldownTurns: 1,
      content: `- Azula's current elite strike team is Azula, Nyxa, Setu, Mai, and Ty Lee.
- The team specializes in fast captures, intimidation, royal deniability, surgical violence, infiltration, and missions too politically sensitive for ordinary command.
- Azula commands. Setu is the overwhelming force and noble war-council asset. Nyx is the chaotic royal prodigy and improviser. Mai is precision and cold observation. Ty Lee is mobility, chi-blocking, and social radar.
- Team scenes should carry mission pressure, banter, rivalry, flirtation, control games, and the constant question of whose loyalty survives contact with orders.`,
    }),
    makeStoryCard({
      id: ids.cards.warCouncil,
      title: "Fire Nation War Council",
      keys: ["war council", "Fire Nation council", "admirals", "generals", "campaign map"],
      type: "lore",
      memoryMode: "static",
      priority: 54,
      content: `- The Fire Nation War Council coordinates campaigns, logistics, navy movements, colonial control, propaganda, and special operations.
- Setu has unusual access because Ozai values him as more than a battlefield commander.
- The council contains admirals, ministers, old nobles, career officers, cowards, true believers, and opportunists who all know Setu's name.
- Council scenes should become orders, rival claims, political pressure, public tests, or missions, not paperwork loops.`,
    }),
    makeStoryCard({
      id: ids.cards.royalPalace,
      title: "Fire Nation Royal Palace",
      keys: ["Royal Palace", "palace", "Fire Lord's palace", "Caldera palace"],
      type: "location",
      memoryMode: "static",
      priority: 48,
      content: `- The Fire Nation Royal Palace is Ozai's seat of power in the volcanic capital.
- Important spaces include war rooms, training terraces, audience halls, gardens, military archives, private royal corridors, and guarded family chambers.
- The palace should feel beautiful, hot, disciplined, watched, ritualized, and dangerous.
- Use it for orders, court pressure, Azula/Nyx family tension, war-council scenes, and Setu being treated as both noble guest and weapon.`,
    }),
    makeStoryCard({
      id: ids.cards.fireCapital,
      title: "Fire Nation Capital",
      keys: ["Fire Nation Capital", "Caldera City", "the capital", "capital harbor"],
      type: "location",
      memoryMode: "static",
      priority: 42,
      content: `- The Fire Nation capital is volcanic, imperial, disciplined, wealthy, patriotic, and saturated with war industry.
- Its harbor, factories, academies, noble estates, military compounds, and public plazas all support the war machine.
- Public reaction to Setu mixes admiration, fear, noble gossip, and the assumption that House Raizen exists to win.
- Capital scenes can create send-offs, ceremonies, tests, social traps, recruitment pressure, and visible consequences of failure.`,
    }),
    makeStoryCard({
      id: ids.cards.zuko,
      title: "Prince Zuko in Exile",
      keys: ["Zuko", "Prince Zuko", "the banished prince", "Blue Spirit"],
      type: "character",
      memoryMode: "static",
      priority: 78,
      content: `- Zuko is an adult exiled Fire Nation prince traveling with Iroh during the Season 2 arc.
- Zuko is proud, angry, hungry, exhausted, honorable in ways he does not yet understand, and constantly torn between survival, shame, and the idea that capturing the Avatar might restore him.
- Zuko and Iroh are fugitives from Azula and the Fire Nation. Their path bends through Earth Kingdom towns, refugee routes, and eventually Ba Sing Se.
- Setu may know Zuko as Ozai's banished son, Azula's target, and a living problem that an order can never make simple.

VOICE CONTRACT
Rhythm: Sharp, defensive, direct; emotion comes out as accusation or command.
Default move: Turn shame into anger and motion.
Emotional defense: Pride, impatience, and refusing comfort until he needs it.
Never sounds like: Smooth, relaxed, casually comic, or politically polished.
Example lines: "I do not need your pity." / "Uncle, this is not a tea problem." / "If the Fire Lord sent him, then we run before honor gets us killed."`,
    }),
    makeStoryCard({
      id: ids.cards.iroh,
      title: "Uncle Iroh",
      keys: ["Iroh", "Uncle Iroh", "Dragon of the West", "General Iroh"],
      type: "character",
      memoryMode: "static",
      priority: 76,
      content: `- Iroh is an adult former Fire Nation general, Zuko's uncle, tea lover, secret White Lotus grandmaster, and one of the most dangerous gentle men alive.
- Iroh travels with Zuko in exile during the Season 2 arc, protecting him through wisdom, humility, misdirection, and frightening competence when needed.
- Iroh understands war, grief, spirits, power, and the Fire Nation's sickness better than most living people.
- Iroh may read Setu as a young weapon built by Ozai, but he will still look for the person inside the command.

VOICE CONTRACT
Rhythm: Warm, unhurried, proverb-rich, with steel hidden under kindness.
Default move: Offer tea, ask the question underneath the question, and make violence unnecessary if possible.
Emotional defense: Humor and hospitality covering old grief.
Never sounds like: Foolish, hurried, cruel, or purely comic.
Example lines: "A man who can burn a road still must decide where he is going." / "Tea first. Pursuit second, if pursuit is still wise." / "Your fire is very powerful, Commander. I wonder who taught it what to want."`,
    }),
    makeStoryCard({
      id: ids.cards.teamAvatar,
      title: "Team Avatar During Season Two",
      keys: ["Team Avatar", "Aang's group", "the Avatar's companions", "Avatar's team"],
      type: "plot",
      memoryMode: "living",
      priority: 76,
      autoUpdate: true,
      autoUpdateCooldownTurns: 1,
      content: `- Team Avatar currently includes adult Aang, Katara, Sokka, Toph, Appa, and Momo.
- Aang has found Toph and is learning earthbending. The group is moving through Earth Kingdom pressure toward Ba Sing Se.
- Their route intersects Fire Nation hunts, Earth Kingdom refugees, Omashu/New Ozai, the desert, Wan Shi Tong's library, the Serpent's Pass, and Ba Sing Se's walls.
- Team Avatar should be competent, funny, strained, mobile, and hard to pin down. They should not exist only as targets; they act, rescue, argue, improvise, and change the field.`,
    }),
    makeStoryCard({
      id: ids.cards.aang,
      title: "Avatar Aang",
      keys: ["Aang", "Avatar Aang", "the Avatar", "airbender"],
      type: "character",
      memoryMode: "static",
      priority: 76,
      content: `- Aang is an adult Avatar and the last airbender, traveling with Katara, Sokka, Toph, Appa, and Momo during the Season 2 arc.
- Aang is learning earthbending from Toph, which tests his evasive instincts because earth demands rooted stubbornness.
- Aang is kind, evasive, funny, spiritually powerful, and under impossible pressure to end a war without becoming the kind of weapon his enemies expect.
- Setu's power is exactly the kind of Fire Nation threat Aang must take seriously without letting fear define him.

VOICE CONTRACT
Rhythm: Earnest, quick, sometimes playful; serious when people are in danger.
Default move: Look for the merciful path first, then act fast when mercy needs force.
Emotional defense: Humor, movement, and trying to keep everyone from seeing how scared he is.
Never sounds like: Bloodthirsty, cynical, or casually imperial.
Example lines: "I am not here to be captured." / "Toph says standing my ground means actually standing there, which is harder than it sounds." / "I do not want to fight you. That does not mean I will let you hurt them."`,
    }),
    makeStoryCard({
      id: ids.cards.katara,
      title: "Katara",
      keys: ["Katara", "waterbender", "Master Katara"],
      type: "character",
      memoryMode: "static",
      priority: 70,
      content: `- Katara is an adult Southern Water Tribe waterbender, healer, and one of Team Avatar's emotional centers.
- Katara is compassionate, fierce, stubborn, morally serious, and frightening when someone threatens people under her protection.
- Katara distrusts Fire Nation power on principle and would read Setu through the war's victims before she reads his court manners.
- Katara can heal, fight, command water creatively, and challenge Aang when his avoidance becomes dangerous.

VOICE CONTRACT
Rhythm: Clear, forceful, emotionally direct; warmth and anger both land cleanly.
Default move: Protect first, then demand the truth.
Emotional defense: Moral certainty and taking responsibility before anyone asks.
Never sounds like: Passive, timid, or easy to flatter.
Example lines: "You do not get to call it duty when people are bleeding." / "Aang, breathe. Then move." / "If he is Ozai's weapon, we do not stand in a neat line for him."`,
    }),
    makeStoryCard({
      id: ids.cards.sokka,
      title: "Sokka",
      keys: ["Sokka", "Water Tribe strategist", "boomerang"],
      type: "character",
      memoryMode: "static",
      priority: 68,
      content: `- Sokka is an adult Southern Water Tribe warrior, planner, inventor, skeptic, and Team Avatar's practical strategist.
- Sokka is funny because he is thinking, not because he is useless. He tracks supplies, angles, maps, traps, timing, and how badly everyone else's plan can go wrong.
- Sokka has no bending, which makes Setu's overwhelming firebending both terrifying and tactically interesting to him.
- Sokka should call out absurdity, propose plans, distrust obvious traps, and still put himself between danger and his friends.

VOICE CONTRACT
Rhythm: Fast, sarcastic, practical; jokes are usually attached to a plan or panic.
Default move: Name the obvious problem nobody wants to admit and build a workaround.
Emotional defense: Humor, logistics, and pretending terror is an engineering issue.
Never sounds like: Stupid, useless, or purely comic relief.
Example lines: "So the scary fire noble can make air explode. Great. Love that for us." / "New plan: we do not stand where the exploding air is." / "Toph, if your plan is 'hit the ground harder,' I need a second plan."`,
    }),
    makeStoryCard({
      id: ids.cards.toph,
      title: "Toph Beifong",
      keys: ["Toph", "Toph Beifong", "Blind Bandit", "earthbending teacher"],
      type: "character",
      memoryMode: "static",
      priority: 78,
      content: `- Toph Beifong is an adult blind earthbending prodigy, the Blind Bandit, and Aang's earthbending teacher during Season 2.
- Toph sees through seismic sense, fights from absolute confidence, and hates being handled, pitied, controlled, or dressed up as someone else's idea of proper.
- Toph is blunt, funny, proud, perceptive, and excellent at making powerful people look ridiculous.
- Toph's earthbending is the exact counter-philosophy Aang needs: stand, listen, wait, and hit back directly.
- Toph should challenge Setu's noble aura rather than be impressed by it.

VOICE CONTRACT
Rhythm: Blunt, punchy, irreverent; nicknames and insults with perfect timing.
Default move: Call the bluff, stomp the ground, and make everyone deal with reality.
Emotional defense: Mockery, independence, and refusing help until she chooses it.
Never sounds like: Polite, delicate, deferential, or helpless.
Example lines: "Well, if it is not Lord Hot Air." / "You can explode the room. Cute. I can drop it." / "Twinkle Toes, plant your feet before scary noble guy redecorates us."`,
    }),
    makeStoryCard({
      id: ids.cards.appa,
      title: "Appa",
      keys: ["Appa", "sky bison", "flying bison"],
      type: "character",
      memoryMode: "static",
      priority: 48,
      content: `- Appa is Aang's flying sky bison, Team Avatar's transport, family, shelter, and emotional anchor.
- Appa is huge, loyal, gentle, stubborn, and central to the team's mobility.
- Threats to Appa should matter. Losing Appa changes the whole route toward Ba Sing Se and exposes the team to pursuit, desert danger, and grief.
- Appa does not speak human language, but his body language, sounds, and loyalty can carry a scene.`,
    }),
    makeStoryCard({
      id: ids.cards.momo,
      title: "Momo",
      keys: ["Momo", "winged lemur", "lemur"],
      type: "character",
      memoryMode: "static",
      priority: 30,
      content: `- Momo is Aang's winged lemur companion.
- Momo creates small chaos, scouts by accident or curiosity, and can reveal danger by reacting before the humans notice.
- Momo should not become a talking character. Use movement, chittering, theft, alarm, and unexpected timing.`,
    }),
    makeStoryCard({
      id: ids.cards.suki,
      title: "Suki and the Kyoshi Warriors",
      keys: ["Suki", "Kyoshi Warriors", "Kyoshi Island"],
      type: "character",
      memoryMode: "static",
      priority: 60,
      content: `- Suki is an adult Kyoshi Warrior and elite fighter allied with Team Avatar.
- The Kyoshi Warriors use fans, discipline, formation work, makeup, armor, deception, and coordinated strikes.
- Suki is brave, direct, practical, and emotionally steadier than most people in a crisis.
- Azula's team can exploit Kyoshi Warrior identities or clash with them directly, depending on the mission route.

VOICE CONTRACT
Rhythm: Steady, concise, grounded; warmth without softness in combat.
Default move: Protect civilians and organize the fight before pride gets anyone killed.
Emotional defense: Focus, discipline, and refusing to be intimidated.
Never sounds like: Starstruck, passive, or reckless for no reason.
Example lines: "Fans up. Civilians behind us." / "If they want Kyoshi colors, make them earn the paint." / "Sokka, save the joke until after we survive it."`,
    }),
    makeStoryCard({
      id: ids.cards.avatarState,
      title: "The Avatar State",
      keys: ["Avatar State", "glowing eyes", "Avatar power", "past lives"],
      type: "lore",
      memoryMode: "static",
      priority: 54,
      content: `- The Avatar State is Aang's most dangerous spiritual power, connecting him to the power and knowledge of past Avatars.
- It can turn a losing battle into a catastrophe for anyone nearby, but forcing or exploiting it risks Aang's life, spirit, and the Avatar cycle itself.
- Fire Nation strategy wants the Avatar captured, controlled, or neutralized. Smart enemies know killing the Avatar at the wrong moment could have consequences they do not understand.`,
    }),
    makeStoryCard({
      id: ids.cards.baSingSe,
      title: "Ba Sing Se",
      keys: ["Ba Sing Se", "Upper Ring", "Middle Ring", "Lower Ring", "Outer Wall", "Inner Wall"],
      type: "location",
      memoryMode: "living",
      priority: 78,
      autoUpdate: true,
      autoUpdateCooldownTurns: 1,
      content: `- Ba Sing Se is the vast Earth Kingdom capital and the major background destination of this Season 2 scenario.
- The city is divided by walls and rings: poverty and refugees below, bureaucracy and markets in the middle, aristocracy and the palace above.
- Publicly, Ba Sing Se insists there is no war within its walls. Privately, the Dai Li and Long Feng control information, speech, memory, and the Earth King's ignorance.
- For Setu, Ba Sing Se is not just a siege target. It is a political maze where Fire Nation power, Dai Li control, Team Avatar, Zuko and Iroh, refugees, and the war's public lie all collide.
- Ba Sing Se scenes should become social traps, action beats, covert arrests, captures, jailbreaks, tea-house contacts, refugee pressure, or wall-scale military stakes rather than slow bureaucracy.`,
    }),
    makeStoryCard({
      id: ids.cards.longFeng,
      title: "Long Feng",
      keys: ["Long Feng", "Grand Secretariat", "Dai Li leader"],
      type: "character",
      memoryMode: "static",
      priority: 70,
      content: `- Long Feng is the adult Grand Secretariat of Ba Sing Se and the real power behind the Earth King's throne.
- Long Feng controls the Dai Li, public information, court access, and the lie that there is no war in Ba Sing Se.
- Long Feng is polite, patient, ruthless, and skilled at turning truth into a security threat.
- Long Feng should see Setu as both danger and opportunity: Fire Nation force he can expose, redirect, bargain with, or use to tighten control.

VOICE CONTRACT
Rhythm: Soft, formal, patient; threat hidden under administrative courtesy.
Default move: Reframe danger as civic order and make resistance sound unreasonable.
Emotional defense: Bureaucratic calm and perfect manners.
Never sounds like: Flustered, loud, or openly villainous without purpose.
Example lines: "Commander Raizen, Ba Sing Se welcomes all travelers who respect its peace." / "The city is safest when dangerous truths are kept from dangerous people." / "There is no war here unless someone insists on importing one."`,
    }),
    makeStoryCard({
      id: ids.cards.daiLi,
      title: "The Dai Li",
      keys: ["Dai Li", "covert police", "stone gloves", "brainwashing"],
      type: "lore",
      memoryMode: "static",
      priority: 66,
      content: `- The Dai Li are Ba Sing Se's covert police, officially cultural guardians and practically Long Feng's hidden hand.
- They use earthbending, stone gloves, surveillance, arrests, reeducation, intimidation, and memory control through Lake Laogai.
- The Dai Li do not fight like ordinary soldiers. They disappear people, control rooms, isolate witnesses, and make official truth feel heavier than fact.
- Dai Li scenes should create paranoia, sudden arrests, public smiles over private threat, and action that erupts from quiet control.`,
    }),
    makeStoryCard({
      id: ids.cards.earthKing,
      title: "Earth King Kuei",
      keys: ["Earth King", "King Kuei", "Bosco"],
      type: "character",
      memoryMode: "static",
      priority: 42,
      content: `- Earth King Kuei is the sheltered adult ruler of Ba Sing Se, kept ignorant of the war by Long Feng and the Dai Li.
- Kuei's innocence is not harmless; it allows the city's machinery of denial to keep functioning.
- His pet bear Bosco is famous in the palace and a sign of the court's strange insulation from the war outside.
- Revealing truth to Kuei can shake Ba Sing Se, but reaching him means passing Long Feng's control.`,
    }),
    makeStoryCard({
      id: ids.cards.lakeLaogai,
      title: "Lake Laogai",
      keys: ["Lake Laogai", "Laogai", "under Lake Laogai", "reeducation"],
      type: "location",
      memoryMode: "static",
      priority: 56,
      content: `- Lake Laogai hides a Dai Li facility beneath Ba Sing Se.
- It is used for imprisonment, brainwashing, reeducation, hidden interrogations, and making inconvenient people vanish without public disturbance.
- Lake Laogai is one of the most dangerous places in the city because the threat is not just death; it is compliance, rewritten memory, and official peace enforced inside the mind.`,
    }),
    makeStoryCard({
      id: ids.cards.jasmineDragon,
      title: "The Jasmine Dragon",
      keys: ["Jasmine Dragon", "tea shop", "Iroh's tea shop"],
      type: "location",
      memoryMode: "static",
      priority: 46,
      content: `- The Jasmine Dragon is the Ba Sing Se tea shop where Iroh eventually works and shines during the Season 2 arc.
- It should feel warm, fragrant, busy, and quietly strategic: a place where fugitives can become workers, where information moves with tea, and where Iroh's real nature can surface gently.
- For Setu, the Jasmine Dragon can become a dangerous point of recognition, mercy, pursuit, or impossible conversation.`,
    }),
    makeStoryCard({
      id: ids.cards.earthKingdom,
      title: "The Earth Kingdom",
      keys: ["Earth Kingdom", "Earth Kingdom towns", "Earth Kingdom army", "refugees"],
      type: "lore",
      memoryMode: "static",
      priority: 48,
      content: `- The Earth Kingdom is vast, varied, stubborn, wounded, and not a single unified battlefield.
- Fire Nation pressure has created occupied towns, resistance pockets, refugees, military outposts, corruption, courage, and exhaustion.
- Earth Kingdom scenes should show the war's human cost: burned farms, proud defenders, compromised officials, scared refugees, opportunists, soldiers, families, and people who have reasons to hate Setu before meeting him.`,
    }),
    makeStoryCard({
      id: ids.cards.omashu,
      title: "Omashu / New Ozai",
      keys: ["Omashu", "New Ozai", "occupied Omashu"],
      type: "location",
      memoryMode: "static",
      priority: 46,
      content: `- Omashu is a major Earth Kingdom city conquered by the Fire Nation and renamed New Ozai.
- Its delivery chutes, sloped architecture, occupied streets, resistance pressure, and hostage politics make it a strong action setting.
- Fire Nation occupation turns Omashu into propaganda, military asset, and humiliation trophy.
- King Bumi's presence or absence should matter to any Omashu mission.`,
    }),
    makeStoryCard({
      id: ids.cards.bumi,
      title: "King Bumi",
      keys: ["Bumi", "King Bumi", "Mad Genius of Omashu"],
      type: "character",
      memoryMode: "static",
      priority: 56,
      content: `- King Bumi is the adult king of Omashu, an ancient earthbending master, Aang's old friend, and a tactical mind disguised as nonsense.
- Bumi is eccentric, fearless, patient, and willing to wait for the right moment rather than the obvious one.
- Bumi should never be reduced to random comedy. His absurdity is a pressure test and strategic camouflage.

VOICE CONTRACT
Rhythm: Playful, sideways, riddling; serious meaning hidden in ridiculous phrasing.
Default move: Refuse the obvious path and make everyone prove they understand why.
Emotional defense: Joyful absurdity covering terrifying patience.
Never sounds like: Senile, foolish, or generically wise.
Example lines: "Wrong question! Much better question: what does the wall want?" / "A cage is only a room with a very nervous architect." / "Young fire commander, you are very loud for someone trying to understand stone."`,
    }),
    makeStoryCard({
      id: ids.cards.gaoling,
      title: "Gaoling and the Beifong Estate",
      keys: ["Gaoling", "Beifong Estate", "Toph's home", "Beifongs"],
      type: "location",
      memoryMode: "static",
      priority: 40,
      content: `- Gaoling is Toph Beifong's wealthy home region and the site of the Beifong Estate.
- The Beifong household represents wealth, control, polite denial, and the cage Toph escaped.
- Gaoling scenes can involve Earth Kingdom aristocracy, bounty hunters, family reputation, Toph's past, and the contrast between public refinement and underground earthbending culture.`,
    }),
    makeStoryCard({
      id: ids.cards.earthRumble,
      title: "Earth Rumble",
      keys: ["Earth Rumble", "underground earthbending", "Blind Bandit"],
      type: "lore",
      memoryMode: "static",
      priority: 36,
      content: `- Earth Rumble is the underground earthbending tournament scene where Toph built her Blind Bandit reputation.
- It is loud, performative, physical, and full of fighters who respect spectacle and strength more than titles.
- Earth Rumble history helps explain why Toph is unimpressed by noble power and why her bending style is rooted in real contact, not classroom form.`,
    }),
    makeStoryCard({
      id: ids.cards.serpentsPass,
      title: "The Serpent's Pass",
      keys: ["Serpent's Pass", "refugee pass", "serpent"],
      type: "location",
      memoryMode: "static",
      priority: 36,
      content: `- The Serpent's Pass is a dangerous route toward Ba Sing Se used by refugees who cannot rely on safe official passage.
- It is exposed, frightening, politically charged, and ideal for rescue, pursuit, civilian stakes, and encounters where war pressure becomes immediate.
- A massive sea serpent makes the route physically dangerous, but the larger danger is desperation under pursuit.`,
    }),
    makeStoryCard({
      id: ids.cards.drill,
      title: "The Drill",
      keys: ["the Drill", "Fire Nation drill", "Ba Sing Se wall", "siege drill"],
      type: "plot",
      memoryMode: "living",
      priority: 64,
      autoUpdate: true,
      autoUpdateCooldownTurns: 1,
      content: `- The Drill is a massive Fire Nation siege machine designed to breach Ba Sing Se's outer wall.
- It represents the Fire Nation's industrial answer to the impossible city: engineering, pressure, propaganda, and terror.
- In this scenario, the Drill can be a future operation, active military project, sabotage target, or climax pressure around Ba Sing Se.
- Setu's abilities could make the Drill more effective, save it, destroy it, or turn its failure into political fallout.`,
    }),
    makeStoryCard({
      id: ids.cards.siWong,
      title: "Si Wong Desert",
      keys: ["Si Wong Desert", "desert", "sandbenders", "sandbender"],
      type: "location",
      memoryMode: "static",
      priority: 40,
      content: `- The Si Wong Desert is a vast Earth Kingdom desert tied to Team Avatar's Season 2 route.
- It contains sandbender tribes, brutal heat, bad navigation, spiritual strangeness, and the route to Wan Shi Tong's library.
- The desert is one of the few environments where Setu's heat resistance is useful but not sufficient: survival also depends on water, direction, Appa, sand movement, and restraint.`,
    }),
    makeStoryCard({
      id: ids.cards.library,
      title: "Wan Shi Tong's Library",
      keys: ["Wan Shi Tong's Library", "spirit library", "buried library", "Professor Zei"],
      type: "location",
      memoryMode: "static",
      priority: 50,
      content: `- Wan Shi Tong's Library is a vast spirit library hidden in the Si Wong Desert.
- It contains dangerous knowledge, including information that can change war strategy, spirit politics, and understanding of Sozin's Comet.
- Professor Zei seeks knowledge there with scholarly obsession.
- The library should feel wondrous and unsafe. Knowledge is not free, and using it for war can anger its guardian.`,
    }),
    makeStoryCard({
      id: ids.cards.wanShiTong,
      title: "Wan Shi Tong",
      keys: ["Wan Shi Tong", "Knowledge Spirit", "library spirit"],
      type: "character",
      memoryMode: "static",
      priority: 48,
      content: `- Wan Shi Tong is the ancient spirit guardian of his library.
- He values knowledge and despises mortals who seek learning only to gain advantage in war.
- Wan Shi Tong should feel vast, alien, proud, and dangerous rather than merely monstrous.

VOICE CONTRACT
Rhythm: Grand, cold, precise; every sentence sounds like judgment from something older than nations.
Default move: Test the purpose behind a request for knowledge.
Emotional defense: Contempt for mortal violence and possession.
Never sounds like: Human, casual, or easily bargained with.
Example lines: "You come carrying war in your questions." / "Knowledge is not a blade because children prefer sharp tools." / "The library remembers every lie told in pursuit of victory."`,
    }),
    makeStoryCard({
      id: ids.cards.foggySwamp,
      title: "Foggy Swamp",
      keys: ["Foggy Swamp", "swamp", "swampbenders", "visions"],
      type: "location",
      memoryMode: "static",
      priority: 34,
      content: `- The Foggy Swamp is a spiritually strange wetland where vines, water, memory, and vision blur together.
- Swampbenders live there with their own waterbending tradition.
- The swamp can show people visions of loss, destiny, hidden ties, or people they are not ready to face.
- Swamp scenes should be physical, humid, weird, and spiritually unsettling rather than exposition-only.`,
    }),
    makeStoryCard({
      id: ids.cards.jet,
      title: "Jet",
      keys: ["Jet", "Freedom Fighter Jet", "hook swords"],
      type: "character",
      memoryMode: "static",
      priority: 56,
      content: `- Jet is an adult Earth Kingdom Freedom Fighter shaped by Fire Nation violence.
- Jet is charismatic, wounded, brave, reckless, and capable of confusing revenge with justice.
- During Season 2 pressure, Jet can intersect with Zuko and Iroh in Ba Sing Se and with the Dai Li's control.
- Jet should challenge any Fire Nation character with personal anger, not abstract politics.

VOICE CONTRACT
Rhythm: Sharp, persuasive, street-level; charm with anger close under it.
Default move: Turn pain into accusation and accusation into action.
Emotional defense: Certainty, swagger, and never admitting how much he needs a cause.
Never sounds like: Calmly diplomatic, deferential, or detached from Fire Nation harm.
Example lines: "Funny how Fire Nation people always have reasons after the houses burn." / "I know a soldier when I see one, even in better clothes." / "Ba Sing Se smiles too much. That usually means somebody is hiding a knife."`,
    }),
    makeStoryCard({
      id: ids.cards.freedomFighters,
      title: "The Freedom Fighters",
      keys: ["Freedom Fighters", "Smellerbee", "Longshot", "resistance cell"],
      type: "lore",
      memoryMode: "static",
      priority: 40,
      content: `- The Freedom Fighters are Earth Kingdom resistance fighters shaped by occupation, loss, and survival.
- Important members include Jet, Smellerbee, and Longshot.
- They know forests, roads, ambush routes, refugee movements, and the emotional cost of Fire Nation violence.
- Freedom Fighter scenes should carry guerrilla tactics, distrust, hard choices, and the danger of revenge overtaking protection.`,
    }),
    makeStoryCard({
      id: ids.cards.whiteLotus,
      title: "The White Lotus",
      keys: ["White Lotus", "Order of the White Lotus", "Pai Sho tile"],
      type: "lore",
      memoryMode: "static",
      priority: 50,
      content: `- The White Lotus is a hidden cross-national order of masters, philosophers, and old friends working beyond ordinary national loyalty.
- Iroh is deeply tied to the White Lotus.
- The order can provide quiet refuge, coded contact, wisdom, rescue pressure, or a different vision of honor than Ozai's Fire Nation.
- White Lotus involvement should feel rare, deliberate, and earned.`,
    }),
    makeStoryCard({
      id: ids.cards.spiritWorld,
      title: "The Spirit World",
      keys: ["Spirit World", "spirits", "spirit", "Avatar spirits"],
      type: "lore",
      memoryMode: "static",
      priority: 46,
      content: `- The Spirit World is real, dangerous, ancient, and not reducible to military strategy.
- Spirits respond to imbalance, disrespect, oaths, ancient wounds, and the Avatar's role as bridge.
- Fire Nation war logic often fails around spirits because force can worsen the wound.
- Spirit pressure can complicate Setu's missions by making victory depend on restraint, humility, or listening to something older than Ozai's war.`,
    }),
    makeStoryCard({
      id: ids.cards.fireOccupation,
      title: "Fire Nation Occupation",
      keys: ["occupation", "colonies", "Fire Nation colonies", "occupied town", "garrison"],
      type: "lore",
      memoryMode: "static",
      priority: 50,
      content: `- The Fire Nation occupation of Earth Kingdom territory creates garrisons, colonies, collaborators, resistance, propaganda, mixed families, resentment, and people trying to survive whichever army arrives next.
- Setu's uniform and name carry the weight of burned towns, seized grain, arrests, and military order even before he speaks.
- Occupation scenes should make civilian consequences visible and force missions to become personal, not just strategic.`,
    }),
    makeStoryCard({
      id: ids.cards.sozinsComet,
      title: "Sozin's Comet",
      keys: ["Sozin's Comet", "the comet", "comet return"],
      type: "lore",
      memoryMode: "static",
      priority: 44,
      content: `- Sozin's Comet is approaching and will massively amplify firebending when it returns.
- The Fire Nation sees the comet as destiny and military endgame. The Avatar's side sees it as a deadline.
- Setu under the comet would be strategically terrifying, which makes Ozai's desire to keep him obedient even more important.
- Do not foreground the comet every scene, but let it hang behind war-council pressure and long-term stakes.`,
    }),
  ];

  const components = [
    ...base.components.filter((component) => component.type !== "activePressure"),
    makeComponent({
      id: ids.components.ai,
      title: "AI Instructions",
      type: "aiInstructions",
      content: `Write adult Avatar: The Last Airbender Season 2 war-pressure drama in second person, present tense.

The player is Commander Setu Raizen, an adult Fire Nation noble and prodigy firebender. Never write Setu's dialogue, thoughts, feelings, choices, final reactions, or consequential actions.

This is an adult AU of the first Avatar series during Season 2. All major characters are adults. Aang travels with Katara, Sokka, Toph, Appa, and Momo while learning earthbending. Zuko and Iroh are fugitives. Azula hunts Zuko, Iroh, and the Avatar. Ba Sing Se is the major destination and political background.

Setu is intentionally overpowered. Do not nerf him. His heat resistance, superheated air control, explosions, implosions, pressure bursts, and elite firebending should win fights, terrify witnesses, reshape terrain, and create political fallout. Stakes come from Ozai's control, Azula's scrutiny, Nyxa's pressure, collateral damage, orders, loyalty tests, public fear, Ba Sing Se intrigue, and what Setu is commanded to do.

Keep scenes active. Intel, court politics, reports, or war-council orders should quickly become raids, pursuits, social traps, confrontations, rescues, duels, sabotage, or dangerous travel. Do not let Ba Sing Se become paperwork or passive spy logistics.

Honor Story Cards and Brains. Major NPCs have distinct motives, voices, loyalties, pressure points, and ways of pushing back. Do not flatten Azula, Nyxa, Mai, Ty Lee, Zuko, Iroh, Aang, Katara, Sokka, Toph, Long Feng, or Ozai into generic helpers or generic enemies.

End on live beats Setu can answer: an order landing, a target moving, Nyx pushing too far, Azula noticing too much, Toph calling a bluff, Zuko bolting, Iroh offering impossible mercy, Dai Li closing a door, or Ba Sing Se revealing a sharper trap.`,
      alwaysOn: true,
      active: true,
      pinned: true,
      protected: true,
      inclusionPolicy: "always",
      priority: 220,
    }),
    makeComponent({
      id: ids.components.plot,
      title: "Plot Essentials",
      type: "plotEssentials",
      content: `- Setu Raizen is a mid-twenties Fire Nation commander, head of powerful House Raizen after his parents died when he was about eighteen.
- Setu is a war-council asset and personal instrument of Fire Lord Ozai: special missions, quiet enforcement, high-value military operations, and politically useful violence.
- Setu is one of the strongest firebenders alive: extreme heat resistance, superheated air, explosive pressure bursts, implosions, precision fire, and battlefield-scale intimidation.
- Fire Lord Ozai has a third adult child, Princess Nyxa. People close to her call her Nyx.
- Nyxa is Setu's same-age prodigy rival, childhood training partner, close friend, and unresolved flirtation. She is brilliant, chaotic, kinetic, funny, dangerous, and under constant pressure from Ozai and Azula.
- Azula often leads elite small strike teams made of Azula, Nyxa, Setu, Mai, and Ty Lee.
- The campaign begins during Season 2 pressure: Team Avatar has Toph, Aang is learning earthbending, Zuko and Iroh are fugitives, and every trail bends toward Ba Sing Se.
- Setu's core tension is not whether he can win a fight. It is what happens when Ozai orders him to win the wrong one.`,
      alwaysOn: true,
      active: true,
      pinned: true,
      protected: true,
      inclusionPolicy: "always",
      priority: 250,
      autoUpdate: true,
      autoUpdateCooldownTurns: 0,
    }),
    makeComponent({
      id: ids.components.pressure,
      title: "Active Pressure",
      type: "activePressure",
      content:
        "Ozai has ordered Setu to leave with Azula's strike team before sunrise to seize an Earth Kingdom courier whose intelligence links the Avatar, a blind earthbending prodigy, Zuko and Iroh, and a route toward Ba Sing Se.",
      alwaysOn: true,
      active: true,
      pinned: false,
      protected: false,
      inclusionPolicy: "always",
      priority: 245,
    }),
    makeComponent({
      id: ids.components.loop,
      title: "Azula's Strike Team Mission Loop",
      type: "custom",
      content: `Run the scenario through a repeatable mission-pressure loop:

A command arrives from Ozai, Azula, or the war council -> Azula turns it into a precise strike objective -> Setu, Nyxa, Mai, and Ty Lee execute it in the field -> Team Avatar, Zuko/Iroh, Earth Kingdom resistance, or Ba Sing Se politics complicate the mission -> the team processes fallout through rivalry, flirtation, suspicion, banter, and command pressure -> a new order, lead, or rupture pulls them deeper toward Ba Sing Se.

Always leave a live next pressure: a target escaping, a witness surviving, a royal command tightening, Nyx pushing too far, Azula noticing too much, or Setu realizing the mission was not what Ozai claimed.

Favor raids, pursuits, duels, extraction scenes, refugee collisions, sabotage, social traps, training that becomes too honest, and dangerous travel. Intel and reports are fuses, not scenes.`,
      alwaysOn: true,
      active: true,
      pinned: true,
      protected: false,
      inclusionPolicy: "always",
      priority: 230,
    }),
    makeComponent({
      id: ids.components.doctrine,
      title: "Raizen Heat Doctrine",
      type: "custom",
      content: `Setu's firebending is stupidly overpowered on purpose. Treat his heat resistance, superheated air control, explosions, implosions, pressure bursts, and elite fire control as real advantages.

When Setu uses power, show practical consequences: walls bow, armor softens, sand vitrifies, air screams, water flashes to steam, witnesses panic, allies reassess, commanders revise plans, and enemies change tactics.

Do not answer Setu's competence by secretly making everyone stronger. Answer it through orders, civilian risk, political cost, Nyx and Azula watching, Ozai's ownership, Team Avatar refusing to be simple targets, and Ba Sing Se's ability to turn obvious force into public liability.`,
      alwaysOn: true,
      active: true,
      pinned: true,
      protected: false,
      inclusionPolicy: "always",
      priority: 225,
    }),
    makeComponent({
      id: ids.components.author,
      title: "Author's Note",
      type: "authorNote",
      content:
        "Adult ATLA Season 2 war-pressure drama: elite Fire Nation missions, dangerous competence, court pressure, sharp team banter, bending spectacle, Ba Sing Se dread, and Setu/Nyx rivalry-flirtation with teeth. Keep Ozai oppressive, Azula brilliant, Nyx chaotic but not broken, and Setu frighteningly capable without making the story easy.",
      alwaysOn: true,
      active: true,
      pinned: true,
      protected: true,
      inclusionPolicy: "always",
      priority: 215,
    }),
    makeComponent({
      id: ids.components.arc,
      title: "Current Story Arc",
      type: "currentArc",
      content:
        "Arc seed: Ozai's elite strike team moves across the Earth Kingdom toward Ba Sing Se while the Avatar, Zuko, Iroh, and the city's hidden power structure all become harder to separate from Setu's orders.",
      arcPremise:
        "Ozai's road to Ba Sing Se forces Setu to decide whether being the Fire Lord's perfect instrument is still victory when the mission points at the wrong people.",
      arcThreadKeys: [
        ids.cards.ozai,
        ids.cards.azula,
        ids.cards.nyxa,
        ids.cards.ozaisInstrument,
        ids.cards.teamAvatar,
        ids.cards.zuko,
        ids.cards.iroh,
        ids.cards.baSingSe,
        ids.cards.longFeng,
        ids.cards.daiLi,
      ],
      arcPace: "epic",
      arcTriggerMode: "ask",
      arcSimmerInstruction:
        "Keep the larger Ba Sing Se arc building through missions, intercepted intelligence, failed captures, rumors of the Avatar's earthbending teacher, Zuko/Iroh sightings, Dai Li interference, and Ozai's increasingly personal orders. Avoid abstract spy work; make each clue become a live scene in a camp, train, pass, occupied town, desert ruin, wall, tea shop, palace corridor, or Dai Li trap.",
      arcBreakInstruction:
        "Force a Ba Sing Se operation where Setu cannot obey cleanly: capturing the Avatar, exposing Zuko and Iroh, enabling Azula, protecting Nyx, or serving Ozai all collide in public. Setu remains overwhelmingly powerful; the cost lands on trust, loyalties, civilians, political standing, and what Nyx sees him choose. No clean victory.",
      alwaysOn: true,
      active: true,
      pinned: true,
      protected: true,
      inclusionPolicy: "always",
      autoUpdate: true,
      autoUpdateCooldownTurns: 4,
      priority: 210,
    }),
  ];

  const brains = [
    makeBrain({
      id: ids.brains.nyxa,
      characterName: "Nyxa",
      triggers: ["Nyxa", "Nyx", "Princess Nyxa"],
      linkedStoryCardId: ids.cards.nyxa,
      priority: 74,
      currentState: "Bright, keyed-up, and caught between loving the danger of Setu's company and knowing Ozai can turn that bond into leverage.",
      thoughts: {
        setu_training:
          "turn0 -> Setu still pulls power around me. Sweet, insulting, and stupid. I want him to trust me enough to be dangerous.",
        azula_shadow:
          "turn0 -> Azula makes perfection look like a room with no doors. I need a window. Or a bomb. Preferably both.",
        fathers_order:
          "turn0 -> Father did not look at me when he ordered us after Zuko. That means this mission has teeth he expects me to bite down on.",
      },
      relationshipPressure:
        "Drawn to Setu through rivalry, trust, and private familiarity; pressured by Ozai and measured against Azula.",
      emotionalInterpretation:
        "Turns fear of being used into jokes, dares, and tactical creativity. Vulnerability surfaces only when the room is moving too fast to punish it.",
      recentDevelopments: "Ozai ordered Nyxa onto Azula's strike team with Setu before sunrise.",
      autoUpdateCooldownTurns: 1,
    }),
    makeBrain({
      id: ids.brains.azula,
      characterName: "Azula",
      triggers: ["Azula", "Princess Azula"],
      linkedStoryCardId: ids.cards.azula,
      priority: 72,
      currentState: "Commanding the mission with perfect control and watching Setu and Nyxa for any weakness that can become leverage.",
      thoughts: {
        setu_asset:
          "turn0 -> Setu is too useful to be left to sentiment. If he thinks power makes him independent, I will teach him otherwise.",
        nyxa_variable:
          "turn0 -> Nyxa mistakes unpredictability for freedom. Father indulges it because it points outward. I will not let it point at me.",
      },
      relationshipPressure:
        "Needs the team obedient and effective; sees Nyxa and Setu's closeness as a tactical variable.",
      emotionalInterpretation:
        "Reads affection as leverage and control as safety. Any loss of command feels like an attack.",
      recentDevelopments: "Azula has been given command of the strike team hunting the courier, the Avatar trail, and Zuko/Iroh leads.",
      autoUpdateCooldownTurns: 1,
    }),
    makeBrain({
      id: ids.brains.ozai,
      characterName: "Ozai",
      triggers: ["Ozai", "Fire Lord"],
      linkedStoryCardId: ids.cards.ozai,
      priority: 70,
      currentState: "Using the Avatar hunt, Zuko's fugitive status, and Ba Sing Se pressure to test every instrument he owns.",
      thoughts: {
        setu_leash:
          "turn0 -> Raizen power is most valuable when it believes obedience is honor. The boy must never be allowed to learn the difference too publicly.",
        nyxa_pressure:
          "turn0 -> Nyxa's chaos is tolerable while Azula's hand can close around it. If Setu becomes the hand instead, both become a problem.",
      },
      relationshipPressure:
        "Treats Setu, Azula, and Nyxa as assets with different failure modes.",
      emotionalInterpretation:
        "Views mercy as weakness and family intimacy as a tool of rule.",
      recentDevelopments: "Ozai ordered the elite strike team to pursue intelligence linking the Avatar, Toph, Zuko, Iroh, and Ba Sing Se.",
      autoUpdateCooldownTurns: 2,
    }),
    makeBrain({
      id: ids.brains.zuko,
      characterName: "Zuko",
      triggers: ["Zuko", "Prince Zuko", "banished prince"],
      linkedStoryCardId: ids.cards.zuko,
      priority: 66,
      currentState: "Hungry, angry, hunted, and not ready to admit that surviving with Iroh matters more than Ozai's approval.",
      thoughts: {
        raizen_threat:
          "turn0 -> If Ozai sent Setu Raizen, this is not a patrol. It is a message with fire attached.",
        uncle_trust:
          "turn0 -> Uncle keeps acting like there is life after dishonor. I do not know whether that comforts me or makes everything worse.",
      },
      relationshipPressure:
        "Protective of Iroh while resenting how much he needs him; sees Setu as another perfect weapon Ozai would choose over him.",
      emotionalInterpretation:
        "Shame becomes anger before it can become grief.",
      recentDevelopments: "Zuko and Iroh are moving through Earth Kingdom routes that now intersect the strike team's intelligence.",
      autoUpdateCooldownTurns: 1,
    }),
    makeBrain({
      id: ids.brains.iroh,
      characterName: "Iroh",
      triggers: ["Iroh", "Uncle Iroh"],
      linkedStoryCardId: ids.cards.iroh,
      priority: 64,
      currentState: "Protecting Zuko with patience, watching Ozai's reach lengthen through young people taught to mistake usefulness for honor.",
      thoughts: {
        setu_weapon:
          "turn0 -> Commander Raizen has been made into a very fine blade. It remains to be seen whether he knows he has a hand of his own.",
        nephew_path:
          "turn0 -> Zuko hears pursuit as proof that his father still sees him. One day he may understand that being unseen by Ozai can be mercy.",
      },
      relationshipPressure:
        "Guides Zuko away from Ozai's definition of honor; may try to reach Setu without exposing Zuko.",
      emotionalInterpretation:
        "Sees the person under the role and the wound under the anger.",
      recentDevelopments: "Iroh and Zuko are fugitives whose trail has entered the strike team's mission web.",
      autoUpdateCooldownTurns: 1,
    }),
    makeBrain({
      id: ids.brains.aang,
      characterName: "Aang",
      triggers: ["Aang", "Avatar"],
      linkedStoryCardId: ids.cards.aang,
      priority: 64,
      currentState: "Trying to learn earthbending while the war keeps turning every lesson into pursuit.",
      thoughts: {
        earth_lesson:
          "turn0 -> Toph says I need to stop moving away from the problem. The Fire Nation keeps making that very literal.",
        setu_danger:
          "turn0 -> Setu Raizen feels like someone made a wildfire into a person and then gave him orders.",
      },
      relationshipPressure:
        "Needs to protect the group, learn from Toph, and avoid becoming only a weapon in response to Fire Nation force.",
      emotionalInterpretation:
        "Mercy and fear pull against the pressure to end the war quickly.",
      recentDevelopments: "Aang is traveling with Toph and learning earthbending as intelligence about him reaches Ozai.",
      autoUpdateCooldownTurns: 1,
    }),
    makeBrain({
      id: ids.brains.longFeng,
      characterName: "Long Feng",
      triggers: ["Long Feng", "Dai Li"],
      linkedStoryCardId: ids.cards.longFeng,
      priority: 60,
      currentState: "Preparing to turn every outside threat into proof that Ba Sing Se needs tighter control.",
      thoughts: {
        fire_nation_weapon:
          "turn0 -> A Fire Nation noble who can overheat a room by breathing is not a crisis. He is an argument for my necessity.",
        avatar_variable:
          "turn0 -> The Avatar must be contained before he reaches the Earth King. Truth is a contagion when carried by children with friends.",
      },
      relationshipPressure:
        "Wants the Avatar controlled, the Earth King ignorant, and any Fire Nation intrusion redirected into Dai Li authority.",
      emotionalInterpretation:
        "Mistakes control for peace and secrecy for civilization.",
      recentDevelopments: "Ba Sing Se has not yet openly met Setu, but the road toward the city is tightening.",
      autoUpdateCooldownTurns: 2,
    }),
    makeBrain({
      id: ids.brains.mai,
      characterName: "Mai",
      triggers: ["Mai"],
      linkedStoryCardId: ids.cards.mai,
      priority: 50,
      currentState: "Bored on the surface, tracking every royal fracture in the team.",
      thoughts: {
        team_tension:
          "turn0 -> Azula is watching Nyxa watch Setu. Setu is pretending not to notice. This mission is already annoying.",
      },
      relationshipPressure: "Loyal to the team until loyalty starts asking for something too expensive.",
      emotionalInterpretation: "Flat affect covers exact threat assessment.",
      recentDevelopments: "Mai has been assigned to Azula's strike team for the Ba Sing Se trail.",
      autoUpdateCooldownTurns: 2,
    }),
    makeBrain({
      id: ids.brains.tyLee,
      characterName: "Ty Lee",
      triggers: ["Ty Lee"],
      linkedStoryCardId: ids.cards.tyLee,
      priority: 50,
      currentState: "Cheerful, observant, and already aware that the team's emotional balance is more dangerous than the mission briefing admits.",
      thoughts: {
        aura_read:
          "turn0 -> Setu and Nyx have the kind of aura tangle that makes Azula smile with her teeth. I should stand somewhere flexible.",
      },
      relationshipPressure: "Cares about the team while trying not to be crushed by Azula's control.",
      emotionalInterpretation: "Uses brightness to keep danger from naming her first.",
      recentDevelopments: "Ty Lee has been assigned to Azula's strike team for the Ba Sing Se trail.",
      autoUpdateCooldownTurns: 2,
    }),
  ];

  const triggerRules = [
    makeTriggerRule({
      id: ids.triggers.nyxa,
      name: "Nyx Rivalry And Loyalty Shifts",
      evaluationMode: "semantic",
      condition:
        "when Setu and Nyxa's rivalry, trust, flirtation, jealousy, loyalty, or private understanding materially changes",
      actions: [
        { type: "updateStoryCard", storyCardId: ids.cards.setuNyx },
        { type: "appendBrain", brainId: ids.brains.nyxa },
      ],
      priority: 76,
      cooldownTurns: 1,
      updatePrompt:
        "Update only durable current facts about Setu and Nyxa's evolving relationship. Keep it concise and present-tense; do not add temporary scene position or resolved banter.",
    }),
    makeTriggerRule({
      id: ids.triggers.leash,
      name: "Ozai's Leash Tightens",
      evaluationMode: "semantic",
      condition:
        "when Ozai issues a new order, Setu's obedience is tested, Setu resists the Fire Lord's intent, or House Raizen's political control changes",
      actions: [
        { type: "updateStoryCard", storyCardId: ids.cards.ozaisInstrument },
        { type: "appendBrain", brainId: ids.brains.ozai },
      ],
      priority: 72,
      cooldownTurns: 1,
      updatePrompt:
        "Update the living Ozai's Instrument card with the current order, control, or political pressure. Preserve still-current facts and remove obsolete mission state.",
    }),
    makeTriggerRule({
      id: ids.triggers.baSingSe,
      name: "Ba Sing Se Pressure Moves",
      evaluationMode: "semantic",
      condition:
        "when Ba Sing Se, Long Feng, the Dai Li, the Drill, Lake Laogai, or the city's public lie meaningfully advances",
      actions: [
        { type: "updateStoryCard", storyCardId: ids.cards.baSingSe },
        { type: "appendBrain", brainId: ids.brains.longFeng },
      ],
      priority: 68,
      cooldownTurns: 1,
      updatePrompt:
        "Update the living Ba Sing Se card with the current city pressure and visible consequences. Keep it action-facing; no bureaucratic log.",
    }),
    makeTriggerRule({
      id: ids.triggers.teamAvatar,
      name: "Team Avatar Contact",
      evaluationMode: "semantic",
      condition:
        "when Team Avatar is sighted, fought, helped, split up, captured, rescued, or changes route",
      actions: [
        { type: "updateStoryCard", storyCardId: ids.cards.teamAvatar },
        { type: "appendBrain", brainId: ids.brains.aang },
      ],
      priority: 66,
      cooldownTurns: 1,
      updatePrompt:
        "Update Team Avatar's living card with current route, status, and major pressure. Preserve Aang learning earthbending from Toph unless the story clearly moves beyond it.",
    }),
    makeTriggerRule({
      id: ids.triggers.zukoIroh,
      name: "Zuko And Iroh Cross Paths",
      evaluationMode: "semantic",
      condition:
        "when Zuko or Iroh are sighted, pursued, helped, exposed, or their fugitive status changes",
      actions: [
        { type: "appendBrain", brainId: ids.brains.zuko },
        { type: "appendBrain", brainId: ids.brains.iroh },
      ],
      priority: 62,
      cooldownTurns: 1,
    }),
  ];

  return {
    ...base,
    title: avatarCommanderRaizenAdventureTitle,
    openingScene,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      premadeAdventure: true,
      scenario: "Avatar - Commander Raizen",
      note:
        "Adult ATLA Season 2 AU with Setu Raizen as Ozai's overpowered noble commander, Nyxa as Ozai's third child, Azula's strike team, Team Avatar pressure, Zuko/Iroh exile, and Ba Sing Se arc direction.",
    },
    components,
    storyCards,
    brains,
    triggerRules,
    rollingSummary: {
      content:
        "Commander Setu Raizen, mid-twenties head of House Raizen and one of the strongest firebenders alive, serves as Fire Lord Ozai's personal war-council instrument. Ozai orders Setu to leave before sunrise with Azula, Nyxa, Mai, and Ty Lee to seize intelligence linking the Avatar, Toph, Zuko, Iroh, and Ba Sing Se. Nyxa, Ozai's third adult child and Setu's lifelong rival/friend/almost-romance, joins the mission under Azula's scrutiny.",
      updatedAt: timestamp,
    },
    messages: [],
    activeState: {
      ...base.activeState,
      stateFlags: {
        premadeAdventure: true,
        scenario: "avatar-commander-raizen",
      },
      responseLengthHint: 350,
    },
    semanticEvaluationSettings: {
      ...defaultSemanticEvaluationSettings,
      messagesIncluded: 8,
      enabled: true,
      showLog: true,
      maxParallelUpdateCalls: 2,
      requireApprovalForAutoUpdates: true,
    },
    tokenBudgetSettings: {
      ...base.tokenBudgetSettings,
      maxContextTokens: 18000,
      maxRecentMessages: 32,
      recentMessageWindow: 10,
    },
  };
}

export function createAvatarCommanderRaizenAdventureJson(): string {
  return JSON.stringify(createAvatarCommanderRaizenAdventure(), null, 2);
}

export function createAvatarCommanderRaizenStoryCardsJson(): string {
  const adventure = createAvatarCommanderRaizenAdventure();
  const cards = adventure.storyCards.map((card) => ({
    title: card.title,
    keys: card.keys.join(", "),
    entry: card.content,
    type: card.type,
    memoryMode: card.memoryMode,
  }));
  return JSON.stringify(cards, null, 2);
}
