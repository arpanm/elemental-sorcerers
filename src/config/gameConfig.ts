import {
  BuildingId,
  CreatureSpecies,
  ElementType,
  ResourceType,
  SoldierArchetype,
  Weapon,
} from '../types/game';

export const SAVE_VERSION = 1;
export const SAVE_STORAGE_KEY = 'elemental_sorcerers_save_v1';

export const ELEMENT_CONFIG: Record<
  ElementType,
  {
    name: string;
    color: string;
    hex: number;
    energyCost: number;
    cooldown: number;
    range: number;
    combatDamage: number;
    combatDesc: string;
    tamingDesc: string;
    unlockedAtLevel: number;
  }
> = {
  fire: {
    name: 'Fire',
    color: '#f97316',
    hex: 0xf97316,
    energyCost: 18,
    cooldown: 3.5,
    range: 11,
    combatDamage: 38,
    combatDesc: 'Scorches soldiers in range and restores +18 campfire fuel if cast near camp.',
    tamingDesc: 'Radiates calming warmth for Wolves and Dragons.',
    unlockedAtLevel: 1,
  },
  water: {
    name: 'Water',
    color: '#38bdf8',
    hex: 0x38bdf8,
    energyCost: 22,
    cooldown: 5.0,
    range: 12,
    combatDamage: 20,
    combatDesc: 'Restores +32 HP to player, nearby pets, and teammates while splashing enemies.',
    tamingDesc: 'Soothes injured or skittish Unicorns, Bears, and Dragons.',
    unlockedAtLevel: 2,
  },
  wind: {
    name: 'Wind',
    color: '#a7f3d0',
    hex: 0x34d399,
    energyCost: 16,
    cooldown: 4.0,
    range: 14,
    combatDamage: 26,
    combatDesc: 'Knocks soldiers backward and grants a burst of stamina.',
    tamingDesc: 'Carries melodic currents that calm agile Wind Sylphs and Dragons.',
    unlockedAtLevel: 3,
  },
  ice: {
    name: 'Ice',
    color: '#60a5fa',
    hex: 0x60a5fa,
    energyCost: 24,
    cooldown: 6.0,
    range: 12,
    combatDamage: 30,
    combatDesc: 'Freezes and slows soldiers for 5 seconds while forming a frost shield.',
    tamingDesc: 'Cools enraged Frosthorns, Bears, and Dragons.',
    unlockedAtLevel: 4,
  },
  earth: {
    name: 'Earth',
    color: '#facc15',
    hex: 0xd97706,
    energyCost: 28,
    cooldown: 7.0,
    range: 13,
    combatDamage: 45,
    combatDesc: 'Staggers heavy/siege soldiers and reinforces nearby camp structures (+35 HP).',
    tamingDesc: 'Grounds ancient tremors to earn the trust of Ancient Dragons.',
    unlockedAtLevel: 5,
  },
};

export const CAMPFIRE_TIERS: Record<
  number,
  {
    tier: number;
    name: string;
    primaryFuel: ResourceType;
    fuelGain: number;
    maxFuel: number;
    burnRatePerSec: number;
    auraRadius: number;
    enemyWeaknessMultiplier: number; // damage taken multiplier or reduction
    recruitmentIntervalSec: number;
    upgradeCost: Partial<Record<ResourceType, number>> & { coins: number };
    benefitDesc: string;
  }
