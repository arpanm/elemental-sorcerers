import { describe, expect, it } from 'vitest';
import { CAMPFIRE_TIERS, LEVEL_CONFIGS, WEAPONS } from '../config/gameConfig';
import {
  advanceToNextLevel,
  buyResourceBundle,
  buyWeaponFromShop,
  castElementalAbility,
  collectNearbyLoot,
  completeTamingTimingChallenge,
  constructOrUpgradeBuilding,
  createInitialGameState,
  executeProhibitedWildlifeStrike,
  gatherFromNode,
  observeWildCreature,
  offerFoodToCreature,
  openTreasureChest,
  recoverFromCheckpoint,
  stepSimulation,
  stokeCampfire,
  triggerImmortalEncounter,
  updateImmortalEncounter,
  upgradeCampfireTier,
} from '../systems/engineLogic';
import { parseAndValidateSave } from '../systems/persistence';

describe('Elemental Sorcerers — Core Simulation Engine', () => {
  it('initializes level 1 correctly with Fire unlocked and initial resources', () => {
    const state = createInitialGameState(1);
    expect(state.level).toBe(1);
    expect(state.player.unlockedElements).toEqual(['fire']);
    expect(state.player.activeElement).toBe('fire');
    expect(state.campfire.tier).toBe(1);
    expect(state.campfire.isBurning).toBe(true);
    expect(state.wildCreatures.length).toBeGreaterThan(0);
    expect(state.objectives.length).toBe(5);
  });

  it('gathers resources from nodes and increments objectives', () => {
    let state = createInitialGameState(1);
    const node = state.resourceNodes[0];
    const initialWood = state.inventory.wood;
    state.player.position = { ...node.position };

    state = gatherFromNode(state, node.id);
    expect(state.inventory[node.type]).toBeGreaterThan(initialWood);
    expect(state.objectives.find((o) => o.type === 'gather')?.currentValue).toBe(1);
  });

  it('stokes the campfire with fuel and handles fuel depletion in simulation', () => {
    let state = createInitialGameState(1);
    state.campfire.fuel = 30;
    state.inventory.wood = 5;

    state = stokeCampfire(state);
    expect(state.campfire.fuel).toBeGreaterThan(30);

    // Step simulation 10 seconds to deplete fuel
    state.screen = 'playing';
    const burnRate = CAMPFIRE_TIERS[state.campfire.tier].burnRatePerSec;
    const initialFuel = state.campfire.fuel;
    state = stepSimulation(state, 10);
    expect(state.campfire.fuel).toBeCloseTo(initialFuel - burnRate * 10, 1);
  });

  it('upgrades campfire tiers with valid resource accounting', () => {
    let state = createInitialGameState(1);
    const cost = CAMPFIRE_TIERS[2].upgradeCost;
    state.player.coins = cost.coins;
    state.inventory.wood = cost.wood || 0;
    state.inventory.stone = cost.stone || 0;
    state.inventory.coal = cost.coal || 0;

    state = upgradeCampfireTier(state);
    expect(state.campfire.tier).toBe(2);
    expect(state.campfire.auraRadius).toBe(CAMPFIRE_TIERS[2].auraRadius);
  });

  it('upgrades camp buildings and deducts costs correctly', () => {
    let state = createInitialGameState(1);
    state.player.coins = 200;
    state.inventory.wood = 50;
    state.inventory.stone = 50;
    state.inventory.coal = 10;

    const initialLevel = state.buildings.tower.level;
    state = constructOrUpgradeBuilding(state, 'tower');
    expect(state.buildings.tower.level).toBe(initialLevel + 1);
  });

  it('handles shop purchases for weapons and resource bundles', () => {
    let state = createInitialGameState(1);
    state.player.coins = 150;

    const weaponToBuy = WEAPONS[1];
    state = buyWeaponFromShop(state, weaponToBuy.id);
    expect(state.player.equippedWeapon.id).toBe(weaponToBuy.id);
    expect(state.player.ownedWeapons.some((w) => w.id === weaponToBuy.id)).toBe(true);

    const prevWood = state.inventory.wood;
    state = buyResourceBundle(state, 'wood', 6, 15);
    expect(state.inventory.wood).toBe(prevWood + 6);
  });

  it('executes creature taming pipeline: Observe -> Offer -> Element -> Timing Ring', () => {
    let state = createInitialGameState(1);
    const wolf = state.wildCreatures.find((c) => c.species === 'wolf')!;
    state.player.position = { ...wolf.position };
    state.inventory[wolf.requiredOffering] = 10;

    // 1. Observe
    state = observeWildCreature(state, wolf.id);
    expect(state.wildCreatures.find((c) => c.id === wolf.id)?.taming.stage).toBe('observed');

    // 2. Offer
    state = offerFoodToCreature(state, wolf.id);
    expect(state.wildCreatures.find((c) => c.id === wolf.id)?.taming.stage).toBe('offered');

    // 3. Cast Element (Fire)
    state = castElementalAbility(state, 'fire');
    expect(state.wildCreatures.find((c) => c.id === wolf.id)?.taming.stage).toBe('challenge');

    // 4. Timing ring in-zone lock
    state = completeTamingTimingChallenge(state, wolf.id, 45); // Within 30-72 target
    expect(state.pets.some((p) => p.species === 'wolf')).toBe(true);
    expect(state.wildCreatures.some((c) => c.id === wolf.id)).toBe(false);
  });

  it('enforces Wildlife Protection Rule: penalties on lethal attack and defeat on repeated violation', () => {
    let state = createInitialGameState(1);
    const creature = state.wildCreatures[0];
    const initialHp = state.player.hp;
    const initialScore = state.score;

    state = executeProhibitedWildlifeStrike(state, creature.id);
    expect(state.wildlifeViolations).toBe(1);
    expect(state.player.hp).toBe(initialHp - 40);
    expect(state.score).toBe(initialScore - 60);

    // Repeated strikes should trigger wildlife_wrath defeat
    state.player.hp = 100;
    if (state.wildCreatures[0]) {
      state = executeProhibitedWildlifeStrike(state, state.wildCreatures[0].id);
    }
    if (state.wildCreatures[0]) {
      state = executeProhibitedWildlifeStrike(state, state.wildCreatures[0].id);
      expect(state.screen).toBe('defeat');
      expect(state.defeatReason).toBe('wildlife_wrath');
    }
  });

  it('handles Immortal Owl movement detection and Immortal Deer escape distance', () => {
    let state = createInitialGameState(1);
    state.screen = 'playing';

    // Owl encounter: moving causes damage
    state = triggerImmortalEncounter(state, 'owl');
    expect(state.immortalEncounter.activeType).toBe('owl');
    state.immortalEncounter.phase = 'active';

    const hpBeforeMove = state.player.hp;
    state = updateImmortalEncounter(state, 0.1, 1.5); // Moved 1.5m
    expect(state.player.hp).toBeLessThan(hpBeforeMove);

    // Deer encounter: running away increases escape progress
    let deerState = createInitialGameState(1);
    deerState.screen = 'playing';
    deerState = triggerImmortalEncounter(deerState, 'deer');
    deerState.immortalEncounter.phase = 'active';
    deerState.player.position = { x: 30, y: 0, z: 30 }; // Far away from origin
    deerState = updateImmortalEncounter(deerState, 0.1, 0);
    expect(deerState.immortalEncounter.escapeProgress).toBe(100);
    expect(deerState.immortalEncounter.activeType).toBe('none');
  });

  it('collects loot drops and opens treasure chests once only', () => {
    let state = createInitialGameState(1);
    const chest = state.chests[0];
    state.player.position = { ...chest.position };

    const coinsBefore = state.player.coins;
    state = openTreasureChest(state, chest.id);
    expect(state.player.coins).toBe(coinsBefore + chest.coins);
    expect(state.chests.find((c) => c.id === chest.id)?.opened).toBe(true);

    // Opening again should not award extra coins
    const coinsAfterSecondOpen = state.player.coins;
    state = openTreasureChest(state, chest.id);
    expect(state.player.coins).toBe(coinsAfterSecondOpen);

    // One-time soldier loot drop collection
    state.lootDrops.push({
      id: 'drop_test',
      position: { ...state.player.position },
      coins: 25,
      collected: false,
    });
    state = collectNearbyLoot(state);
    expect(state.player.coins).toBe(coinsAfterSecondOpen + 25);
    expect(state.lootDrops.length).toBe(0);
  });

  it('advances through campaign levels unlocking new elements and resets encounters', () => {
    let state = createInitialGameState(1);
    expect(state.player.unlockedElements).toEqual(['fire']);

    state = advanceToNextLevel(state);
    expect(state.level).toBe(2);
    expect(state.player.unlockedElements).toEqual(['fire', 'water']);
    expect(state.player.activeElement).toBe('water');
    expect(LEVEL_CONFIGS[2].unlockedElement).toBe('water');
  });

  it('recovers from player death checkpoint with tithe penalty and camp restart on nexus loss', () => {
    let state = createInitialGameState(1);
    state.player.coins = 100;
    state.screen = 'defeat';
    state.defeatReason = 'player_died';

    state = recoverFromCheckpoint(state);
    expect(state.screen).toBe('playing');
    expect(state.player.hp).toBe(state.player.maxHp);
    expect(state.player.coins).toBe(85); // 15% tithe deduction

    state.screen = 'defeat';
    state.defeatReason = 'camp_destroyed';
    state = recoverFromCheckpoint(state);
    expect(state.screen).toBe('playing');
    expect(state.level).toBe(1);
  });

  it('verifies save and load serialization consistency', () => {
    const original = createInitialGameState(3);
    original.player.coins = 345;
    original.inventory.crystals = 8;

    const serialized = JSON.stringify(original);
    const parsed = parseAndValidateSave(serialized);
    expect(parsed).not.toBeNull();
    expect(parsed?.level).toBe(3);
    expect(parsed?.player.coins).toBe(345);
    expect(parsed?.inventory.crystals).toBe(8);
  });
});
