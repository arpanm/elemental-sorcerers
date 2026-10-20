export type ElementType = 'fire' | 'water' | 'wind' | 'ice' | 'earth';

export type ResourceType =
  | 'wood'
  | 'stone'
  | 'coal'
  | 'minerals'
  | 'crystals'
  | 'ancientCore'
  | 'berries'
  | 'herbs'
  | 'dragonRelic';

export type CreatureSpecies =
  | 'wolf'
  | 'bear'
  | 'unicorn'
  | 'sylph'
  | 'frosthorn'
  | 'dragon'
  | 'owl'
  | 'deer';

export type PetCommand = 'follow' | 'defend' | 'stay' | 'camp';
export type TeammateRole = 'guard' | 'gather' | 'heal';
export type SoldierArchetype = 'melee' | 'ranged' | 'heavy' | 'siege';
export type SoldierAIState = 'patrol' | 'detect' | 'pursue' | 'attack' | 'retreat' | 'defeated';

export type BuildingId =
  | 'sanctuary'
  | 'boundary'
  | 'walls'
  | 'tower'
  | 'housing'
  | 'storage'
  | 'hospital'
  | 'weaponShop';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Weapon {
  id: string;
  name: string;
  damage: number;
  range: number;
  attackSpeed: number;
  elementBonus?: ElementType;
  price: number;
  tier: number;
  description: string;
}

export interface ResourceNode {
  id: string;
  type: ResourceType;
  label: string;
  position: Vector3D;
  amount: number;
  maxAmount: number;
  respawnTimer: number;
  requiredLevel: number;
}

export interface TreasureChest {
  id: string;
  rarity: 'common' | 'rare';
  position: Vector3D;
  opened: boolean;
  coins: number;
  resources: Partial<Record<ResourceType, number>>;
  weaponId?: string;
}

export interface TamingState {
  stage: 'unstarted' | 'observed' | 'offered' | 'attuned' | 'challenge' | 'tamed';
  trust: number; // 0 to 100
  requiredElementIndex: number;
  elementSequence: ElementType[];
  challengeCursor: number; // 0 to 100 oscillating
  challengeTargetMin: number;
  challengeTargetMax: number;
  failureReason?: string;
}

export interface WildCreature {
  id: string;
  species: CreatureSpecies;
  name: string;
  position: Vector3D;
  hp: number;
  maxHp: number;
  temperament: string;
  requiredOffering: ResourceType;
  offeringAmount: number;
  preferredElements: ElementType[];
  taming: TamingState;
  hostile: boolean;
  immortal: boolean;
}

export interface PetCompanion {
  id: string;
  species: Exclude<CreatureSpecies, 'owl' | 'deer'>;
  name: string;
  roleDescription: string;
  hp: number;
  maxHp: number;
  damage: number;
  active: boolean; // Up to 3 active following/defending, rest stay at camp
  incapacitated: boolean;
  reviveTimer: number;
  command: PetCommand;
  position: Vector3D;
}

export interface Teammate {
  id: string;
  name: string;
  role: TeammateRole;
  hp: number;
  maxHp: number;
  incapacitated: boolean;
  reviveTimer: number;
  position: Vector3D;
}

export interface EnemySoldier {
  id: string;
  archetype: SoldierArchetype;
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  range: number;
  position: Vector3D;
  aiState: SoldierAIState;
  slowTimer: number;
  staggerTimer: number;
  attackCooldown: number;
  spawnTime: number;
}

export interface LootDrop {
  id: string;
  position: Vector3D;
  coins: number;
  weapon?: Weapon;
  collected: boolean;
}

export interface BuildingState {
  id: BuildingId;
  name: string;
  level: number;
  maxLevel: number;
  hp: number;
  maxHp: number;
  position: Vector3D;
  description: string;
}

export interface ImmortalEncounterState {
  activeType: 'none' | 'owl' | 'deer';
  phase: 'warning' | 'active' | 'resolved';
  timer: number;
  originPosition: Vector3D;
  escapeProgress: number; // 0 to 100 for deer
  owlTutorialSeen: boolean;
  deerTutorialSeen: boolean;
  statusMessage: string;
}

export interface LevelObjective {
  id: string;
  description: string;
  type: 'gather' | 'fire' | 'build' | 'tame' | 'defend';
  targetValue: number;
  currentValue: number;
  completed: boolean;
}

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  reducedCameraShake: boolean;
  graphicsQuality: 'low' | 'medium' | 'high';
  mouseSensitivity: number;
}

export interface SpellProjectile {
  id: string;
  element: ElementType | 'arcane';
  startPos: Vector3D;
  targetPos: Vector3D;
  currentPos: Vector3D;
  progress: number; // 0 to 1
  color: number;
}

export interface FloatingCombatText {
  id: string;
  text: string;
  position: Vector3D;
  color: string;
  life: number; // seconds remaining
}

export interface TrainingDummy {
  id: string;
  name: string;
  position: Vector3D;
  hp: number;
  maxHp: number;
  hitReaction: number;
}

export interface GameState {
  saveVersion: number;
  screen: 'title' | 'playing' | 'paused' | 'levelComplete' | 'defeat' | 'victory';
  defeatReason?: 'player_died' | 'camp_destroyed' | 'wildlife_wrath';
  level: number; // 1 to 5
  timeOfDay: number; // 0 to 24
  score: number;
  wildlifeViolations: number;
  assistedStep: number; // 1 = Gather, 2 = Stoke, 3 = Equip/Practice, 4 = Tame, 5 = Defend

  player: {
    position: Vector3D;
    rotationY: number;
    hp: number;
    maxHp: number;
    stamina: number;
    maxStamina: number;
    energy: number;
    maxEnergy: number;
    coins: number;
    equippedWeapon: Weapon;
    ownedWeapons: Weapon[];
    activeElement: ElementType;
    unlockedElements: ElementType[];
    primaryCooldown: number;
    abilityCooldowns: Record<ElementType, number>;
    hospitalHealingTimer: number;
  };

  inventory: Record<ResourceType, number>;

  campfire: {
    tier: number; // 1 to 5
    fuel: number; // 0 to maxFuel
    maxFuel: number;
    auraRadius: number;
    isBurning: boolean;
    recruitmentProgress: number;
  };

  buildings: Record<BuildingId, BuildingState>;
  resourceNodes: ResourceNode[];
  chests: TreasureChest[];
  wildCreatures: WildCreature[];
  pets: PetCompanion[];
  teammates: Teammate[];
  soldiers: EnemySoldier[];
  lootDrops: LootDrop[];
  trainingDummies: TrainingDummy[];
  projectiles: SpellProjectile[];
  floatingTexts: FloatingCombatText[];

  raid: {
    waveNumber: number;
    countdown: number;
    active: boolean;
    finalSiegeUnlocked: boolean;
    finalSiegeCompleted: boolean;
    totalWavesCompletedInLevel: number;
  };

  immortalEncounter: ImmortalEncounterState;
  objectives: LevelObjective[];
  tutorialStep: number; // 0 = done, 1..6 = active steps
  notifications: { id: string; text: string; tone: 'info' | 'warn' | 'danger' | 'success' }[];
  settings: GameSettings;
}
