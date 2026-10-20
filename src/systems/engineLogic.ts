import {
  BUILDING_CONFIG,
  CAMPFIRE_TIERS,
  CREATURE_SPECIES_CONFIG,
  ELEMENT_CONFIG,
  LEVEL_CONFIGS,
  SAVE_VERSION,
  SOLDIER_CONFIG,
  WEAPONS,
} from '../config/gameConfig';
import {
  BuildingId,
  BuildingState,
  CreatureSpecies,
  ElementType,
  EnemySoldier,
  GameState,
  LevelObjective,
  PetCommand,
  PetCompanion,
  ResourceNode,
  ResourceType,
  SoldierArchetype,
  Teammate,
  TeammateRole,
  TreasureChest,
  Vector3D,
  WildCreature,
} from '../types/game';

export function distance2D(a: Vector3D, b: Vector3D): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

export function addNotification(
  state: GameState,
  text: string,
  tone: 'info' | 'warn' | 'danger' | 'success' = 'info'
): GameState {
  const next = [
    { id: `${Date.now()}_${Math.random()}`, text, tone },
    ...state.notifications,
  ].slice(0, 5);
  return { ...state, notifications: next };
}

export function createLevelObjectives(level: number): LevelObjective[] {
  const cfg = LEVEL_CONFIGS[level] || LEVEL_CONFIGS[1];
  const creatureName = CREATURE_SPECIES_CONFIG[cfg.targetCreature].name;
  const gatherTargetResource =
    level === 1
      ? 'Gather Wood & Berries'
      : level === 2
      ? 'Gather Stone, Coal & Herbs'
      : level === 3
      ? 'Gather Minerals & Crystals'
      : level === 4
      ? 'Gather Elemental Crystals & Minerals'
      : 'Recover the Ancient Dragon Relic & Crystals';

  return [
    {
      id: 'gather_res',
      description: `${gatherTargetResource} (${level * 4} total nodes harvested)`,
      type: 'gather',
      targetValue: level * 4,
      currentValue: 0,
      completed: false,
    },
    {
      id: 'maintain_fire',
      description:
        level === 1
          ? 'Stoke the Campfire above 80 fuel'
          : `Upgrade or stoke Campfire to Tier ${Math.min(5, level)}`,
      type: 'fire',
      targetValue: 1,
      currentValue: 0,
      completed: false,
    },
    {
      id: 'upgrade_camp',
      description: `Build or Upgrade a Camp Structure (${level} time${level > 1 ? 's' : ''})`,
      type: 'build',
      targetValue: 1,
      currentValue: 0,
      completed: false,
    },
    {
      id: 'tame_creature',
      description: `Nonlethally Tame a ${creatureName}`,
      type: 'tame',
      targetValue: 1,
      currentValue: 0,
      completed: false,
    },
    {
      id: 'defend_siege',
      description:
        level === 5
          ? 'Repel the Grand Imperial Siege Wave'
          : `Defeat the Level ${level} Concluding Raid Encounter`,
      type: 'defend',
      targetValue: 1,
      currentValue: 0,
      completed: false,
    },
  ];
}

export function generateResourceNodesForLevel(level: number): ResourceNode[] {
  const nodes: ResourceNode[] = [];
  const ringPositions: {
    type: ResourceType;
    label: string;
    radius: number;
    count: number;
    minLvl: number;
  }[] = [
    { type: 'wood', label: 'Enchanted Pine', radius: 18, count: 7, minLvl: 1 },
    { type: 'berries', label: 'Wildberry Bush', radius: 20, count: 5, minLvl: 1 },
    { type: 'stone', label: 'Granite Outcrop', radius: 24, count: 6, minLvl: 1 },
    { type: 'coal', label: 'Coal Seam', radius: 28, count: 4, minLvl: 1 },
    { type: 'herbs', label: 'Moonleaf Herb', radius: 22, count: 4, minLvl: 1 },
    { type: 'minerals', label: 'Iron-Quartz Vein', radius: 32, count: 4, minLvl: 2 },
    { type: 'crystals', label: 'Aether Crystal Spire', radius: 36, count: 4, minLvl: 3 },
    { type: 'ancientCore', label: 'Primordial Core Pedestal', radius: 40, count: 2, minLvl: 4 },
    { type: 'dragonRelic', label: 'Draconic Altar Relic', radius: 38, count: 2, minLvl: 5 },
  ];

  let idx = 1;
  ringPositions.forEach((group) => {
    for (let i = 0; i < group.count; i++) {
      const angle = (i / group.count) * Math.PI * 2 + idx * 0.4;
      const dist = group.radius + ((i % 3) - 1) * 3;
      nodes.push({
        id: `node_${level}_${idx++}`,
        type: group.type,
        label: group.label,
        position: {
          x: Math.cos(angle) * dist,
          y: 0,
          z: Math.sin(angle) * dist,
        },
        amount: 3,
        maxAmount: 3,
        respawnTimer: 0,
        requiredLevel: group.minLvl,
      });
    }
  });

  return nodes;
}

export function generateChestsForLevel(level: number): TreasureChest[] {
  return [
    {
      id: `chest_${level}_common_1`,
      rarity: 'common',
      position: { x: 25, y: 0, z: 22 },
      opened: false,
      coins: 35 + level * 15,
      resources: { wood: 5, stone: 4, berries: 2 },
    },
    {
      id: `chest_${level}_common_2`,
      rarity: 'common',
      position: { x: -27, y: 0, z: 19 },
      opened: false,
      coins: 40 + level * 15,
      resources: { coal: 4, herbs: 3, minerals: 2 },
    },
    {
      id: `chest_${level}_rare_1`,
      rarity: 'rare',
      position: { x: -32, y: 0, z: -28 },
      opened: false,
      coins: 80 + level * 25,
      resources: {
        crystals: 3,
        minerals: 4,
        ...(level >= 4 ? { ancientCore: 1 } : {}),
        ...(level === 5 ? { dragonRelic: 1 } : {}),
      },
    },
  ];
}

export function generateWildCreaturesForLevel(level: number): WildCreature[] {
  const cfg = LEVEL_CONFIGS[level] || LEVEL_CONFIGS[1];
  const speciesList: Exclude<CreatureSpecies, 'owl' | 'deer'>[] = [
    cfg.targetCreature,
    ...cfg.extraCreatures,
  ];

  const coords = [
    { x: 19, y: 0, z: -16 },
    { x: -22, y: 0, z: 15 },
    { x: 26, y: 0, z: 12 },
  ];

  return speciesList.map((spec, idx) => {
    const scfg = CREATURE_SPECIES_CONFIG[spec];
    return {
      id: `wild_${level}_${spec}_${idx}`,
      species: spec,
      name: scfg.name,
      position: coords[idx % coords.length],
      hp: scfg.maxHp,
      maxHp: scfg.maxHp,
      temperament: scfg.temperament,
      requiredOffering: scfg.requiredOffering,
      offeringAmount: scfg.offeringAmount,
      preferredElements: scfg.preferredElements,
      taming: {
        stage: 'unstarted',
        trust: 0,
        requiredElementIndex: 0,
        elementSequence: scfg.preferredElements,
        challengeCursor: 50,
        challengeTargetMin: spec === 'dragon' ? 38 : 30,
        challengeTargetMax: spec === 'dragon' ? 64 : 72,
      },
      hostile: false,
      immortal: false,
    };
  });
}

export function createInitialBuildings(): Record<BuildingId, BuildingState> {
  const entries = Object.entries(BUILDING_CONFIG).map(([key, cfg]) => {
    const id = key as BuildingId;
    const starterLevel = id === 'sanctuary' || id === 'hospital' || id === 'weaponShop' ? 1 : 0;
    return [
      id,
      {
        id,
        name: cfg.name,
        level: starterLevel,
        maxLevel: cfg.maxLevel,
        hp: cfg.baseMaxHp,
        maxHp: cfg.baseMaxHp,
        position: { ...cfg.position },
        description: cfg.description,
      },
    ];
  });
  return Object.fromEntries(entries) as Record<BuildingId, BuildingState>;
}