> = {
  1: {
    tier: 1,
    name: 'Kindled Hearth',
    primaryFuel: 'wood',
    fuelGain: 35,
    maxFuel: 100,
    burnRatePerSec: 0.7,
    auraRadius: 14,
    enemyWeaknessMultiplier: 0.85,
    recruitmentIntervalSec: 45,
    upgradeCost: { coins: 0 },
    benefitDesc: 'Basic protective aura (15% soldier weaken) and slow recruitment.',
  },
  2: {
    tier: 2,
    name: 'Coal Brazier',
    primaryFuel: 'coal',
    fuelGain: 50,
    maxFuel: 140,
    burnRatePerSec: 0.6,
    auraRadius: 18,
    enemyWeaknessMultiplier: 0.78,
    recruitmentIntervalSec: 36,
    upgradeCost: { coins: 40, wood: 10, stone: 8, coal: 4 },
    benefitDesc: 'Longer burn time, 22% enemy weaken in aura, faster recruitment.',
  },
  3: {
    tier: 3,
    name: 'Mineral Forgefire',
    primaryFuel: 'minerals',
    fuelGain: 65,
    maxFuel: 180,
    burnRatePerSec: 0.52,
    auraRadius: 22,
    enemyWeaknessMultiplier: 0.72,
    recruitmentIntervalSec: 28,
    upgradeCost: { coins: 85, stone: 12, coal: 8, minerals: 6 },
    benefitDesc: 'Expanded 22m aura, 28% enemy weaken, steady defender recruitment.',
  },
  4: {
    tier: 4,
    name: 'Crystal Resonance Pyre',
    primaryFuel: 'crystals',
    fuelGain: 80,
    maxFuel: 220,
    burnRatePerSec: 0.45,
    auraRadius: 26,
    enemyWeaknessMultiplier: 0.65,
    recruitmentIntervalSec: 22,
    upgradeCost: { coins: 140, minerals: 10, crystals: 6 },
    benefitDesc: '26m crystal aura, 35% enemy weaken, bolsters camp walls.',
  },
  5: {
    tier: 5,
    name: 'Ancient Elemental Core',
    primaryFuel: 'ancientCore',
    fuelGain: 120,
    maxFuel: 300,
    burnRatePerSec: 0.35,
    auraRadius: 32,
    enemyWeaknessMultiplier: 0.55,
    recruitmentIntervalSec: 16,
    upgradeCost: { coins: 220, crystals: 10, ancientCore: 1 },
    benefitDesc: 'Maximum 32m sanctuary aura, 45% enemy weaken, rapid recruitment.',
  },
};

export const WEAPONS: Weapon[] = [
  {
    id: 'apprentice_staff',
    name: 'Apprentice Oak Staff',
    damage: 16,
    range: 4.5,
    attackSpeed: 1.1,
    price: 0,
    tier: 1,
    description: 'Balanced starter staff carved from enchanted heartwood.',
  },
  {
    id: 'ember_blade',
    name: 'Emberstone Wandblade',
    damage: 25,
    range: 5.0,
    attackSpeed: 1.25,
    elementBonus: 'fire',
    price: 55,
    tier: 2,
    description: 'Channels searing strikes and boosts Fire mastery.',
  },
  {
    id: 'tidecaller_glaive',
    name: 'Tidecaller Glaive',
    damage: 34,
    range: 5.8,
    attackSpeed: 1.2,
    elementBonus: 'water',
    price: 110,
    tier: 3,
    description: 'Long-reach river steel glaive infused with soothing currents.',
  },
  {
    id: 'gale_scepter',
    name: 'Zephyr Spire Scepter',
    damage: 44,
    range: 6.5,
    attackSpeed: 1.4,
    elementBonus: 'wind',
    price: 175,
    tier: 4,
    description: 'Swift wind-forged scepter with extended arc reach.',
  },
  {
    id: 'dragonheart_archstaff',
    name: 'Dragonheart Archstaff',
    damage: 62,
    range: 7.2,
    attackSpeed: 1.5,
    elementBonus: 'earth',
    price: 260,
    tier: 5,
    description: 'Legendary archstaff resonating with all five elemental conduits.',
  },
];

export const BUILDING_CONFIG: Record<
  BuildingId,
  {
    name: string;
    baseMaxHp: number;
    maxLevel: number;
    position: { x: number; y: number; z: number };
    baseCost: Partial<Record<ResourceType, number>> & { coins: number };
    description: string;
  }
