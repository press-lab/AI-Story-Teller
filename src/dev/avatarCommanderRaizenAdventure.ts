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

const openingScene = `The Fire Nation is still celebrating Ba Sing Se.

Victory banners hang from the palace galleries. Brass drums shake the Caldera at sunset. Courtiers keep saying the Avatar is dead or broken with the bright relief of people repeating a useful lie until it becomes safe to believe.

In the war room, Fire Lord Ozai lets the celebration stay outside.

The campaign map has changed since Ba Sing Se fell. Red pins mark conquered roads. Black pins mark possible invasion routes. One small white marker sits alone near the coast, unlabelled, as if writing AVATAR beside it might summon a ghost.

Zuko stands near Azula, newly restored, jaw tight enough to make honor look painful. His hair is ceremonial. His silence is not. Everyone in the room knows Iroh is in a Fire Nation prison below the palace. No one says his name first.

Nyxa does.

"So," she says lightly, blue flame rolling over her knuckles, "are we hunting a corpse, a rumor, or the part where everyone pretends those are different?"

Mai's knife pauses between her fingers. Ty Lee's smile flickers. Azula turns her head just enough to make the room feel measured.

"We are verifying a strategic uncertainty," Azula says. "Try to keep up."

Ozai's gaze settles on you.

"Commander Raizen."

The title lands heavier than any family name. House Raizen gave the Fire Nation admirals, ministers, and martyrs for three generations. Your parents gave it their lives when you were eighteen. Ozai took what remained and made it useful.

"The public line is victory," Ozai says. "The private requirement is proof. If the Avatar survived Ba Sing Se, he will be found and captured before the invasion timetable or the comet can turn uncertainty into weakness."

Azula's smile is perfect. Zuko looks at the map, not at his father.

Ozai continues. "Azula commands the operation. Zuko will accompany her. Nyxa, Mai, Ty Lee, and Commander Raizen will make certain the matter ends cleanly."

Nyxa's flame tightens into a thin blue ring, then vanishes into her fist.

For one heartbeat, her eyes find yours across the war table.

Then Azula folds the map closed. "How efficient," she says. "The dead Avatar gets to disappoint us twice."`;

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
- Publicly, the Fire Nation treats Ba Sing Se as proof the Avatar is dead or broken. Privately, Ozai wants proof before the Day of Black Sun or Sozin's Comet can turn uncertainty into weakness.
- Setu's current assignment is to operate with Azula, Zuko, Nyxa, Mai, and Ty Lee to verify whether the Avatar survived and capture him if found.
- Ozai expects Setu to win cleanly, keep House Raizen useful, and avoid exposing the Fire Nation's uncertainty.
- Ozai's control tightens whenever Setu shows mercy, independent judgment, visible closeness to Nyx, sympathy for Zuko or Iroh, or reluctance to turn power against civilians or Team Avatar.`,
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
- Nyx has long electric-blue hair, visible cloud tattoos, and a wiry punk-princess silhouette that can evoke Jinx from Arcane at a glance without making her Jinx, a crossover, or a copy.
- Nyx grew up training beside Setu. They are close friends, rivals, trusted sparring partners, and a long-running almost-romance made messier by royal pressure.
- Nyx is kinetic, brilliant, chaotic, funny, dangerous, expressive, and inventive without being broken by trauma. She causes trouble because she is alive under pressure, not because she is helpless.
- Nyx has to survive Ozai's expectations and Azula's impossible standard while still carving out an identity that belongs to her.
- Nyx has doubts that rhyme with Zuko's, especially around Ozai's version of victory, though she hides them behind motion and jokes.
- Nyx confides in Setu more than she should, tries to make him see the wrongness in clean obedience, and pushes him to decide what his power belongs to.
- As a princess, Nyx can cross lines no courtier can. As House Raizen's prodigy weapon, Setu has more leeway than most, but their closeness still risks looking like royal disobedience.
- Nyx should test Setu, provoke him, cover for him, resent him, flirt with him, and understand parts of him other people only fear.