export function createInitialGameState(startLevel = 1): GameState {
  const unlockedElements: ElementType[] = (
    ['fire', 'water', 'wind', 'ice', 'earth'] as ElementType[]
  ).slice(0, Math.max(1, Math.min(5, startLevel)));

  return {
    saveVersion: SAVE_VERSION,
    screen: 'title',
    level: startLevel,
    timeOfDay: 9.5,
    score: 100,
    wildlifeViolations: 0,

    player: {
      position: { x: 0, y: 0, z: 5 },
      rotationY: 0,
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      energy: 100,
      maxEnergy: 100,
      coins: 65,
      equippedWeapon: WEAPONS[0],
      ownedWeapons: [WEAPONS[0]],
      activeElement: unlockedElements[unlockedElements.length - 1],
      unlockedElements,
      primaryCooldown: 0,
      abilityCooldowns: { fire: 0, water: 0, wind: 0, ice: 0, earth: 0 },
      hospitalHealingTimer: 0,
    },

    inventory: {
      wood: 8,
      stone: 6,
      coal: 3,
      minerals: 2,
      crystals: 1,
      ancientCore: startLevel >= 5 ? 1 : 0,
      berries: 4,
      herbs: 3,
      dragonRelic: startLevel >= 5 ? 1 : 0,
    },

    campfire: {
      tier: 1,
      fuel: 65,
      maxFuel: CAMPFIRE_TIERS[1].maxFuel,
      auraRadius: CAMPFIRE_TIERS[1].auraRadius,
      isBurning: true,
      recruitmentProgress: 0,
    },

    buildings: createInitialBuildings(),
    resourceNodes: generateResourceNodesForLevel(startLevel),
    chests: generateChestsForLevel(startLevel),
    wildCreatures: generateWildCreaturesForLevel(startLevel),
    pets: [],
    teammates: [
      {
        id: 'ally_1',
        name: 'Lyra (Scout)',
        role: 'guard',
        hp: 110,
        maxHp: 110,
        incapacitated: false,
        reviveTimer: 0,
        position: { x: -4, y: 0, z: 3 },
      },
      {
        id: 'ally_2',
        name: 'Rowan (Warden)',
        role: 'gather',
        hp: 110,
        maxHp: 110,
        incapacitated: false,
        reviveTimer: 0,
        position: { x: 4, y: 0, z: 3 },
      },
    ],
    soldiers: [],
    lootDrops: [],

    raid: {
      waveNumber: 1,
      countdown: 55,
      active: false,
      finalSiegeUnlocked: false,
      finalSiegeCompleted: false,
      totalWavesCompletedInLevel: 0,
    },

    immortalEncounter: {
      activeType: 'none',
      phase: 'resolved',
      timer: 0,
      originPosition: { x: 0, y: 0, z: 0 },
      escapeProgress: 0,
      owlTutorialSeen: false,
      deerTutorialSeen: false,
      statusMessage: '',
    },

    objectives: createLevelObjectives(startLevel),
    tutorialStep: 1,
    notifications: [
      {
        id: 'welcome',
        text: 'Welcome to Elemental Sorcerers! Gather wood, tend the campfire, and protect wildlife.',
        tone: 'info',
      },
    ],
    settings: {
      masterVolume: 0.7,
      sfxVolume: 0.8,
      musicVolume: 0.5,
      reducedCameraShake: false,
      graphicsQuality: 'high',
      mouseSensitivity: 1.0,
    },
  };
}

export function gatherFromNode(state: GameState, nodeId: string): GameState {
  const nodeIndex = state.resourceNodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) return state;

  const node = state.resourceNodes[nodeIndex];
  if (node.amount <= 0) {
    return addNotification(state, `${node.label} is depleted and replenishing.`, 'warn');
  }

  const dist = distance2D(state.player.position, node.position);
  if (dist > 6.5) {
    return addNotification(state, 'Move closer to gather from this resource node.', 'warn');
  }

  const storageBonus = state.buildings.storage?.level || 0;
  const yieldAmount = 2 + Math.floor(storageBonus * 0.6);

  const updatedNodes = [...state.resourceNodes];
  updatedNodes[nodeIndex] = {
    ...node,
    amount: node.amount - 1,
    respawnTimer: node.amount - 1 <= 0 ? 25 : 0,
  };

  const updatedObjectives = state.objectives.map((obj) => {
    if (obj.type === 'gather' && !obj.completed) {
      const nextVal = obj.currentValue + 1;
      return {
        ...obj,
        currentValue: nextVal,
        completed: nextVal >= obj.targetValue,
      };
    }
    return obj;
  });

  const nextState: GameState = {
    ...state,
    score: state.score + 5,
    inventory: {
      ...state.inventory,
      [node.type]: (state.inventory[node.type] || 0) + yieldAmount,
    },
    resourceNodes: updatedNodes,
    objectives: checkFinalEncounterUnlock({ ...state, objectives: updatedObjectives }),
    tutorialStep: state.tutorialStep === 1 ? 2 : state.tutorialStep,
  };

  return addNotification(
    nextState,
    `Gathered +${yieldAmount} ${node.type} from ${node.label}.`,
    'success'
  );
}

export function stokeCampfire(state: GameState, useBasicWoodFallback = false): GameState {
  const tierCfg = CAMPFIRE_TIERS[state.campfire.tier];
  const fuelType: ResourceType = useBasicWoodFallback ? 'wood' : tierCfg.primaryFuel;

  if ((state.inventory[fuelType] || 0) < 1) {
    if (!useBasicWoodFallback && (state.inventory.wood || 0) >= 1) {
      return stokeCampfire(state, true);
    }
    return addNotification(state, `Not enough ${fuelType} (or wood) to stoke the campfire!`, 'warn');
  }

  const addedFuel = useBasicWoodFallback ? 25 : tierCfg.fuelGain;
  const newFuel = Math.min(state.campfire.maxFuel, state.campfire.fuel + addedFuel);

  const updatedObjectives = state.objectives.map((obj) => {
    if (obj.type === 'fire' && !obj.completed && newFuel >= 80) {
      return { ...obj, currentValue: 1, completed: true };
    }
    return obj;
  });

  const next: GameState = {
    ...state,
    inventory: {
      ...state.inventory,
      [fuelType]: state.inventory[fuelType] - 1,
    },
    campfire: {
      ...state.campfire,
      fuel: newFuel,
      isBurning: newFuel > 0,
    },
    objectives: checkFinalEncounterUnlock({ ...state, objectives: updatedObjectives }),
    tutorialStep: state.tutorialStep === 2 ? 3 : state.tutorialStep,
  };

  return addNotification(
    next,
    `Added ${fuelType} to campfire (+${addedFuel} fuel). Fire is burning brightly!`,
    'success'
  );
}