> = {
  sanctuary: {
    name: 'Sanctuary Nexus',
    baseMaxHp: 450,
    maxLevel: 5,
    position: { x: 0, y: 0, z: -4 },
    baseCost: { coins: 40, wood: 10, stone: 10 },
    description: 'Central heart of the camp. If destroyed, the camp falls!',
  },
  boundary: {
    name: 'Arcane Ward Stones',
    baseMaxHp: 260,
    maxLevel: 4,
    position: { x: 0, y: 0, z: 10 },
    baseCost: { coins: 30, wood: 8, stone: 8 },
    description: 'Expands camp perimeter and slows encroaching raid squads.',
  },
  walls: {
    name: 'Timber & Stone Palisade',
    baseMaxHp: 380,
    maxLevel: 5,
    position: { x: 10, y: 0, z: 6 },
    baseCost: { coins: 35, wood: 12, stone: 10 },
    description: 'Absorbs enemy siege attacks before soldiers reach the Nexus.',
  },
  tower: {
    name: 'Elemental Sentinel Tower',
    baseMaxHp: 280,
    maxLevel: 5,
    position: { x: -10, y: 0, z: 6 },
    baseCost: { coins: 50, wood: 10, stone: 12, coal: 4 },
    description: 'Automatically fires arcane bolts at soldiers near camp.',
  },
  housing: {
    name: 'Ranger Lodge',
    baseMaxHp: 240,
    maxLevel: 4,
    position: { x: -9, y: 0, z: -5 },
    baseCost: { coins: 40, wood: 12, stone: 6 },
    description: 'Increases maximum AI teammate capacity (+2 per level).',
  },
  storage: {
    name: 'Vault Storehouse',
    baseMaxHp: 250,
    maxLevel: 4,
    position: { x: 9, y: 0, z: -5 },
    baseCost: { coins: 35, wood: 10, stone: 8 },
    description: 'Boosts resource gathering yield (+20% per level).',
  },
  hospital: {
    name: 'Herbalist Hospital',
    baseMaxHp: 300,
    maxLevel: 5,
    position: { x: -6, y: 0, z: -10 },
    baseCost: { coins: 45, wood: 10, stone: 8, herbs: 3 },
    description: 'Restores player HP and revives incapacitated pets & teammates.',
  },
  weaponShop: {
    name: 'Arcane Armory & Shop',
    baseMaxHp: 260,
    maxLevel: 4,
    position: { x: 6, y: 0, z: -10 },
    baseCost: { coins: 40, wood: 8, stone: 10 },
    description: 'Unlocks higher-tier weapons and material supply bundles.',
  },
};

export const CREATURE_SPECIES_CONFIG: Record<
  Exclude<CreatureSpecies, 'owl' | 'deer'>,
  {
    name: string;
    maxHp: number;
    damage: number;
    temperament: string;
    requiredOffering: ResourceType;
    offeringAmount: number;
    preferredElements: ElementType[];
    roleDescription: string;
  }
> = {
  wolf: {
    name: 'Emberfang Wolf',
    maxHp: 120,
    damage: 22,
    temperament: 'Cold & Wary — Craves berries and soothing Fire warmth.',
    requiredOffering: 'berries',
    offeringAmount: 2,
    preferredElements: ['fire'],
    roleDescription: 'Agile striker: high single-target bite damage against soldiers.',
  },
  bear: {
    name: 'Ironbark Bear',
    maxHp: 230,
    damage: 26,
    temperament: 'Territorial Guardian — Calmed by berries and Water or Ice.',
    requiredOffering: 'berries',
    offeringAmount: 3,
    preferredElements: ['water', 'ice'],
    roleDescription: 'Heavy tank: intercepts Heavy & Siege soldiers and absorbs blows.',
  },
  unicorn: {
    name: 'Silvermist Unicorn',
    maxHp: 150,
    damage: 18,
    temperament: 'Skittish Healer — Responds to herbs and pure Water attunement.',
    requiredOffering: 'herbs',
    offeringAmount: 2,
    preferredElements: ['water'],
    roleDescription: 'Support healer: periodically restores HP to player and allies.',
  },
  sylph: {
    name: 'Galeplume Sylph',
    maxHp: 135,
    damage: 28,
    temperament: 'Restless Aerial — Drawn to crystals and harmonic Wind currents.',
    requiredOffering: 'crystals',
    offeringAmount: 1,
    preferredElements: ['wind'],
    roleDescription: 'Swift interceptor: harries ranged soldiers with wind gusts.',
  },
  frosthorn: {
    name: 'Glacier Frosthorn',
    maxHp: 210,
    damage: 32,
    temperament: 'Overheated & Fierce — Requires minerals and cooling Ice mist.',
    requiredOffering: 'minerals',
    offeringAmount: 2,
    preferredElements: ['ice'],
    roleDescription: 'Control defender: chills and slows nearby raiding soldiers.',
  },
  dragon: {
    name: 'Aurelius the Ancient Dragon',
    maxHp: 420,
    damage: 58,
    temperament: 'Ancient Sovereign — Demands a Dragon Relic and 3-Stage Elemental Ritual (Fire -> Ice -> Earth).',
    requiredOffering: 'dragonRelic',
    offeringAmount: 1,
    preferredElements: ['fire', 'ice', 'earth'],
    roleDescription: 'Apex guardian: unleashes area elemental breath across siege waves.',
  },
};