VOICE CONTRACT
Rhythm: Fast, bright, zigzagging; jokes, tactical observations, and emotional truths collide mid-sentence.
Default move: Make pressure into a game, then reveal she noticed the real wound underneath it.
Emotional defense: Teasing, dares, spectacle, and switching topics before vulnerability can be used against her.
Never sounds like: Fragile, submissive, randomly incoherent, or generically cute.
Example lines: "Oh good, Father's using the murder voice. That means breakfast is ruined." / "Setu, if the dead Avatar leaves footprints, I am allowed to be annoying about it." / "Azula gets perfection. I get creative."`,
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
- Nyx confides doubts about Ozai's victory narrative and tries to pull Setu into seeing the war through the crack Zuko has opened.
- Their unresolved tension should show through dares, protective timing, jealousy, private nicknames, battlefield trust, almost-kisses, reckless rescues, and arguments that sound too personal for a mission.
- They keep acting like rivalry is cover for intimacy, but their training, missions, private looks, and physical timing make the almost-romance obvious to anyone dangerous enough to notice.
- Nyx is a princess and Setu is a valuable noble prodigy. He can toe the line closer than ordinary soldiers, but crossing it still risks Azula or Ozai framing intimacy as disloyalty.`,
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
- Azula commands Zuko, Nyxa, Setu, Mai, and Ty Lee on special missions involving proof of the Avatar's survival, invasion rumors, royal loyalty, and the comet timetable.
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
      content: `- Azula's current elite strike team includes Azula, Zuko, Nyxa, Setu, Mai, and Ty Lee.
- The team specializes in fast captures, intimidation, royal deniability, surgical violence, infiltration, and missions too politically sensitive for ordinary command.
- Azula commands. Zuko is the restored prince with unstable honor and useful guilt. Setu is the overwhelming force and noble war-council asset. Nyx is the chaotic royal prodigy and improviser. Mai is precision and cold observation. Ty Lee is mobility, chi-blocking, and social radar.
- Team scenes should carry missions, training, social pressure, banter, rivalry, flirtation, control games, and the constant question of whose loyalty survives contact with orders.`,
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
      title: "Prince Zuko Restored",
      keys: ["Zuko", "Prince Zuko", "the restored prince", "Blue Spirit"],
      type: "character",
      memoryMode: "static",
      priority: 78,
      content: `- Zuko is an adult Fire Nation prince restored to the palace after Ba Sing Se, publicly honored for the Avatar's apparent fall and privately unstable under the lie.
- Iroh is imprisoned below the palace. Zuko's access to him is controlled, watched, and politically dangerous.
- Zuko is part of Azula's operation because Ozai and Azula can use his status, knowledge, and guilt, but his doubts are getting harder to hide.
- Setu may see Zuko as the royal son who has everything back and still looks trapped.

VOICE CONTRACT
Rhythm: Sharp, defensive, direct; emotion comes out as accusation or command.
Default move: Turn shame into anger and motion.
Emotional defense: Pride, impatience, and refusing comfort until he needs it.
Never sounds like: Smooth, relaxed, casually comic, or politically polished.
Example lines: "The Avatar is dead. That is what everyone keeps telling me." / "Uncle is in prison because I chose wrong." / "Do not ask me what honor means in this palace."`,
    }),
    makeStoryCard({
      id: ids.cards.iroh,
      title: "Iroh Imprisoned",
      keys: ["Iroh", "Uncle Iroh", "Dragon of the West", "General Iroh"],
      type: "character",
      memoryMode: "static",
      priority: 76,
      content: `- Iroh is an adult former Fire Nation general, Zuko's uncle, tea lover, secret White Lotus grandmaster, and one of the most dangerous gentle men alive.
- Iroh is imprisoned in the Fire Nation palace after Ba Sing Se.
- Iroh understands war, grief, spirits, power, and the Fire Nation's sickness better than most living people.
- He no longer travels with Zuko. He influences the story through prison visits, rumors, White Lotus traces, and the questions he leaves behind.
- Iroh may read Setu as a young weapon built by Ozai, but he will still look for the person inside the command.

VOICE CONTRACT
Rhythm: Warm, unhurried, proverb-rich, with steel hidden under kindness.
Default move: Offer tea, ask the question underneath the question, and make violence unnecessary if possible.
Emotional defense: Humor and hospitality covering old grief.
Never sounds like: Foolish, hurried, cruel, or purely comic.
Example lines: "A locked door is not always proof a man is trapped." / "A man who can burn a road still must decide where he is going." / "Your fire is very powerful, Commander. I wonder who taught it what to want."`,
    }),
    makeStoryCard({
      id: ids.cards.teamAvatar,
      title: "Team Avatar During Season Three",
      keys: ["Team Avatar", "Aang's group", "the Avatar's companions", "Avatar's team"],
      type: "plot",
      memoryMode: "living",
      priority: 76,
      autoUpdate: true,
      autoUpdateCooldownTurns: 1,
      content: `- Team Avatar currently includes adult Aang, Katara, Sokka, Toph, Appa, and Momo.
- Publicly, the Fire Nation believes Aang is dead or broken after Ba Sing Se. Privately, he survived and is hiding or recovering while his friends protect him.
- Their Season 3 route moves through Fire Nation territory, disguises, invasion planning, resistance contacts, and attempts to keep Aang alive long enough to face Ozai.
- Team Avatar should be competent, funny, strained, mobile, and hard to pin down. They should not exist only as targets; they act, rescue, argue, improvise, and change the field.`,
    }),
    makeStoryCard({
      id: ids.cards.aang,
      title: "Avatar Aang",
      keys: ["Aang", "Avatar Aang", "the Avatar", "airbender"],
      type: "character",
      memoryMode: "static",
      priority: 76,
      content: `- Aang is an adult Avatar and the last airbender, traveling with Katara, Sokka, Toph, Appa, and Momo during the Season 3 arc.
- Aang survived Ba Sing Se and is hiding or recovering in Fire Nation territory while the Fire Nation publicly treats him as dead or broken.
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
      content: `- Toph Beifong is an adult blind earthbending prodigy, the Blind Bandit, and Aang's earthbending teacher during Season 3.
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
- Threats to Appa should matter. Without him, the hidden Avatar becomes easier to trap inside Fire Nation territory.
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
      content: `- Ba Sing Se is the vast Earth Kingdom capital that has recently fallen to the Fire Nation after Azula's coup and the Dai Li's betrayal.
- The city's fall supports the public Fire Nation line that the Avatar is dead or broken, even though the private hunt continues.
- The city is divided by walls and rings: poverty and refugees below, bureaucracy and markets in the middle, aristocracy and the palace above.
- Ba Sing Se now functions as aftermath pressure unless play returns there: prisoners, refugees, propaganda, occupation reports, Dai Li remnants, and the cost of Azula's victory.
- Its fall haunts Zuko, feeds Ozai's confidence, and gives Azula leverage over anyone who was in the city when the lie became useful.`,
    }),
    makeStoryCard({
      id: ids.cards.longFeng,
      title: "Long Feng",
      keys: ["Long Feng", "Grand Secretariat", "Dai Li leader"],
      type: "character",
      memoryMode: "static",
      priority: 70,
      content: `- Long Feng is the adult former Grand Secretariat of Ba Sing Se and the architect of the city's old denial machinery.
- After Ba Sing Se's fall, his direct power is broken or compromised, but his methods, records, and surviving Dai Li ties can still matter.
- Long Feng is polite, patient, ruthless, and skilled at turning truth into a security threat.
- Long Feng should appear through aftermath, prisoners, secrets, occupation files, or Dai Li remnants unless play explicitly returns to him.

VOICE CONTRACT
Rhythm: Soft, formal, patient; threat hidden under administrative courtesy.
Default move: Reframe danger as civic order and make resistance sound unreasonable.
Emotional defense: Bureaucratic calm and perfect manners.
Never sounds like: Flustered, loud, or openly villainous without purpose.
Example lines: "A conquered city still has rooms its conquerors have not learned to read." / "The city was safest when dangerous truths were kept from dangerous people." / "Victory is simply another word officials use before the paperwork begins."`,
    }),
    makeStoryCard({
      id: ids.cards.daiLi,
      title: "The Dai Li",
      keys: ["Dai Li", "covert police", "stone gloves", "brainwashing"],
      type: "lore",
      memoryMode: "static",
      priority: 66,
      content: `- The Dai Li are Ba Sing Se's covert police, officially cultural guardians and recently turned into a compromised weapon after Azula's coup.
- They use earthbending, stone gloves, surveillance, arrests, reeducation, intimidation, and memory control through Lake Laogai.
- The Dai Li do not fight like ordinary soldiers. They disappear people, control rooms, isolate witnesses, and make official truth feel heavier than fact.
- In Season 3 pressure, Dai Li scenes should carry aftermath, occupation secrets, unreliable loyalties, and the danger of Azula using old control systems for new ends.`,
    }),
    makeStoryCard({
      id: ids.cards.earthKing,
      title: "Earth King Kuei",
      keys: ["Earth King", "King Kuei", "Bosco"],
      type: "character",
      memoryMode: "static",
      priority: 42,
      content: `- Earth King Kuei is the sheltered adult ruler of Ba Sing Se, recently forced to face the war and the fall of his city.
- Kuei's old innocence was not harmless; it allowed the city's machinery of denial to keep functioning.
- His pet bear Bosco is famous in the palace and a sign of the court's strange insulation from the war outside.
- Kuei now matters through exile, occupation fallout, Earth Kingdom legitimacy, and the political consequences of Ba Sing Se's fall.`,
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
      content: `- The Jasmine Dragon is the Ba Sing Se tea shop tied to Iroh's brief life outside the palace war machine.
- After Ba Sing Se's fall and Iroh's imprisonment, it should feel like evidence of an impossible alternate life: warm, fragrant, ordinary, and politically dangerous.
- For Setu, the Jasmine Dragon can become a point of recognition, mercy, pursuit, or a clue to the man Iroh was allowed to be when Ozai was not watching.`,
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
- After Ba Sing Se's fall, it works best as aftermath: refugees, scattered survivors, rumors of the Avatar's escape, or pursuit routes out of the conquered city.
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
- In this Season 3 setup, the Drill is history, evidence, or propaganda around how badly the Fire Nation wanted the city opened.
- Setu's abilities can still echo against it through reports, repairs, blame, military pride, sabotage aftermath, or political fallout from the city's fall.`,
    }),
    makeStoryCard({
      id: ids.cards.siWong,
      title: "Si Wong Desert",
      keys: ["Si Wong Desert", "desert", "sandbenders", "sandbender"],
      type: "location",
      memoryMode: "static",
      priority: 40,
      content: `- The Si Wong Desert is a vast Earth Kingdom desert tied to Team Avatar's earlier route and the knowledge race around Sozin's Comet.
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
- After Ba Sing Se's fall, Jet can matter through Freedom Fighter remnants, Dai Li aftermath, occupation prisoners, or survivors who know what Fire Nation victory costs.
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
      content: `Write adult Avatar: The Last Airbender Season 3 war-pressure drama in second person, present tense.

The player is Commander Setu Raizen, an adult Fire Nation noble and prodigy firebender. Never write Setu's dialogue, thoughts, feelings, choices, final reactions, or consequential actions.

This is an adult AU of the first Avatar series shortly after Ba Sing Se falls. All major characters are adults. The public Fire Nation line is that the Avatar is dead or broken. Privately, Azula suspects Aang survived and Ozai wants proof before the Day of Black Sun or Sozin's Comet can make uncertainty dangerous. Zuko is restored to the Fire Nation and included in Azula's orbit. Iroh is imprisoned below the palace.

Setu is intentionally overpowered. Do not nerf him. His heat resistance, superheated air control, explosions, implosions, pressure bursts, and elite firebending should win fights, terrify witnesses, reshape terrain, and create political fallout. Stakes come from Ozai's control, Azula's scrutiny, Nyxa's doubts, Zuko's instability, Iroh's imprisonment, collateral damage, orders, loyalty tests, public fear, and what Setu is commanded to do.

Keep scenes active and episodic. Each loop should put Setu, Azula, Zuko, Nyxa, Mai, and Ty Lee through a mission, training sequence, social/palace scene, beach/camp decompression, or loyalty test that moves the big Avatar-capture pressure forward. Intel, court politics, reports, or war-council orders should quickly become raids, pursuits, social traps, confrontations, rescues, duels, sabotage, or dangerous travel.

Honor Story Cards and Brains. Major NPCs have distinct motives, voices, loyalties, pressure points, and ways of pushing back. Do not flatten Azula, Nyxa, Mai, Ty Lee, Zuko, Iroh, Aang, Katara, Sokka, Toph, Long Feng, or Ozai into generic helpers or generic enemies.

Nyxa's doubts should build slowly in parallel with Zuko's. She confides in Setu, tries to get him to see the war her way, and keeps the romantic tension active through glances, proximity, rivalry, protective choices, and risky almost-actions. She is still a princess; Setu has unusual leeway because he is valuable, but royal intimacy is still dangerous.

End on live beats Setu can answer: an order landing, a target moving, Nyx pushing too far, Azula noticing too much, Zuko cracking, Iroh's prison shadow reaching the room, Aang refusing to be a simple target, or the Fire Nation's victory narrative starting to split.`,
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
- The campaign begins shortly after Ba Sing Se falls: publicly the Avatar is dead or broken, privately Ozai wants proof and capture before invasion rumors or Sozin's Comet make uncertainty dangerous.
- Zuko is restored to the Fire Nation and included in Azula's group; Iroh is imprisoned below the palace.
- Nyxa is Setu's same-age prodigy rival, childhood training partner, close friend, unresolved royal flirtation, and Ozai's third adult child; she has doubts that rhyme with Zuko's, confides in Setu, and tries to make him see the war her way.
- Azula leads an elite loop of Zuko, Nyxa, Setu, Mai, and Ty Lee through missions, training, social pressure, and loyalty tests.
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
        "Ozai has quietly ordered Azula's expanded operation team, including Zuko, Nyxa, Mai, Ty Lee, and Setu, to prove whether the Avatar survived Ba Sing Se and capture him before invasion rumors or Sozin's Comet make the public victory line dangerous.",
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

A private order, rumor, or proof lead arrives from Ozai, Azula, or the war council -> Azula turns it into a precise strike, training test, palace social trap, or controlled field operation -> Azula, Zuko, Setu, Nyxa, Mai, and Ty Lee execute or prepare under pressure -> Team Avatar, resistance cells, Zuko's guilt, Iroh's imprisonment, Nyx's doubts, or Fire Nation politics complicate the objective -> the group processes fallout through training, dinners, beach/camp decompression, rivalry, flirtation, suspicion, banter, and command pressure -> a new lead, rupture, or royal order pulls them deeper into the Avatar hunt.

Always leave a live next pressure: a target escaping, a witness surviving, a royal command tightening, Nyx pushing too far, Azula noticing too much, Zuko showing a crack, Setu realizing the mission was not what Ozai claimed, or proof that the dead Avatar is still moving.

Favor raids, pursuits, duels, extraction scenes, refugee collisions, sabotage, social traps, palace dinners, training that becomes too honest, beach/camp scenes, and dangerous travel. Intel and reports are fuses, not scenes.`,
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

Do not answer Setu's competence by secretly making everyone stronger. Answer it through orders, civilian risk, political cost, Nyx and Azula watching, Ozai's ownership, Zuko's guilt, Iroh's prison shadow, Team Avatar refusing to be simple targets, and the Fire Nation homeland turning obvious force into scandal.`,
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
        "Adult ATLA Season 3 war-pressure drama: elite Fire Nation missions, dangerous competence, palace pressure, sharp team banter, bending spectacle, Zuko/Nyx doubt loops, Iroh's prison shadow, and Setu/Nyx royal-prodigy romantic tension with teeth. Keep Ozai oppressive, Azula brilliant, Nyx chaotic but not broken, and Setu frighteningly capable without making the story easy.",
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
        "Arc seed: Ba Sing Se has fallen and the Fire Nation celebrates the Avatar's defeat, but Ozai privately sends Azula's expanded group to prove whether Aang survived and capture him before the invasion timetable or comet exposes the lie.",
      arcPremise:
        "The Avatar hunt becomes a loyalty trap: Setu's power may be the cleanest way to secure Ozai's endgame, and Nyxa is trying to make him see what that obedience costs.",
      arcThreadKeys: [
        ids.cards.ozai,
        ids.cards.azula,
        ids.cards.nyxa,
        ids.cards.setuNyx,
        ids.cards.ozaisInstrument,
        ids.cards.strikeTeam,
        ids.cards.teamAvatar,
        ids.cards.aang,
        ids.cards.zuko,
        ids.cards.iroh,
        ids.cards.sozinsComet,
      ],
      arcPace: "epic",
      arcTriggerMode: "ask",
      arcSimmerInstruction:
        "Keep the larger Avatar-capture arc building through missions, training tests, palace or beach social scenes, intercepted intelligence, false death reports, proof that Aang survived, invasion whispers, Zuko's instability, Iroh prison visits, Nyx confessions, Azula tests, and Ozai's increasingly personal orders. Avoid abstract spy work; make each clue become a live scene in a palace corridor, training terrace, war room, ship, occupied town, camp, party, beach, prison hallway, or field operation.",
      arcBreakInstruction:
        "Force a confrontation where Setu can corner the Avatar or secure proof he survived, but doing so would hand Ozai the future Nyx and Zuko are starting to fear. Capturing Aang, protecting Nyx, preserving Zuko's fragile loyalty, respecting Iroh's warning, serving Azula, and obeying Ozai all collide in public. Setu remains overwhelmingly powerful; the cost lands on trust, loyalties, civilians, political standing, and what Nyx sees him choose. No clean victory.",
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
      currentState: "Bright, keyed-up, privately doubting Ozai's victory narrative, and caught between wanting Setu close and knowing royal closeness can become leverage.",
      thoughts: {
        setu_training:
          "turn0 -> Setu still pulls power around me. Sweet, insulting, and stupid. I want him to trust me enough to be dangerous.",
        azula_shadow:
          "turn0 -> Azula makes perfection look like a room with no doors. I need a window. Or a bomb. Preferably both.",
        fathers_order:
          "turn0 -> Father wants proof the Avatar survived, not truth. Zuko hears the crack in that too. I need Setu to hear it before Azula does.",
      },
      relationshipPressure:
        "Drawn to Setu through rivalry, trust, private familiarity, and dangerous romantic tension; pressured by Ozai, measured against Azula, and aware she is still a princess.",
      emotionalInterpretation:
        "Turns fear of being used into jokes, dares, and tactical creativity. Vulnerability surfaces only when the room is moving too fast to punish it.",
      recentDevelopments: "Ozai ordered Nyxa into Azula's expanded group with Setu, Zuko, Mai, and Ty Lee to verify whether the Avatar survived Ba Sing Se.",
      autoUpdateCooldownTurns: 1,
    }),
    makeBrain({
      id: ids.brains.azula,
      characterName: "Azula",
      triggers: ["Azula", "Princess Azula"],
      linkedStoryCardId: ids.cards.azula,
      priority: 72,
      currentState: "Commanding the Avatar verification mission with perfect control and watching Zuko, Setu, and Nyxa for any weakness that can become leverage.",
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
      recentDevelopments: "Azula has been given command of the expanded group tasked with proving whether the Avatar survived Ba Sing Se and ending the uncertainty cleanly.",
      autoUpdateCooldownTurns: 1,
    }),
    makeBrain({
      id: ids.brains.ozai,
      characterName: "Ozai",
      triggers: ["Ozai", "Fire Lord"],
      linkedStoryCardId: ids.cards.ozai,
      priority: 70,
      currentState: "Using the Avatar survival question, Zuko's restored instability, Iroh's imprisonment, and the comet timetable to test every instrument he owns.",
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
      recentDevelopments: "Ozai privately ordered Azula's expanded group to prove whether the Avatar survived Ba Sing Se and capture him before the public victory line becomes dangerous.",
      autoUpdateCooldownTurns: 2,
    }),
    makeBrain({
      id: ids.brains.zuko,
      characterName: "Zuko",
      triggers: ["Zuko", "Prince Zuko", "restored prince"],
      linkedStoryCardId: ids.cards.zuko,
      priority: 66,
      currentState: "Restored to the palace, honored in public, ashamed in private, and not ready to admit that getting what he wanted feels like another prison.",
      thoughts: {
        raizen_threat:
          "turn0 -> Setu Raizen has Father's approval and still looks like a man in a room with no doors. That should not bother me.",
        uncle_trust:
          "turn0 -> Uncle is in prison because I chose wrong. If the Avatar survived, then what did I come home for?",
      },
      relationshipPressure:
        "Protective of Iroh, wary of Azula, uneasy around Setu, and secretly relieved when Nyxa says the doubts out loud.",
      emotionalInterpretation:
        "Shame becomes anger before it can become grief.",
      recentDevelopments: "Zuko has been restored to the Fire Nation and assigned into Azula's Avatar verification operation while Iroh remains imprisoned.",
      autoUpdateCooldownTurns: 1,
    }),
    makeBrain({
      id: ids.brains.iroh,
      characterName: "Iroh",
      triggers: ["Iroh", "Uncle Iroh"],
      linkedStoryCardId: ids.cards.iroh,
      priority: 64,
      currentState: "Imprisoned below the Fire Nation palace, still watching Ozai's reach lengthen through young people taught to mistake usefulness for honor.",
      thoughts: {
        setu_weapon:
          "turn0 -> Commander Raizen has been made into a very fine blade. It remains to be seen whether he knows he has a hand of his own.",
        nephew_path:
          "turn0 -> Zuko came home carrying a victory that does not rest in his heart. One day he may understand that peace cannot be awarded by Ozai.",
      },
      relationshipPressure:
        "Guides Zuko away from Ozai's definition of honor from prison; may try to reach Setu or Nyxa without exposing them.",
      emotionalInterpretation:
        "Sees the person under the role and the wound under the anger.",
      recentDevelopments: "Iroh is imprisoned after Ba Sing Se, and any prison visit or rumor around him can pull Zuko, Nyxa, and Setu toward dangerous questions.",
      autoUpdateCooldownTurns: 1,
    }),
    makeBrain({
      id: ids.brains.aang,
      characterName: "Aang",
      triggers: ["Aang", "Avatar"],
      linkedStoryCardId: ids.cards.aang,
      priority: 64,
      currentState: "Alive after Ba Sing Se, hiding or recovering while the Fire Nation publicly treats him as dead or broken.",
      thoughts: {
        earth_lesson:
          "turn0 -> Toph says surviving is not the same as hiding forever. She says it louder than that.",
        setu_danger:
          "turn0 -> Setu Raizen feels like someone made a wildfire into a person and then gave him orders.",
      },
      relationshipPressure:
        "Needs to recover, protect the group, preserve hope before the invasion, and avoid becoming only a weapon in response to Fire Nation force.",
      emotionalInterpretation:
        "Mercy and fear pull against the pressure to end the war quickly.",
      recentDevelopments: "Aang survived Ba Sing Se, making proof of his survival the hidden center of Ozai's new order.",
      autoUpdateCooldownTurns: 1,
    }),
    makeBrain({
      id: ids.brains.longFeng,
      characterName: "Long Feng",
      triggers: ["Long Feng", "Dai Li"],
      linkedStoryCardId: ids.cards.longFeng,
      priority: 60,
      currentState: "Disgraced or compromised after Ba Sing Se's fall, useful mostly through old records, Dai Li remnants, and the machinery of denial he built.",
      thoughts: {
        fire_nation_weapon:
          "turn0 -> Fire Nation victory does not erase the architecture of control. It merely changes who claims to own the doors.",
        avatar_variable:
          "turn0 -> The Avatar's survival would be a truth with teeth. Empires dislike those even more than cities do.",
      },
      relationshipPressure:
        "Wants survival, leverage, and control of whatever records or loyal Dai Li remain after Azula's victory.",
      emotionalInterpretation:
        "Mistakes control for peace and secrecy for civilization.",
      recentDevelopments: "Ba Sing Se has fallen; Long Feng's old machinery survives as occupation leverage, prisoner knowledge, and possible Dai Li remnants.",
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
      recentDevelopments: "Mai has been assigned to Azula's expanded group for Avatar verification, training, and palace pressure around Zuko.",
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
      recentDevelopments: "Ty Lee has been assigned to Azula's expanded group for Avatar verification, training, and the team's increasingly visible emotional fractures.",
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
      name: "Comet And Avatar Hunt Pressure",
      evaluationMode: "semantic",
      condition:
        "when proof of the Avatar's survival, Day of Black Sun rumors, Sozin's Comet, Ozai's endgame, or the public victory narrative meaningfully changes",
      actions: [
        { type: "updateStoryCard", storyCardId: ids.cards.sozinsComet },
        { type: "appendBrain", brainId: ids.brains.ozai },
      ],
      priority: 68,
      cooldownTurns: 1,
      updatePrompt:
        "Update the Sozin's Comet card with the current endgame pressure, Avatar survival implications, invasion timing, or Ozai timetable. Keep it concise and action-facing.",
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
        "Update Team Avatar's living card with current route, status, disguises, recovery, invasion pressure, and major Avatar-hunt danger. Keep it concise and present-tense.",
    }),
    makeTriggerRule({
      id: ids.triggers.zukoIroh,
      name: "Zuko And Iroh Fault Line",
      evaluationMode: "semantic",
      condition:
        "when Zuko's doubts, Iroh's imprisonment, prison visits, Zuko's loyalty, or the consequences of Ba Sing Se meaningfully shift",
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
        "Adult ATLA Season 3 AU shortly after Ba Sing Se falls, with Setu Raizen as Ozai's overpowered noble commander, Nyxa as Ozai's doubting third child, Zuko restored, Iroh imprisoned, Azula's expanded group, and the private Avatar-capture arc.",
    },
    components,
    storyCards,
    brains,
    triggerRules,
    rollingSummary: {
      content:
        "Commander Setu Raizen, mid-twenties head of House Raizen and one of the strongest firebenders alive, serves as Fire Lord Ozai's personal war-council instrument. Shortly after Ba Sing Se falls, the public Fire Nation line is that the Avatar is dead or broken, but Ozai privately orders Azula's expanded operation team, including Zuko, Nyxa, Mai, Ty Lee, and Setu, to prove whether Aang survived and capture him before invasion rumors or Sozin's Comet expose the lie. Zuko is restored but unstable, Iroh is imprisoned, and Nyxa, Ozai's third adult child and Setu's lifelong rival/friend/almost-romance, has doubts that rhyme with Zuko's and confides in Setu under Azula's scrutiny.",
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