export function upgradeCampfireTier(state: GameState): GameState {
  const nextTier = state.campfire.tier + 1;
  if (nextTier > 5) {
    return addNotification(state, 'Campfire is already at maximum Tier 5!', 'info');
  }

  const nextCfg = CAMPFIRE_TIERS[nextTier];
  if (state.player.coins < nextCfg.upgradeCost.coins) {
    return addNotification(
      state,
      `Need ${nextCfg.upgradeCost.coins} coins to upgrade Campfire.`,
      'warn'
    );
  }

  for (const [resKey, amt] of Object.entries(nextCfg.upgradeCost)) {
    if (resKey === 'coins') continue;
    const r = resKey as ResourceType;
    if ((state.inventory[r] || 0) < (amt || 0)) {
      return addNotification(
        state,
        `Missing ${amt} ${r} for Tier ${nextTier} Campfire upgrade.`,
        'warn'
      );
    }
  }

  const newInventory = { ...state.inventory };
  for (const [resKey, amt] of Object.entries(nextCfg.upgradeCost)) {
    if (resKey === 'coins') continue;
    const r = resKey as ResourceType;
    newInventory[r] -= amt || 0;
  }

  const updatedObjectives = state.objectives.map((obj) => {
    if (obj.type === 'fire') {
      return { ...obj, currentValue: 1, completed: true };
    }
    return obj;
  });

  const updated: GameState = {
    ...state,
    score: state.score + 40,
    player: {
      ...state.player,
      coins: state.player.coins - nextCfg.upgradeCost.coins,
    },
    inventory: newInventory,
    campfire: {
      ...state.campfire,
      tier: nextTier,
      maxFuel: nextCfg.maxFuel,
      fuel: nextCfg.maxFuel,
      auraRadius: nextCfg.auraRadius,
      isBurning: true,
    },
    objectives: checkFinalEncounterUnlock({ ...state, objectives: updatedObjectives }),
  };

  return addNotification(
    updated,
    `Upgraded Campfire to Tier ${nextTier}: ${nextCfg.name}!`,
    'success'
  );
}

export function constructOrUpgradeBuilding(state: GameState, buildingId: BuildingId): GameState {
  const bState = state.buildings[buildingId];
  const cfg = BUILDING_CONFIG[buildingId];
  if (!bState || bState.level >= bState.maxLevel) {
    return addNotification(state, `${bState?.name || 'Building'} is already at max level.`, 'info');
  }

  const mult = bState.level + 1;
  const coinCost = cfg.baseCost.coins * mult;
  if (state.player.coins < coinCost) {
    return addNotification(state, `Need ${coinCost} coins to upgrade ${bState.name}.`, 'warn');
  }

  for (const [resKey, baseAmt] of Object.entries(cfg.baseCost)) {
    if (resKey === 'coins') continue;
    const r = resKey as ResourceType;
    const needed = (baseAmt || 0) * mult;
    if ((state.inventory[r] || 0) < needed) {
      return addNotification(state, `Need ${needed} ${r} to build/upgrade ${bState.name}.`, 'warn');
    }
  }

  const nextInv = { ...state.inventory };
  for (const [resKey, baseAmt] of Object.entries(cfg.baseCost)) {
    if (resKey === 'coins') continue;
    const r = resKey as ResourceType;
    nextInv[r] -= (baseAmt || 0) * mult;
  }

  const newMaxHp = cfg.baseMaxHp + bState.level * 90;
  const nextBuildings: Record<BuildingId, BuildingState> = {
    ...state.buildings,
    [buildingId]: {
      ...bState,
      level: bState.level + 1,
      maxHp: newMaxHp,
      hp: newMaxHp,
    },
  };

  const updatedObjectives = state.objectives.map((obj) => {
    if (obj.type === 'build' && !obj.completed) {
      const val = obj.currentValue + 1;
      return { ...obj, currentValue: val, completed: val >= obj.targetValue };
    }
    return obj;
  });

  const next: GameState = {
    ...state,
    score: state.score + 30,
    player: {
      ...state.player,
      coins: state.player.coins - coinCost,
    },
    inventory: nextInv,
    buildings: nextBuildings,
    objectives: checkFinalEncounterUnlock({ ...state, objectives: updatedObjectives }),
  };

  return addNotification(next, `${bState.name} upgraded to Level ${bState.level + 1}!`, 'success');
}

export function buyWeaponFromShop(state: GameState, weaponId: string): GameState {
  const weapon = WEAPONS.find((w) => w.id === weaponId);
  if (!weapon) return state;

  const alreadyOwned = state.player.ownedWeapons.some((w) => w.id === weaponId);
  if (alreadyOwned) {
    return {
      ...state,
      player: {
        ...state.player,
        equippedWeapon: weapon,
      },
    };
  }

  if (state.player.coins < weapon.price) {
    return addNotification(state, `Need ${weapon.price} coins to purchase ${weapon.name}.`, 'warn');
  }

  return addNotification(
    {
      ...state,
      player: {
        ...state.player,
        coins: state.player.coins - weapon.price,
        ownedWeapons: [...state.player.ownedWeapons, weapon],
        equippedWeapon: weapon,
      },
    },
    `Purchased and equipped ${weapon.name}!`,
    'success'
  );
}

export function buyResourceBundle(
  state: GameState,
  resource: ResourceType,
  amount: number,
  price: number
): GameState {
  if (state.player.coins < price) {
    return addNotification(state, `Need ${price} coins to purchase ${resource} bundle.`, 'warn');
  }

  return addNotification(
    {
      ...state,
      player: {
        ...state.player,
        coins: state.player.coins - price,
      },
      inventory: {
        ...state.inventory,
        [resource]: (state.inventory[resource] || 0) + amount,
      },
    },
    `Purchased +${amount} ${resource} for ${price} coins.`,
    'success'
  );
}

export function openTreasureChest(state: GameState, chestId: string): GameState {
  const idx = state.chests.findIndex((c) => c.id === chestId);
  if (idx === -1) return state;
  const chest = state.chests[idx];
  if (chest.opened) {
    return addNotification(state, 'This treasure chest has already been looted.', 'info');
  }

  const nextChests = [...state.chests];
  nextChests[idx] = { ...chest, opened: true };

  const nextInv = { ...state.inventory };
  for (const [k, v] of Object.entries(chest.resources)) {
    const r = k as ResourceType;
    nextInv[r] = (nextInv[r] || 0) + (v || 0);
  }

  return addNotification(
    {
      ...state,
      score: state.score + (chest.rarity === 'rare' ? 50 : 25),
      player: {
        ...state.player,
        coins: state.player.coins + chest.coins,
      },
      inventory: nextInv,
      chests: nextChests,
    },
    `Opened ${chest.rarity.toUpperCase()} Chest! Found +${chest.coins} coins and supplies!`,
    'success'
  );
}

export function startHospitalTreatment(state: GameState): GameState {
  const hospLevel = state.buildings.hospital?.level || 1;
  const coinCost = Math.max(5, 18 - hospLevel * 3);
  if (state.player.coins < coinCost && (state.inventory.herbs || 0) < 1) {
    return addNotification(
      state,
      `Hospital treatment requires ${coinCost} coins or 1 Moonleaf Herb.`,
      'warn'
    );
  }

  const useHerb = (state.inventory.herbs || 0) >= 1;
  const revivedPets = state.pets.map((p) => ({
    ...p,
    incapacitated: false,
    reviveTimer: 0,
    hp: p.maxHp,
  }));
  const revivedAllies = state.teammates.map((t) => ({
    ...t,
    incapacitated: false,
    reviveTimer: 0,
    hp: t.maxHp,
  }));

  return addNotification(
    {
      ...state,
      player: {
        ...state.player,
        hp: state.player.maxHp,
        coins: useHerb ? state.player.coins : state.player.coins - coinCost,
        hospitalHealingTimer: Math.max(1.5, 4.5 - hospLevel * 0.6),
      },
      inventory: {
        ...state.inventory,
        herbs: useHerb ? state.inventory.herbs - 1 : state.inventory.herbs,
      },
      pets: revivedPets,
      teammates: revivedAllies,
    },
    'Hospital treatment complete: Player, Pets, and Teammates fully restored!',
    'success'
  );
}

// ============================================================================
// CREATURE TAMING & WILDLIFE PROTECTION RULE
// ============================================================================