export const SOLDIER_CONFIG: Record<
  SoldierArchetype,
  {
    name: string;
    hp: number;
    damage: number;
    speed: number;
    range: number;
    coinReward: number;
  }
> = {
  melee: {
    name: 'Vanguard Footman',
    hp: 75,
    damage: 11,
    speed: 4.2,
    range: 2.4,
    coinReward: 18,
  },
  ranged: {
    name: 'Crossbow Skirmisher',
    hp: 60,
    damage: 13,
    speed: 3.8,
    range: 11.0,
    coinReward: 22,
  },
  heavy: {
    name: 'Ironclad Juggernaut',
    hp: 155,
    damage: 20,
    speed: 2.7,
    range: 2.8,
    coinReward: 35,
  },
  siege: {
    name: 'Brimstone Sapper',
    hp: 130,
    damage: 28,
    speed: 2.5,
    range: 4.0,
    coinReward: 42,
  },
};

export interface LevelConfig {
  level: number;
  name: string;
  regionName: string;
  unlockedElement: ElementType;
  skyColor: string;
  groundColor: number;
  fogColor: number;
  targetCreature: Exclude<CreatureSpecies, 'owl' | 'deer'>;
  extraCreatures: Exclude<CreatureSpecies, 'owl' | 'deer'>[];
  summary: string;
}

export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: {
    level: 1,
    name: 'Level 1: The Kindled Clearing',
    regionName: 'Sunlit Forest Clearing',
    unlockedElement: 'fire',
    skyColor: '#0f172a',
    groundColor: 0x1e3f20,
    fogColor: 0x132a15,
    targetCreature: 'wolf',
    extraCreatures: ['bear'],
    summary: 'Gather wood, sustain the hearth fire, tame an Emberfang Wolf, and repel the scouting patrol.',
  },
  2: {
    level: 2,
    name: 'Level 2: Whispering River Woodland',
    regionName: 'River Woodland',
    unlockedElement: 'water',
    skyColor: '#0c243c',
    groundColor: 0x183d38,
    fogColor: 0x0f292e,
    targetCreature: 'unicorn',
    extraCreatures: ['wolf', 'bear'],
    summary: 'Master Water healing, upgrade the Hospital or Campfire, tame a Silvermist Unicorn, and defeat river raiders.',
  },
  3: {
    level: 3,
    name: 'Level 3: Gale-Swept Canopy',
    regionName: 'Elevated Highland Forest',
    unlockedElement: 'wind',
    skyColor: '#1a2e35',
    groundColor: 0x263f28,
    fogColor: 0x1a2e22,
    targetCreature: 'sylph',
    extraCreatures: ['unicorn', 'bear'],
    summary: 'Harness Wind mobility, construct defensive towers, tame a Galeplume Sylph, and survive coordinated assaults.',
  },
  4: {
    level: 4,
    name: 'Level 4: Rimefrost Sanctuary',
    regionName: 'Frozen Grove',
    unlockedElement: 'ice',
    skyColor: '#172554',
    groundColor: 0x2c4257,
    fogColor: 0x1e293b,
    targetCreature: 'frosthorn',
    extraCreatures: ['sylph', 'bear'],
    summary: 'Wield Ice crowd-control, infuse the pyre with crystals, tame a Glacier Frosthorn, and crush heavy platoons.',
  },
  5: {
    level: 5,
    name: 'Level 5: Ancient Dragon Sovereign',
    regionName: 'Ancient Dragon Forest',
    unlockedElement: 'earth',
    skyColor: '#27173a',
    groundColor: 0x2e2336,
    fogColor: 0x1f1627,
    targetCreature: 'dragon',
    extraCreatures: ['frosthorn', 'unicorn'],
    summary: 'Awaken Earth power, complete the 3-stage Dragon taming ritual, and withstand the Grand Imperial Siege.',
  },
};