export function observeWildCreature(state: GameState, creatureId: string): GameState {
  const idx = state.wildCreatures.findIndex((c) => c.id === creatureId);
  if (idx === -1) return state;
  const c = state.wildCreatures[idx];

  const updated = [...state.wildCreatures];
  updated[idx] = {
    ...c,
    taming: {
      ...c.taming,
      stage: c.taming.stage === 'unstarted' ? 'observed' : c.taming.stage,
      trust: Math.max(c.taming.trust, 20),
      failureReason: undefined,
    },
  };

  return addNotification(
    { ...state, wildCreatures: updated },
    `Observed ${c.name}: Needs ${c.offeringAmount} ${c.requiredOffering} then ${c.preferredElements
      .map((e) => e.toUpperCase())
      .join(' → ')}.`,
    'info'
  );
}

export function offerFoodToCreature(state: GameState, creatureId: string): GameState {
  const idx = state.wildCreatures.findIndex((c) => c.id === creatureId);
  if (idx === -1) return state;
  const c = state.wildCreatures[idx];

  if (distance2D(state.player.position, c.position) > 9) {
    return addNotification(
      state,
      `Approach within 9m of ${c.name} to offer ${c.requiredOffering}.`,
      'warn'
    );
  }

  if ((state.inventory[c.requiredOffering] || 0) < c.offeringAmount) {
    const updatedFail = [...state.wildCreatures];
    updatedFail[idx] = {
      ...c,
      taming: {
        ...c.taming,
        failureReason: `Missing ${c.offeringAmount} ${c.requiredOffering}`,
      },
    };
    return addNotification(
      { ...state, wildCreatures: updatedFail },
      `You need ${c.offeringAmount} ${c.requiredOffering} to feed ${c.name}.`,
      'warn'
    );
  }

  const updated = [...state.wildCreatures];
  updated[idx] = {
    ...c,
    hostile: false,
    taming: {
      ...c.taming,
      stage: 'offered',
      trust: Math.min(100, Math.max(45, c.taming.trust + 30)),
      requiredElementIndex: 0,
      failureReason: undefined,
    },
  };

  return addNotification(
    {
      ...state,
      inventory: {
        ...state.inventory,
        [c.requiredOffering]: state.inventory[c.requiredOffering] - c.offeringAmount,
      },
      wildCreatures: updated,
    },
    `${c.name} accepted your ${c.requiredOffering}! Now attune with ${c.preferredElements[0].toUpperCase()}.`,
    'success'
  );
}

export function applyElementalTamingInteraction(
  state: GameState,
  creatureId: string,
  element: ElementType
): GameState {
  const idx = state.wildCreatures.findIndex((c) => c.id === creatureId);
  if (idx === -1) return state;
  const c = state.wildCreatures[idx];

  if (c.taming.stage !== 'offered' && c.taming.stage !== 'attuned') {
    const updatedWarn = [...state.wildCreatures];
    updatedWarn[idx] = {
      ...c,
      taming: {
        ...c.taming,
        failureReason: `Offer ${c.offeringAmount} ${c.requiredOffering} first!`,
      },
    };
    return addNotification(
      { ...state, wildCreatures: updatedWarn },
      `Observe and offer ${c.requiredOffering} to ${c.name} before elemental attunement!`,
      'warn'
    );
  }

  const expectedElement = c.taming.elementSequence[c.taming.requiredElementIndex];
  if (element !== expectedElement) {
    const updatedWrong = [...state.wildCreatures];
    updatedWrong[idx] = {
      ...c,
      hostile: true,
      taming: {
        ...c.taming,
        stage: 'observed',
        trust: Math.max(0, c.taming.trust - 25),
        requiredElementIndex: 0,
        failureReason: `Wrong element (${element.toUpperCase()} instead of ${expectedElement.toUpperCase()})! Offering lost & creature agitated.`,
      },
    };
    return addNotification(
      { ...state, wildCreatures: updatedWrong },
      `Taming setback! ${c.name} wanted ${expectedElement.toUpperCase()}, not ${element.toUpperCase()}!`,
      'danger'
    );
  }

  const nextElemIdx = c.taming.requiredElementIndex + 1;
  const allElementsDone = nextElemIdx >= c.taming.elementSequence.length;

  const updated = [...state.wildCreatures];
  updated[idx] = {
    ...c,
    hostile: false,
    taming: {
      ...c.taming,
      stage: allElementsDone ? 'challenge' : 'attuned',
      requiredElementIndex: nextElemIdx,
      trust: Math.min(90, c.taming.trust + 25),
      failureReason: undefined,
    },
  };

  if (!allElementsDone) {
    const nextElem = c.taming.elementSequence[nextElemIdx];
    return addNotification(
      { ...state, wildCreatures: updated },
      `Stage ${nextElemIdx}/${c.taming.elementSequence.length} complete! Next cast ${nextElem.toUpperCase()} on ${c.name}!`,
      'info'
    );
  }

  return addNotification(
    { ...state, wildCreatures: updated },
    `${c.name} is attuned! Lock the Trust Timing Ring inside the green zone to complete taming!`,
    'success'
  );
}

export function completeTamingTimingChallenge(
  state: GameState,
  creatureId: string,
  cursorValue?: number
): GameState {
  const idx = state.wildCreatures.findIndex((c) => c.id === creatureId);
  if (idx === -1) return state;
  const c = state.wildCreatures[idx];

  const actualCursor = cursorValue ?? c.taming.challengeCursor;
  const inZone =
    actualCursor >= c.taming.challengeTargetMin && actualCursor <= c.taming.challengeTargetMax;

  if (!inZone) {
    const updatedFail = [...state.wildCreatures];
    updatedFail[idx] = {
      ...c,
      hostile: true,
      taming: {
        ...c.taming,
        stage: 'observed',
        trust: Math.max(10, c.taming.trust - 30),
        requiredElementIndex: 0,
        failureReason: 'Timing ring missed the trust zone! Creature startled.',
      },
    };
    return addNotification(
      { ...state, wildCreatures: updatedFail },
      `Trust timing missed (${Math.round(actualCursor)}%)! ${c.name} broke free and grew agitated.`,
      'warn'
    );
  }

  const remainingWild = state.wildCreatures.filter((w) => w.id !== creatureId);
  const scfg = CREATURE_SPECIES_CONFIG[c.species as Exclude<CreatureSpecies, 'owl' | 'deer'>];
  const activeCount = state.pets.filter((p) => p.active).length;

  const newPet: PetCompanion = {
    id: `pet_${c.species}_${Date.now()}`,
    species: c.species as Exclude<CreatureSpecies, 'owl' | 'deer'>,
    name: scfg.name,
    roleDescription: scfg.roleDescription,
    hp: scfg.maxHp,
    maxHp: scfg.maxHp,
    damage: scfg.damage,
    active: activeCount < 3,
    incapacitated: false,
    reviveTimer: 0,
    command: activeCount < 3 ? 'follow' : 'camp',
    position: { ...c.position },
  };

  const levelTargetSpecies = LEVEL_CONFIGS[state.level]?.targetCreature;
  const updatedObjectives = state.objectives.map((obj) => {
    if (obj.type === 'tame' && (c.species === levelTargetSpecies || !obj.completed)) {
      return { ...obj, currentValue: 1, completed: true };
    }
    return obj;
  });

  const next: GameState = {
    ...state,
    score: state.score + (c.species === 'dragon' ? 200 : 75),
    wildCreatures: remainingWild,
    pets: [...state.pets, newPet],
    objectives: checkFinalEncounterUnlock({ ...state, objectives: updatedObjectives }),
    tutorialStep: state.tutorialStep === 3 ? 4 : state.tutorialStep,
  };

  return addNotification(
    next,
    `Tamed ${newPet.name}! Added to your Companion Roster (${
      newPet.active ? 'Active' : 'Guarding Camp'
    }).`,
    'success'
  );
}

/**
 * Wildlife Protection Rule:
 * Deliberate prohibited lethal strike against wild creatures is strictly forbidden.
 * Reduces score (-60) and player HP (-40); repeated violations kill the player.
 */
export function executeProhibitedWildlifeStrike(state: GameState, creatureId: string): GameState {
  const idx = state.wildCreatures.findIndex((c) => c.id === creatureId);
  if (idx === -1) return state;

  const violations = state.wildlifeViolations + 1;
  const hpPenalty = 40;
  const newHp = Math.max(0, state.player.hp - hpPenalty);
  const newScore = Math.max(0, state.score - 60);

  const remainingWild = state.wildCreatures.filter((c) => c.id !== creatureId);

  if (newHp <= 0 || violations >= 3) {
    return {
      ...state,
      screen: 'defeat',
      defeatReason: 'wildlife_wrath',
      score: newScore,
      wildlifeViolations: violations,
      player: { ...state.player, hp: 0 },
      wildCreatures: remainingWild,
    };
  }

  return addNotification(
    {
      ...state,
      score: newScore,
      wildlifeViolations: violations,
      player: { ...state.player, hp: newHp },
      wildCreatures: remainingWild,
    },
    `FORBIDDEN WILDLIFE KILL! Forest Pact violated (-60 Score, -${hpPenalty} HP). Violation ${violations}/3!`,
    'danger'
  );
}

// ============================================================================
// IMMORTAL OWL & DEER FOREST ENCOUNTERS
// ============================================================================

export function triggerImmortalEncounter(state: GameState, type: 'owl' | 'deer'): GameState {
  // Never spawn simultaneously
  if (state.immortalEncounter.activeType !== 'none') {
    return state;
  }

  const origin: Vector3D = {
    x: state.player.position.x + 4,
    y: 0,
    z: state.player.position.z - 4,
  };

  const tutorialMsg =
    type === 'owl'
      ? 'IMMORTAL GUARDIAN OWL: Stand completely STILL once its gaze locks! Camera/menus are safe.'
      : 'IMMORTAL CELESTIAL DEER: Do NOT fight! Sprint away outside its 18m pursuit ring!';

  return addNotification(
    {
      ...state,
      immortalEncounter: {
        ...state.immortalEncounter,
        activeType: type,
        phase: 'warning',
        timer: 2.5, // 2.5s warning window before active danger
        originPosition: origin,
        escapeProgress: 0,
        owlTutorialSeen: type === 'owl' ? true : state.immortalEncounter.owlTutorialSeen,
        deerTutorialSeen: type === 'deer' ? true : state.immortalEncounter.deerTutorialSeen,
        statusMessage: tutorialMsg,
      },
    },
    tutorialMsg,
    'warn'
  );
}

export function updateImmortalEncounter(
  state: GameState,
  dt: number,
  playerMovedDistance: number
): GameState {
  const enc = state.immortalEncounter;
  if (enc.activeType === 'none') return state;

  if (enc.phase === 'warning') {
    const nextTimer = enc.timer - dt;
    if (nextTimer <= 0) {
      return {
        ...state,
        immortalEncounter: {
          ...enc,
          phase: 'active',
          timer: enc.activeType === 'owl' ? 4.5 : 9.0,
          statusMessage:
            enc.activeType === 'owl'
              ? 'OWL GAZE ACTIVE: DO NOT MOVE! Hold still!'
              : 'DEER PURSUIT ACTIVE: RUN AWAY from the golden ring!',
        },
      };
    }
    return {
      ...state,
      immortalEncounter: { ...enc, timer: nextTimer },
    };
  }

  if (enc.phase === 'active') {
    if (enc.activeType === 'owl') {
      let hp = state.player.hp;
      let statusMessage = 'Holding still under the Owl’s gaze...';
      if (playerMovedDistance > 0.02) {
        hp = Math.max(0, hp - 22 * dt * 3);
        statusMessage = 'DANGER! Moving under the Immortal Owl’s gaze inflicts damage!';
      }

      const nextTimer = enc.timer - dt;
      if (hp <= 0) {
        return {
          ...state,
          screen: 'defeat',
          defeatReason: 'player_died',
          player: { ...state.player, hp: 0 },
        };
      }

      if (nextTimer <= 0) {
        return addNotification(
          {
            ...state,
            score: state.score + 30,
            immortalEncounter: {
              ...enc,
              activeType: 'none',
              phase: 'resolved',
              timer: 0,
              statusMessage: 'The Immortal Owl departs. It is safe to move again!',
            },
          },
          'The Immortal Owl spreads its wings and departs. Safe to move!',
          'success'
        );
      }

      return {
        ...state,
        player: { ...state.player, hp },
        immortalEncounter: {
          ...enc,
          timer: nextTimer,
          statusMessage,
        },
      };
    }

    if (enc.activeType === 'deer') {
      const distFromOrigin = distance2D(state.player.position, enc.originPosition);
      const escapeProgress = Math.min(100, Math.round((distFromOrigin / 18) * 100));

      if (escapeProgress >= 100) {
        return addNotification(
          {
            ...state,
            score: state.score + 35,
            immortalEncounter: {
              ...enc,
              activeType: 'none',
              phase: 'resolved',
              timer: 0,
              escapeProgress: 100,
              statusMessage: 'Escaped the Immortal Deer’s pursuit radius safely!',
            },
          },
          'You escaped the Immortal Deer’s pursuit radius! Encounter survived.',
          'success'
        );
      }

      let hp = state.player.hp;
      if (distFromOrigin < 12) {
        hp = Math.max(0, hp - 14 * dt);
      }
      if (hp <= 0) {
        return {
          ...state,
          screen: 'defeat',
          defeatReason: 'player_died',
          player: { ...state.player, hp: 0 },
        };
      }

      const nextTimer = enc.timer - dt;
      if (nextTimer <= 0) {
        return addNotification(
          {
            ...state,
            player: { ...state.player, hp },
            immortalEncounter: {
              ...enc,
              activeType: 'none',
              phase: 'resolved',
              timer: 0,
              statusMessage: 'The Immortal Deer vanishes into the mist.',
            },
          },
          'The Immortal Deer fades into the forest mist.',
          'info'
        );
      }

      return {
        ...state,
        player: { ...state.player, hp },
        immortalEncounter: {
          ...enc,
          timer: nextTimer,
          escapeProgress,
          statusMessage: `DEER PURSUIT: Escape Progress ${escapeProgress}% — Keep running away!`,
        },
      };
    }
  }

  return state;
}

// ============================================================================
// ELEMENTAL ABILITIES & COMBAT
// ============================================================================

export function castElementalAbility(state: GameState, element?: ElementType): GameState {
  const chosen = element || state.player.activeElement;
  if (!state.player.unlockedElements.includes(chosen)) {
    return addNotification(state, `${chosen.toUpperCase()} element is not unlocked yet!`, 'warn');
  }

  const cfg = ELEMENT_CONFIG[chosen];
  if ((state.player.abilityCooldowns[chosen] || 0) > 0) {
    return state;
  }
  if (state.player.energy < cfg.energyCost) {
    return addNotification(state, `Not enough Elemental Energy for ${cfg.name}!`, 'warn');
  }

  let nextState: GameState = {
    ...state,
    player: {
      ...state.player,
      activeElement: chosen,
      energy: state.player.energy - cfg.energyCost,
      abilityCooldowns: {
        ...state.player.abilityCooldowns,
        [chosen]: cfg.cooldown,
      },
    },
  };

  // 1. Nonlethal Taming Check on nearby wild creature
  const nearbyCreature = nextState.wildCreatures.find(
    (c) => distance2D(nextState.player.position, c.position) <= cfg.range
  );
  if (nearbyCreature) {
    nextState = applyElementalTamingInteraction(nextState, nearbyCreature.id, chosen);
  }

  // 2. Special Elemental Utility Effects
  if (chosen === 'fire' && distance2D(nextState.player.position, { x: 0, y: 0, z: 0 }) <= 12) {
    const newFuel = Math.min(nextState.campfire.maxFuel, nextState.campfire.fuel + 18);
    nextState = {
      ...nextState,
      campfire: {
        ...nextState.campfire,
        fuel: newFuel,
        isBurning: true,
      },
    };
  }

  if (chosen === 'water') {
    nextState = {
      ...nextState,
      player: {
        ...nextState.player,
        hp: Math.min(nextState.player.maxHp, nextState.player.hp + 32),
      },
      pets: nextState.pets.map((p) => ({
        ...p,
        hp: p.incapacitated ? p.hp : Math.min(p.maxHp, p.hp + 32),
      })),
      teammates: nextState.teammates.map((t) => ({
        ...t,
        hp: t.incapacitated ? t.hp : Math.min(t.maxHp, t.hp + 32),
      })),
    };
  }

  if (chosen === 'wind') {
    nextState = {
      ...nextState,
      player: {
        ...nextState.player,
        stamina: Math.min(nextState.player.maxStamina, nextState.player.stamina + 35),
      },
    };
  }

  if (chosen === 'earth') {
    const healedBuildings = { ...nextState.buildings };
    (Object.keys(healedBuildings) as BuildingId[]).forEach((id) => {
      healedBuildings[id] = {
        ...healedBuildings[id],
        hp: Math.min(healedBuildings[id].maxHp, healedBuildings[id].hp + 35),
      };
    });
    nextState = { ...nextState, buildings: healedBuildings };
  }

  // 3. Offensive Effect strictly against Enemy Soldiers (never damages wildlife or pets)
  const weaponBonus = nextState.player.equippedWeapon.elementBonus === chosen ? 1.25 : 1.0;
  const damage = Math.round(cfg.combatDamage * weaponBonus);

  const updatedSoldiers: EnemySoldier[] = [];
  const newDrops = [...nextState.lootDrops];
  let scoreGain = 0;

  for (const s of nextState.soldiers) {
    const d = distance2D(nextState.player.position, s.position);
    if (d <= cfg.range) {
      const nextHp = s.hp - damage;
      if (nextHp <= 0) {
        scoreGain += 25;
        newDrops.push({
          id: `drop_${s.id}_${Date.now()}`,
          position: { ...s.position },
          coins: SOLDIER_CONFIG[s.archetype].coinReward,
          collected: false,
        });
      } else {
        const pushFactor = chosen === 'wind' ? 4.5 : 0;
        const angle = Math.atan2(
          s.position.z - nextState.player.position.z,
          s.position.x - nextState.player.position.x
        );
        updatedSoldiers.push({
          ...s,
          hp: nextHp,
          position: {
            ...s.position,
            x: s.position.x + Math.cos(angle) * pushFactor,
            z: s.position.z + Math.sin(angle) * pushFactor,
          },
          slowTimer: chosen === 'ice' ? 5.0 : s.slowTimer,
          staggerTimer: chosen === 'earth' ? 3.0 : s.staggerTimer,
        });
      }
    } else {
      updatedSoldiers.push(s);
    }
  }

  nextState = {
    ...nextState,
    score: nextState.score + scoreGain,
    soldiers: updatedSoldiers,
    lootDrops: newDrops,
  };

  return checkRaidCompletion(nextState);
}

export function performPrimaryAttack(state: GameState): GameState {
  if (state.player.primaryCooldown > 0) return state;

  const weapon = state.player.equippedWeapon;
  const updatedSoldiers: EnemySoldier[] = [];
  const newDrops = [...state.lootDrops];
  let hitCount = 0;

  for (const s of state.soldiers) {
    const d = distance2D(state.player.position, s.position);
    if (d <= weapon.range + 1.2) {
      hitCount++;
      const nextHp = s.hp - weapon.damage;
      if (nextHp <= 0) {
        newDrops.push({
          id: `drop_${s.id}_${Date.now()}_${Math.random()}`,
          position: { ...s.position },
          coins: SOLDIER_CONFIG[s.archetype].coinReward,
          collected: false,
        });
      } else {
        updatedSoldiers.push({ ...s, hp: nextHp });
      }
    } else {
      updatedSoldiers.push(s);
    }
  }

  const nextState: GameState = {
    ...state,
    score: state.score + hitCount * 10,
    player: {
      ...state.player,
      primaryCooldown: Number((1 / weapon.attackSpeed).toFixed(2)),
    },
    soldiers: updatedSoldiers,
    lootDrops: newDrops,
  };

  return checkRaidCompletion(nextState);
}

export function collectNearbyLoot(state: GameState): GameState {
  let coinsAdded = 0;
  let collectedCount = 0;

  const remainingDrops = state.lootDrops.map((drop) => {
    if (!drop.collected && distance2D(state.player.position, drop.position) <= 7.5) {
      coinsAdded += drop.coins;
      collectedCount++;
      return { ...drop, collected: true };
    }
    return drop;
  });

  if (collectedCount === 0) return state;

  return addNotification(
    {
      ...state,
      player: {
        ...state.player,
        coins: state.player.coins + coinsAdded,
      },
      lootDrops: remainingDrops.filter((d) => !d.collected),
    },
    `Collected +${coinsAdded} coins from ${collectedCount} defeated soldier drop(s)!`,
    'success'
  );
}

// ============================================================================
// RAIDS, PROGRESSION, AND CHECKPOINT / DEFEAT RECOVERY
// ============================================================================

export function checkFinalEncounterUnlock(state: GameState): LevelObjective[] {
  return state.objectives.map((o) => o);
}

export function arePrerequisitesMet(state: GameState): boolean {
  return state.objectives.filter((o) => o.type !== 'defend').every((o) => o.completed);
}

export function spawnRaidWave(state: GameState, isFinalEncounter = false): GameState {
  const lvl = state.level;
  const archetypes: SoldierArchetype[] =
    lvl === 1
      ? ['melee', 'melee', 'ranged']
      : lvl === 2
      ? ['melee', 'ranged', 'ranged', 'heavy']
      : lvl === 3
      ? ['melee', 'ranged', 'heavy', 'siege']
      : lvl === 4
      ? ['melee', 'ranged', 'heavy', 'heavy', 'siege']
      : ['melee', 'ranged', 'heavy', 'heavy', 'siege', 'siege'];

  const fireMult = state.campfire.isBurning ? 1.0 : 1.25; // Extinguished fire buffs soldiers
  const spawned: EnemySoldier[] = archetypes.map((arch, idx) => {
    const base = SOLDIER_CONFIG[arch];
    const angle = (idx / archetypes.length) * Math.PI * 2;
    const spawnRadius = 34;
    const scaledHp = Math.round(base.hp * (1 + (lvl - 1) * 0.18) * fireMult);
    return {
      id: `soldier_${lvl}_${state.raid.waveNumber}_${idx}_${Date.now()}`,
      archetype: arch,
      name: base.name,
      hp: scaledHp,
      maxHp: scaledHp,
      damage: Math.round(base.damage * fireMult),
      speed: base.speed,
      range: base.range,
      position: {
        x: Math.cos(angle) * spawnRadius,
        y: 0,
        z: Math.sin(angle) * spawnRadius,
      },
      aiState: 'pursue',
      slowTimer: 0,
      staggerTimer: 0,
      attackCooldown: 1.0,
      spawnTime: Date.now(),
    };
  });

  return addNotification(
    {
      ...state,
      soldiers: [...state.soldiers, ...spawned],
      raid: {
        ...state.raid,
        active: true,
        finalSiegeUnlocked: isFinalEncounter || state.raid.finalSiegeUnlocked,
        countdown: 50,
      },
    },
    isFinalEncounter
      ? `FINAL LEVEL ${lvl} DEFENSE ENCOUNTER BEGINS! Defend the Sanctuary Nexus!`
      : `Raid Wave #${state.raid.waveNumber} approaching from the forest perimeter!`,
    'danger'
  );
}

export function checkRaidCompletion(state: GameState): GameState {
  if (!state.raid.active || state.soldiers.length > 0) {
    return state;
  }

  const prereqs = arePrerequisitesMet(state);
  const completedConcludingDefense = prereqs || state.raid.finalSiegeUnlocked;

  const updatedObjectives = state.objectives.map((obj) => {
    if (obj.type === 'defend' && completedConcludingDefense) {
      return { ...obj, currentValue: 1, completed: true };
    }
    return obj;
  });

  const allDone = updatedObjectives.every((o) => o.completed);

  const nextState: GameState = {
    ...state,
    score: state.score + 80,
    player: {
      ...state.player,
      coins: state.player.coins + 35,
    },
    raid: {
      ...state.raid,
      active: false,
      waveNumber: state.raid.waveNumber + 1,
      countdown: 55,
      totalWavesCompletedInLevel: state.raid.totalWavesCompletedInLevel + 1,
      finalSiegeCompleted: allDone,
    },
    objectives: updatedObjectives,
    tutorialStep: state.tutorialStep >= 4 ? 0 : state.tutorialStep,
    screen: allDone ? (state.level >= 5 ? 'victory' : 'levelComplete') : state.screen,
  };

  return addNotification(
    nextState,
    allDone
      ? `Level ${state.level} Complete! All objectives and defense waves victorious!`
      : 'Raid wave defeated! Earned +35 bonus coins.',
    'success'
  );
}

export function advanceToNextLevel(state: GameState): GameState {
  const nextLvl = Math.min(5, state.level + 1);
  const newElement = LEVEL_CONFIGS[nextLvl].unlockedElement;
  const unlocked = state.player.unlockedElements.includes(newElement)
    ? state.player.unlockedElements
    : [...state.player.unlockedElements, newElement];

  const healedBuildings = { ...state.buildings };
  (Object.keys(healedBuildings) as BuildingId[]).forEach((id) => {
    healedBuildings[id] = {
      ...healedBuildings[id],
      hp: healedBuildings[id].maxHp,
    };
  });

  return addNotification(
    {
      ...state,
      screen: 'playing',
      level: nextLvl,
      score: state.score + 150,
      player: {
        ...state.player,
        position: { x: 0, y: 0, z: 5 },
        hp: state.player.maxHp,
        stamina: state.player.maxStamina,
        energy: state.player.maxEnergy,
        coins: state.player.coins + 60,
        unlockedElements: unlocked,
        activeElement: newElement,
      },
      campfire: {
        ...state.campfire,
        fuel: state.campfire.maxFuel,
        isBurning: true,
      },
      buildings: healedBuildings,
      resourceNodes: generateResourceNodesForLevel(nextLvl),
      chests: generateChestsForLevel(nextLvl),
      wildCreatures: generateWildCreaturesForLevel(nextLvl),
      soldiers: [],
      lootDrops: [],
      raid: {
        waveNumber: 1,
        countdown: 60,
        active: false,
        finalSiegeUnlocked: false,
        finalSiegeCompleted: false,
        totalWavesCompletedInLevel: 0,
      },
      objectives: createLevelObjectives(nextLvl),
    },
    `Entered ${LEVEL_CONFIGS[nextLvl].name}! Unlocked ${newElement.toUpperCase()} Element!`,
    'success'
  );
}

export function recoverFromCheckpoint(state: GameState): GameState {
  if (state.defeatReason === 'camp_destroyed') {
    // Restart current level while preserving unlocked elements and companions
    const base = createInitialGameState(state.level);
    return addNotification(
      {
        ...base,
        screen: 'playing',
        pets: state.pets.map((p) => ({ ...p, hp: p.maxHp, incapacitated: false })),
        player: {
          ...base.player,
          ownedWeapons: state.player.ownedWeapons,
          equippedWeapon: state.player.equippedWeapon,
          unlockedElements: state.player.unlockedElements,
        },
      },
      `Level ${state.level} restarted after Sanctuary destruction.`,
      'info'
    );
  }

  // Player death checkpoint recovery: 15% coin penalty, full HP at camp, clear immediate soldiers
  const coinPenalty = Math.floor(state.player.coins * 0.15);
  return addNotification(
    {
      ...state,
      screen: 'playing',
      defeatReason: undefined,
      wildlifeViolations: Math.max(0, state.wildlifeViolations - 1),
      player: {
        ...state.player,
        position: { x: 0, y: 0, z: 4 },
        hp: state.player.maxHp,
        stamina: state.player.maxStamina,
        energy: state.player.maxEnergy,
        coins: Math.max(0, state.player.coins - coinPenalty),
      },
      campfire: {
        ...state.campfire,
        fuel: Math.max(40, state.campfire.fuel),
        isBurning: true,
      },
      soldiers: [],
      raid: {
        ...state.raid,
        active: false,
        countdown: 45,
      },
      immortalEncounter: {
        ...state.immortalEncounter,
        activeType: 'none',
        phase: 'resolved',
      },
    },
    `Recovered at Camp Sanctuary (-${coinPenalty} coins recovery tithe).`,
    'info'
  );
}

export function setPetCommand(state: GameState, petId: string, command: PetCommand): GameState {
  return {
    ...state,
    pets: state.pets.map((p) => (p.id === petId ? { ...p, command } : p)),
  };
}

export function togglePetActive(state: GameState, petId: string): GameState {
  const target = state.pets.find((p) => p.id === petId);
  if (!target) return state;

  if (!target.active) {
    const activeCount = state.pets.filter((p) => p.active).length;
    if (activeCount >= 3) {
      return addNotification(
        state,
        'Maximum 3 active following pets at once! Extra pets defend the camp.',
        'warn'
      );
    }
  }

  return {
    ...state,
    pets: state.pets.map((p) =>
      p.id === petId ? { ...p, active: !p.active, command: !p.active ? 'follow' : 'camp' } : p
    ),
  };
}

export function setTeammateRole(state: GameState, allyId: string, role: TeammateRole): GameState {
  return {
    ...state,
    teammates: state.teammates.map((t) => (t.id === allyId ? { ...t, role } : t)),
  };
}

// ============================================================================
// MAIN SIMULATION STEP (CALLED EVERY FRAME WHILE PLAYING)
// ============================================================================

export function stepSimulation(state: GameState, dt: number, playerMovedDist = 0): GameState {
  if (state.screen !== 'playing') return state;

  let next = { ...state };

  // 1. Day / Night Cycle (24-hour cycle every ~4 minutes)
  next.timeOfDay = (next.timeOfDay + dt * 0.1) % 24;

  // 2. Player Energy, Stamina, Cooldowns
  const nextCooldowns = { ...next.player.abilityCooldowns };
  (Object.keys(nextCooldowns) as ElementType[]).forEach((el) => {
    nextCooldowns[el] = Math.max(0, nextCooldowns[el] - dt);
  });

  next.player = {
    ...next.player,
    energy: Math.min(next.player.maxEnergy, next.player.energy + dt * 6.5),
    stamina: Math.min(next.player.maxStamina, next.player.stamina + dt * 9.0),
    primaryCooldown: Math.max(0, next.player.primaryCooldown - dt),
    abilityCooldowns: nextCooldowns,
    hospitalHealingTimer: Math.max(0, next.player.hospitalHealingTimer - dt),
  };

  // 3. Campfire Fuel Depletion & Teammate Recruitment
  const tierCfg = CAMPFIRE_TIERS[next.campfire.tier];
  const newFuel = Math.max(0, next.campfire.fuel - tierCfg.burnRatePerSec * dt);
  const wasBurning = next.campfire.isBurning;
  const isBurning = newFuel > 0;

  let recruitmentProgress = next.campfire.recruitmentProgress;
  const maxHousingAllies = 2 + (next.buildings.housing?.level || 0) * 2;

  if (isBurning && next.teammates.length < maxHousingAllies) {
    recruitmentProgress += dt;
    if (recruitmentProgress >= tierCfg.recruitmentIntervalSec) {
      recruitmentProgress = 0;
      const newAllyId = `ally_${next.teammates.length + 1}_${Date.now()}`;
      next.teammates = [
        ...next.teammates,
        {
          id: newAllyId,
          name: `Guardian #${next.teammates.length + 1}`,
          role: 'guard',
          hp: 110,
          maxHp: 110,
          incapacitated: false,
          reviveTimer: 0,
          position: { x: -3 + next.teammates.length * 1.5, y: 0, z: 3 },
        },
      ];
      next = addNotification(
        next,
        'A new Ranger Teammate joined your camp, drawn by the Campfire!',
        'success'
      );
    }
  }

  next.campfire = {
    ...next.campfire,
    fuel: newFuel,
    isBurning,
    recruitmentProgress,
  };

  if (wasBurning && !isBurning) {
    next = addNotification(
      next,
      'WARNING: The Campfire has gone out! Enemies deal +25% damage until relit!',
      'danger'
    );
  }

  // 4. Resource Node Replenishment
  next.resourceNodes = next.resourceNodes.map((node) => {
    if (node.amount <= 0) {
      const t = node.respawnTimer - dt;
      if (t <= 0) {
        return { ...node, amount: node.maxAmount, respawnTimer: 0 };
      }
      return { ...node, respawnTimer: t };
    }
    return node;
  });

  // 5. Wild Creature Taming Challenge Cursor Oscillation
  next.wildCreatures = next.wildCreatures.map((c) => {
    if (c.taming.stage === 'challenge') {
      const nextCursor = (c.taming.challengeCursor + dt * 68) % 100;
      return {
        ...c,
        taming: {
          ...c.taming,
          challengeCursor: nextCursor,
        },
      };
    }
    return c;
  });

  // 6. Immortal Owl & Deer Update
  next = updateImmortalEncounter(next, dt, playerMovedDist);

  // 7. Teammate Roles (Gather, Heal, Guard) & Tower Defense
  let woodPassive = 0;
  next.teammates = next.teammates.map((ally) => {
    if (ally.incapacitated) return ally;
    if (ally.role === 'gather' && Math.random() < dt * 0.08) {
      woodPassive += 1;
    }
    if (ally.role === 'heal' && next.player.hp < next.player.maxHp) {
      next.player = {
        ...next.player,
        hp: Math.min(next.player.maxHp, next.player.hp + dt * 2.2),
      };
    }
    return ally;
  });
  if (woodPassive > 0) {
    next.inventory = { ...next.inventory, wood: next.inventory.wood + woodPassive };
  }

  // 8. Raid Countdown & Soldier AI
  if (!next.raid.active) {
    const nightPressure = next.timeOfDay >= 19 || next.timeOfDay <= 5 ? 1.35 : 1.0;
    const nextCountdown = next.raid.countdown - dt * nightPressure;
    if (nextCountdown <= 0) {
      const finalReady = arePrerequisitesMet(next);
      next = spawnRaidWave(next, finalReady);
    } else {
      next.raid = { ...next.raid, countdown: nextCountdown };
    }
  } else {
    // Active Raid Soldier AI + Ally/Pet/Tower Defense
    const towerLevel = next.buildings.tower?.level || 0;
    const activePets = next.pets.filter((p) => !p.incapacitated);
    const activeGuards = next.teammates.filter((t) => !t.incapacitated);

    const allyDps =
      towerLevel * 6 +
      activeGuards.length * 4.5 +
      activePets.reduce((sum, p) => sum + p.damage * 0.35, 0);

    const updatedSoldiers: EnemySoldier[] = [];
    const newDrops = [...next.lootDrops];
    let sanctuaryHp = next.buildings.sanctuary.hp;
    let wallHp = next.buildings.walls.hp;
    let playerHp = next.player.hp;

    const now = Date.now();

    for (let idx = 0; idx < next.soldiers.length; idx++) {
      const s = next.soldiers[idx];

      // Fail-safe timeout if an enemy ever gets stuck > 65 seconds
      if (now - s.spawnTime > 65000) {
        newDrops.push({
          id: `drop_timeout_${s.id}`,
          position: { ...s.position },
          coins: SOLDIER_CONFIG[s.archetype].coinReward,
          collected: false,
        });
        continue;
      }

      // Apply ally/pet/tower defense damage to leading soldier
      let hp = s.hp;
      if (idx === 0 && distance2D(s.position, { x: 0, y: 0, z: 0 }) < 24) {
        hp -= allyDps * dt;
      }

      if (hp <= 0) {
        newDrops.push({
          id: `drop_${s.id}_${now}`,
          position: { ...s.position },
          coins: SOLDIER_CONFIG[s.archetype].coinReward,
          collected: false,
        });
        continue;
      }

      // Move toward Player or Sanctuary
      const targetPos =
        s.archetype === 'siege' || distance2D(s.position, next.player.position) > 15
          ? next.buildings.sanctuary.position
          : next.player.position;

      const distToTarget = distance2D(s.position, targetPos);
      const speedMult = s.staggerTimer > 0 ? 0 : s.slowTimer > 0 ? 0.45 : 1.0;

      const pos = { ...s.position };
      let aiState = s.aiState;

      if (distToTarget > s.range) {
        aiState = 'pursue';
        const angle = Math.atan2(targetPos.z - pos.z, targetPos.x - pos.x);
        pos.x += Math.cos(angle) * s.speed * speedMult * dt;
        pos.z += Math.sin(angle) * s.speed * speedMult * dt;
      } else {
        aiState = 'attack';
        const auraWeaken =
          next.campfire.isBurning &&
          distance2D(pos, { x: 0, y: 0, z: 0 }) <= next.campfire.auraRadius
            ? tierCfg.enemyWeaknessMultiplier
            : 1.15;

        const dmgThisTick = s.damage * auraWeaken * dt * 0.45;
        if (targetPos === next.player.position) {
          playerHp = Math.max(0, playerHp - dmgThisTick);
        } else if (wallHp > 0 && next.buildings.walls.level > 0) {
          wallHp = Math.max(0, wallHp - dmgThisTick);
        } else {
          sanctuaryHp = Math.max(0, sanctuaryHp - dmgThisTick);
        }
      }

      updatedSoldiers.push({
        ...s,
        hp,
        position: pos,
        aiState,
        slowTimer: Math.max(0, s.slowTimer - dt),
        staggerTimer: Math.max(0, s.staggerTimer - dt),
      });
    }

    next.soldiers = updatedSoldiers;
    next.lootDrops = newDrops;
    next.player = { ...next.player, hp: playerHp };
    next.buildings = {
      ...next.buildings,
      walls: { ...next.buildings.walls, hp: wallHp },
      sanctuary: { ...next.buildings.sanctuary, hp: sanctuaryHp },
    };

    if (playerHp <= 0) {
      return {
        ...next,
        screen: 'defeat',
        defeatReason: 'player_died',
      };
    }

    if (sanctuaryHp <= 0) {
      return {
        ...next,
        screen: 'defeat',
        defeatReason: 'camp_destroyed',
      };
    }

    next = checkRaidCompletion(next);
  }

  return next;
}
