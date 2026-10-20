import { useEffect, useRef, useState } from 'react';
import { WorldCanvas } from './components/WorldCanvas';
import {
  BUILDING_CONFIG,
  CAMPFIRE_TIERS,
  ELEMENT_CONFIG,
  LEVEL_CONFIGS,
  WEAPONS,
} from './config/gameConfig';
import { soundFX } from './systems/audio';
import {
  addNotification,
  advanceToNextLevel,
  arePrerequisitesMet,
  buyResourceBundle,
  buyWeaponFromShop,
  castElementalAbility,
  collectNearbyLoot,
  completeTamingTimingChallenge,
  constructOrUpgradeBuilding,
  createInitialGameState,
  distance2D,
  executeProhibitedWildlifeStrike,
  gatherFromNode,
  observeWildCreature,
  offerFoodToCreature,
  openTreasureChest,
  performPrimaryAttack,
  recoverFromCheckpoint,
  setPetCommand,
  setTeammateRole,
  spawnRaidWave,
  startHospitalTreatment,
  stepSimulation,
  stokeCampfire,
  togglePetActive,
  triggerImmortalEncounter,
  upgradeCampfireTier,
} from './systems/engineLogic';
import {
  clearLocalSave,
  loadGameFromLocal,
  parseAndValidateSave,
  saveGameToLocal,
} from './systems/persistence';
import {
  BuildingId,
  ElementType,
  GameState,
  PetCommand,
  ResourceType,
  TeammateRole,
} from './types/game';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = loadGameFromLocal();
    if (saved) {
      return { ...saved, screen: 'title' };
    }
    return createInitialGameState(1);
  });

  const [activeTab, setActiveTab] = useState<
    'none' | 'camp' | 'pets' | 'shop' | 'hospital' | 'settings' | 'dev'
  >('none');
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [lethalHoldProgress, setLethalHoldProgress] = useState(0);

  const playerMovedAccumRef = useRef(0);
  const lethalHoldIntervalRef = useRef<number | null>(null);

  // Sync audio volumes
  useEffect(() => {
    soundFX.setVolumes(gameState.settings.masterVolume, gameState.settings.sfxVolume);
  }, [gameState.settings.masterVolume, gameState.settings.sfxVolume]);

  // Main Simulation Tick (10Hz logical simulation step for deterministic resource/AI updates)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setGameState((prev) => {
        if (prev.screen !== 'playing') return prev;
        const moved = playerMovedAccumRef.current;
        playerMovedAccumRef.current = 0;
        return stepSimulation(prev, 0.1, moved);
      });
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Pause simulation when browser tab loses focus
  useEffect(() => {
    const onBlur = () => {
      setGameState((prev) => (prev.screen === 'playing' ? { ...prev, screen: 'paused' } : prev));
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  // Keyboard number hotkeys for element switching & F2 Developer Mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'F2') {
        e.preventDefault();
        setActiveTab((prev) => (prev === 'dev' ? 'none' : 'dev'));
      }
      if (e.code === 'Escape') {
        setGameState((prev) =>
          prev.screen === 'playing'
            ? { ...prev, screen: 'paused' }
            : prev.screen === 'paused'
            ? { ...prev, screen: 'playing' }
            : prev
        );
      }

      const map: Record<string, ElementType> = {
        Digit1: 'fire',
        Digit2: 'water',
        Digit3: 'wind',
        Digit4: 'ice',
        Digit5: 'earth',
      };
      const chosen = map[e.code];
      if (chosen) {
        setGameState((prev) => {
          if (!prev.player.unlockedElements.includes(chosen)) return prev;
          return {
            ...prev,
            player: { ...prev.player, activeElement: chosen },
          };
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleMovePlayer = (
    newPos: { x: number; y: number; z: number },
    rotY: number,
    movedDist: number
  ) => {
    playerMovedAccumRef.current += movedDist;
    setGameState((prev) => ({
      ...prev,
      player: {
        ...prev.player,
        position: newPos,
        rotationY: rotY,
      },
    }));
  };

  const handlePrimaryAttack = () => {
    soundFX.playAttack();
    setGameState((prev) => performPrimaryAttack(prev));
  };

  const handleCastElement = (el?: ElementType) => {
    const targetEl = el || gameState.player.activeElement;
    soundFX.playElement(targetEl);
    setGameState((prev) => castElementalAbility(prev, targetEl));
  };

  // Context-sensitive E key action (Gather -> Open Chest -> Loot -> Stoke Fire -> Observe/Offer/Tame)
  const handleContextInteract = () => {
    setGameState((prev) => {
      // 1. Collect nearby soldier drops
      const hasDrop = prev.lootDrops.some(
        (d) => !d.collected && distance2D(prev.player.position, d.position) <= 7.5
      );
      if (hasDrop) {
        soundFX.playGather();
        return collectNearbyLoot(prev);
      }

      // 2. Open nearby treasure chest
      const chest = prev.chests.find(
        (c) => !c.opened && distance2D(prev.player.position, c.position) <= 6.5
      );
      if (chest) {
        soundFX.playTameSuccess();
        return openTreasureChest(prev, chest.id);
      }

      // 3. Gather from nearby resource node
      const node = prev.resourceNodes.find(
        (n) => n.amount > 0 && distance2D(prev.player.position, n.position) <= 6.5
      );
      if (node) {
        soundFX.playGather();
        return gatherFromNode(prev, node.id);
      }

      // 4. Stoke campfire if near center
      if (distance2D(prev.player.position, { x: 0, y: 0, z: 0 }) <= 5.5) {
        soundFX.playElement('fire');
        return stokeCampfire(prev);
      }

      // 5. Interact with nearby wild creature
      const creature = prev.wildCreatures.find(
        (c) => distance2D(prev.player.position, c.position) <= 9.0
      );
      if (creature) {
        if (creature.taming.stage === 'unstarted') {
          return observeWildCreature(prev, creature.id);
        }
        if (creature.taming.stage === 'observed') {
          return offerFoodToCreature(prev, creature.id);
        }
        if (creature.taming.stage === 'challenge') {
          soundFX.playTameSuccess();
          return completeTamingTimingChallenge(prev, creature.id);
        }
      }

      return addNotification(
        prev,
        'No interactive target in range. Move closer to a tree, rock, chest, campfire, or creature.',
        'info'
      );
    });
  };

  // Deliberate Hold-to-Kill Prohibited Wildlife Action
  const startLethalHold = (creatureId: string) => {
    soundFX.playPenaltyWarning();
    setLethalHoldProgress(10);
    if (lethalHoldIntervalRef.current) clearInterval(lethalHoldIntervalRef.current);
    lethalHoldIntervalRef.current = window.setInterval(() => {
      setLethalHoldProgress((prev) => {
        if (prev >= 100) {
          if (lethalHoldIntervalRef.current) clearInterval(lethalHoldIntervalRef.current);
          setGameState((st) => executeProhibitedWildlifeStrike(st, creatureId));
          return 0;
        }
        return prev + 18;
      });
    }, 150);
  };

  const stopLethalHold = () => {
    if (lethalHoldIntervalRef.current) {
      clearInterval(lethalHoldIntervalRef.current);
      lethalHoldIntervalRef.current = null;
    }
    setLethalHoldProgress(0);
  };

  const handleExportSave = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(gameState, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `elemental_sorcerers_level${gameState.level}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const handleImportSave = () => {
    const validated = parseAndValidateSave(importJsonText);
    if (!validated) {
      alert('Invalid or incompatible save JSON.');
      return;
    }
    saveGameToLocal(validated);
    setGameState({ ...validated, screen: 'playing' });
    setShowImportModal(false);
    setImportJsonText('');
  };

  const nearestCreature = gameState.wildCreatures.find(
    (c) => distance2D(gameState.player.position, c.position) <= 12
  );
  const nearestNode = gameState.resourceNodes.find(
    (n) => n.amount > 0 && distance2D(gameState.player.position, n.position) <= 7
  );
  const levelCfg = LEVEL_CONFIGS[gameState.level] || LEVEL_CONFIGS[1];
  const fireTierCfg = CAMPFIRE_TIERS[gameState.campfire.tier];
  const prereqsDone = arePrerequisitesMet(gameState);

  // ============================================================================
  // TITLE SCREEN
  // ============================================================================
  if (gameState.screen === 'title') {
    const hasSavedGame = Boolean(loadGameFromLocal());
    return (
      <div className="w-screen h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-emerald-950 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-8 shadow-2xl">
          <div className="text-xs uppercase tracking-widest text-amber-400 font-semibold mb-1">
            5-Level 3D Fantasy Survival Campaign
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3">Elemental Sorcerers</h1>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            Protect the enchanted forest sanctuary alongside AI teammates and tamed mythical
            companions. Gather resources, sustain the 5-tier elemental campfire, master Fire, Water,
            Wind, Ice, and Earth, respect the Immortal Owl and Deer, and tame the Ancient Dragon!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => {
                const fresh = createInitialGameState(1);
                fresh.screen = 'playing';
                saveGameToLocal(fresh);
                setGameState(fresh);
              }}
              className="py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer"
            >
              Start New Campaign (Level 1)
            </button>

            {hasSavedGame && (
              <button
                onClick={() => {
                  const loaded = loadGameFromLocal();
                  if (loaded) setGameState({ ...loaded, screen: 'playing' });
                }}
                className="py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition cursor-pointer"
              >
                Continue Saved Campaign (Lv.{gameState.level})
              </button>
            )}

            <button
              onClick={() => setShowImportModal(true)}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 cursor-pointer"
            >
              Import Save JSON
            </button>

            <button
              onClick={handleExportSave}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 cursor-pointer"
            >
              Export Current Save JSON
            </button>
          </div>

          <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 text-xs text-slate-300 space-y-1.5">
            <div className="font-bold text-amber-300 uppercase">Controls & Core Rules</div>
            <div>• Move: WASD / Arrow Keys | Sprint: Hold Shift | Rotate Camera: Drag Mouse</div>
            <div>• Primary Staff Attack: Space | Elemental Ability: Q | Context Action: E</div>
            <div>• Switch Unlocked Elements: Keys 1 (Fire), 2 (Water), 3 (Wind), 4 (Ice), 5 (Earth)</div>
            <div>• Wildlife Pact: Never kill wild creatures! Use Observe → Offer → Element → Timing Ring.</div>
            <div>• Immortal Owl: Stand completely STILL during its gaze. Immortal Deer: Sprint away!</div>
          </div>

          {showImportModal && (
            <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-indigo-500/40">
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder="Paste exported save JSON here..."
                className="w-full h-28 bg-slate-900 text-xs p-2 rounded border border-slate-700 text-slate-100"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleImportSave}
                  className="px-4 py-1.5 bg-emerald-600 rounded text-xs font-bold cursor-pointer"
                >
                  Load Imported Save
                </button>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-1.5 bg-slate-700 rounded text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* 3D World Viewport */}
      <WorldCanvas
        gameState={gameState}
        onMovePlayer={handleMovePlayer}
        onPrimaryAttack={handlePrimaryAttack}
        onCastElement={() => handleCastElement()}
        onContextInteract={handleContextInteract}
      />

      {/* TOP HUD BAR: Vitals, Campfire Status, Level & Objectives */}
      <div className="fixed top-3 left-3 right-3 flex flex-wrap items-start justify-between gap-3 pointer-events-none z-10">
        {/* Player Vitals */}
        <div className="pointer-events-auto bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 w-72 shadow-lg">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-bold text-sm text-amber-300">{levelCfg.name}</span>
            <span className="text-xs bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700">
              Score: {gameState.score}
            </span>
          </div>

          {/* HP */}
          <div className="text-xs flex justify-between mb-0.5">
            <span className="text-rose-300">Health</span>
            <span>
              {Math.round(gameState.player.hp)} / {gameState.player.maxHp}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-rose-500 transition-all"
              style={{ width: `${(gameState.player.hp / gameState.player.maxHp) * 100}%` }}
            />
          </div>

          {/* Stamina */}
          <div className="text-xs flex justify-between mb-0.5">
            <span className="text-emerald-300">Stamina</span>
            <span>
              {Math.round(gameState.player.stamina)} / {gameState.player.maxStamina}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-emerald-400 transition-all"
              style={{
                width: `${(gameState.player.stamina / gameState.player.maxStamina) * 100}%`,
              }}
            />
          </div>

          {/* Elemental Energy */}
          <div className="text-xs flex justify-between mb-0.5">
            <span className="text-sky-300">Elemental Energy</span>
            <span>
              {Math.round(gameState.player.energy)} / {gameState.player.maxEnergy}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-sky-400 transition-all"
              style={{ width: `${(gameState.player.energy / gameState.player.maxEnergy) * 100}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-slate-300 pt-1 border-t border-slate-800">
            <span>🪙 Coins: {gameState.player.coins}</span>
            <span>⚔️ {gameState.player.equippedWeapon.name}</span>
          </div>
        </div>

        {/* Campfire & Sanctuary Status */}
        <div className="pointer-events-auto bg-slate-900/90 border border-amber-500/40 rounded-xl p-3 w-80 shadow-lg">
          <div className="flex justify-between items-center text-xs font-bold mb-1">
            <span className="text-amber-400">
              🔥 Tier {gameState.campfire.tier}: {fireTierCfg.name}
            </span>
            <span className={gameState.campfire.isBurning ? 'text-emerald-400' : 'text-rose-400'}>
              {gameState.campfire.isBurning
                ? `Aura ${gameState.campfire.auraRadius}m`
                : 'EXTINGUISHED (+25% Enemy Str)'}
            </span>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-1">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{
                width: `${(gameState.campfire.fuel / gameState.campfire.maxFuel) * 100}%`,
              }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-300 mb-2">
            <span>
              Fuel: {Math.round(gameState.campfire.fuel)}/{gameState.campfire.maxFuel} (~
              {Math.round(gameState.campfire.fuel / fireTierCfg.burnRatePerSec)}s)
            </span>
            <span>
              Nexus HP: {Math.round(gameState.buildings.sanctuary.hp)}/
              {gameState.buildings.sanctuary.maxHp}
            </span>
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => setGameState((st) => stokeCampfire(st))}
              className="flex-1 py-1 px-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-xs cursor-pointer"
            >
              Stoke ({fireTierCfg.primaryFuel}/wood)
            </button>
            {gameState.campfire.tier < 5 && (
              <button
                onClick={() => setGameState((st) => upgradeCampfireTier(st))}
                className="py-1 px-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-xs cursor-pointer"
              >
                Upgrade Tier
              </button>
            )}
          </div>
        </div>

        {/* Objectives & Raid Countdown Checklist */}
        <div className="pointer-events-auto bg-slate-900/90 border border-slate-700 rounded-xl p-3 w-80 shadow-lg">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Level {gameState.level} Objectives
            </span>
            <span className="text-xs font-semibold text-amber-300">
              {gameState.raid.active
                ? `⚔️ RAID ACTIVE (${gameState.soldiers.length} left)`
                : `Next Raid: ${Math.ceil(gameState.raid.countdown)}s`}
            </span>
          </div>

          <ul className="space-y-1 text-xs mb-2">
            {gameState.objectives.map((obj) => (
              <li
                key={obj.id}
                className={`flex items-center justify-between ${
                  obj.completed ? 'text-emerald-400 line-through' : 'text-slate-200'
                }`}
              >
                <span>
                  {obj.completed ? '✔ ' : '○ '}
                  {obj.description}
                </span>
                <span className="ml-2 text-[11px] text-slate-400">
                  {obj.currentValue}/{obj.targetValue}
                </span>
              </li>
            ))}
          </ul>

          {prereqsDone && !gameState.raid.active && (
            <button
              onClick={() => {
                soundFX.playRaidHorn();
                setGameState((st) => spawnRaidWave(st, true));
              }}
              className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs cursor-pointer"
            >
              ⚔️ Launch Final Level {gameState.level} Siege Encounter Now
            </button>
          )}
        </div>
      </div>

      {/* IMMORTAL OWL / DEER ALERT BANNER */}
      {gameState.immortalEncounter.activeType !== 'none' && (
        <div className="fixed top-36 left-1/2 -translate-x-1/2 z-30 bg-rose-950/95 border-2 border-amber-400 rounded-2xl px-6 py-3 text-center shadow-2xl max-w-lg">
          <div className="text-xs uppercase font-bold text-amber-300">
            Immortal Forest Guardian Encounter ({gameState.immortalEncounter.phase.toUpperCase()})
          </div>
          <div className="text-sm font-extrabold text-white mt-0.5">
            {gameState.immortalEncounter.statusMessage}
          </div>
          <div className="text-xs text-rose-200 mt-1">
            Timer: {gameState.immortalEncounter.timer.toFixed(1)}s
            {gameState.immortalEncounter.activeType === 'deer' &&
              ` | Escape Progress: ${gameState.immortalEncounter.escapeProgress}%`}
          </div>
        </div>
      )}

      {/* INTERACTIVE CONTEXT & TAMING OVERLAY (Bottom-Left) */}
      <div className="fixed bottom-20 left-3 z-20 flex flex-col gap-2 max-w-sm">
        {/* Resource Inventory Bar */}
        <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-2.5 text-xs flex flex-wrap gap-2 shadow-lg">
          {(
            [
              ['wood', '🪵 Wood'],
              ['stone', '🪨 Stone'],
              ['coal', '⚫ Coal'],
              ['minerals', '⛏️ Minerals'],
              ['crystals', '💎 Crystals'],
              ['ancientCore', '🔮 Core'],
              ['berries', '🍓 Berries'],
              ['herbs', '🌿 Herbs'],
              ['dragonRelic', '🐉 Relic'],
            ] as [ResourceType, string][]
          ).map(([key, label]) => (
            <span
              key={key}
              className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200"
            >
              {label}: <b>{gameState.inventory[key] || 0}</b>
            </span>
          ))}
        </div>

        {/* Nearby Resource Node Prompt */}
        {nearestNode && (
          <div className="bg-emerald-950/90 border border-emerald-500/50 rounded-xl p-3 text-xs flex items-center justify-between shadow-lg">
            <div>
              <div className="font-bold text-emerald-300">{nearestNode.label}</div>
              <div className="text-slate-300">
                Yields {nearestNode.type} ({nearestNode.amount} charges left)
              </div>
            </div>
            <button
              onClick={() => {
                soundFX.playGather();
                setGameState((st) => gatherFromNode(st, nearestNode.id));
              }}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg cursor-pointer"
            >
              Gather (E)
            </button>
          </div>
        )}

        {/* Multi-Step Creature Taming Panel */}
        {nearestCreature && (
          <div className="bg-slate-900/95 border-2 border-indigo-400/70 rounded-xl p-3.5 text-xs space-y-2 shadow-xl">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-sm text-indigo-300">
                🐾 {nearestCreature.name}
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-200">
                Trust: {nearestCreature.taming.trust}%
              </span>
            </div>
            <div className="text-slate-300 text-[11px]">{nearestCreature.temperament}</div>

            {nearestCreature.taming.failureReason && (
              <div className="text-rose-400 font-semibold bg-rose-950/60 px-2 py-1 rounded">
                ⚠️ {nearestCreature.taming.failureReason}
              </div>
            )}

            {/* Step Controls */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() =>
                  setGameState((st) => observeWildCreature(st, nearestCreature.id))
                }
                className="py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 font-semibold border border-slate-600 cursor-pointer"
              >
                1. Observe
              </button>
              <button
                onClick={() =>
                  setGameState((st) => offerFoodToCreature(st, nearestCreature.id))
                }
                className="py-1.5 px-2 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold cursor-pointer"
              >
                2. Offer {nearestCreature.offeringAmount} {nearestCreature.requiredOffering}
              </button>
            </div>

            {(nearestCreature.taming.stage === 'offered' ||
              nearestCreature.taming.stage === 'attuned') && (
              <div className="p-2 rounded bg-indigo-950/70 border border-indigo-500/40">
                <div className="font-bold text-indigo-200 mb-1">
                  3. Cast Required Element (
                  {
                    nearestCreature.taming.elementSequence[
                      nearestCreature.taming.requiredElementIndex
                    ]?.toUpperCase()
                  }
                  ):
                </div>
                <div className="flex gap-1 flex-wrap">
                  {gameState.player.unlockedElements.map((el) => (
                    <button
                      key={el}
                      onClick={() => handleCastElement(el)}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase cursor-pointer"
                    >
                      Cast {el}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {nearestCreature.taming.stage === 'challenge' && (
              <div className="p-2 rounded bg-emerald-950/80 border border-emerald-500">
                <div className="font-bold text-emerald-300 mb-1">
                  4. Trust Timing Challenge — Click Lock inside Green Zone!
                </div>
                <div className="relative w-full h-4 bg-slate-800 rounded overflow-hidden mb-2">
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-500/50"
                    style={{
                      left: `${nearestCreature.taming.challengeTargetMin}%`,
                      width: `${
                        nearestCreature.taming.challengeTargetMax -
                        nearestCreature.taming.challengeTargetMin
                      }%`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-1.5 bg-white"
                    style={{ left: `${nearestCreature.taming.challengeCursor}%` }}
                  />
                </div>
                <button
                  onClick={() => {
                    soundFX.playTameSuccess();
                    setGameState((st) =>
                      completeTamingTimingChallenge(st, nearestCreature.id)
                    );
                  }}
                  className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded cursor-pointer"
                >
                  Lock Trust Ring Now! (E)
                </button>
              </div>
            )}

            {/* Prohibited Lethal Action (Deliberate Hold) */}
            <div className="pt-1 border-t border-slate-800">
              <button
                onMouseDown={() => startLethalHold(nearestCreature.id)}
                onMouseUp={stopLethalHold}
                onMouseLeave={stopLethalHold}
                className="w-full py-1 px-2 rounded bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-300 text-[11px] cursor-pointer"
              >
                ⚠️ Forbidden Lethal Strike (Hold — Penalty: -60 Score & -40 HP!)
              </button>
              {lethalHoldProgress > 0 && (
                <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden mt-1">
                  <div
                    className="h-full bg-rose-500"
                    style={{ width: `${lethalHoldProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM ACTION & ELEMENT BAR */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/95 border border-slate-700 px-4 py-2 rounded-2xl shadow-2xl">
        <button
          onClick={handlePrimaryAttack}
          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold cursor-pointer"
        >
          ⚔️ Staff Strike (Space)
        </button>

        {(['fire', 'water', 'wind', 'ice', 'earth'] as ElementType[]).map((el, idx) => {
          const cfg = ELEMENT_CONFIG[el];
          const unlocked = gameState.player.unlockedElements.includes(el);
          const active = gameState.player.activeElement === el;
          const cd = gameState.player.abilityCooldowns[el] || 0;
          return (
            <button
              key={el}
              disabled={!unlocked}
              onClick={() => handleCastElement(el)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                !unlocked
                  ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                  : active
                  ? 'bg-indigo-600 text-white border-amber-400 scale-105'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <div>
                {idx + 1}. {cfg.name}
              </div>
              <div className="text-[10px] font-normal opacity-80">
                {!unlocked ? `Lv.${cfg.unlockedAtLevel}` : cd > 0 ? `${cd.toFixed(1)}s` : `${cfg.energyCost} EN`}
              </div>
            </button>
          );
        })}

        <div className="h-6 w-px bg-slate-700 mx-1" />

        {(
          [
            ['camp', '🏰 Camp'],
            ['pets', `🐾 Pets (${gameState.pets.length})`],
            ['shop', '🛒 Shop'],
            ['hospital', '🏥 Hospital'],
            ['settings', '⚙️ Menu'],
            ['dev', '🛠️ Dev'],
          ] as const
        ).map(([tabId, label]) => (
          <button
            key={tabId}
            onClick={() => setActiveTab((prev) => (prev === tabId ? 'none' : tabId))}
            className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              activeTab === tabId
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* NOTIFICATIONS FEED (Top-Right below Objectives) */}
      <div className="fixed top-64 right-3 z-10 w-80 space-y-1.5 pointer-events-none">
        {gameState.notifications.map((n) => (
          <div
            key={n.id}
            className={`px-3 py-2 rounded-xl text-xs font-medium border shadow-lg ${
              n.tone === 'danger'
                ? 'bg-rose-950/90 border-rose-500 text-rose-200'
                : n.tone === 'warn'
                ? 'bg-amber-950/90 border-amber-500 text-amber-200'
                : n.tone === 'success'
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            {n.text}
          </div>
        ))}
      </div>

      {/* MODAL DRAWERS FOR CAMP, PETS, SHOP, HOSPITAL, SETTINGS, DEV */}
      {activeTab !== 'none' && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-30 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[82vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
              <h2 className="text-lg font-extrabold text-amber-300 uppercase">
                {activeTab === 'camp' && 'Camp Construction, Upgrades & Teammates'}
                {activeTab === 'pets' && 'Tamed Companion Roster & Pet Commands'}
                {activeTab === 'shop' && 'Arcane Armory & Supply Shop'}
                {activeTab === 'hospital' && 'Herbalist Sanctuary Hospital'}
                {activeTab === 'settings' && 'Game Settings, Save & Controls'}
                {activeTab === 'dev' && 'Developer Verification & Debug Console'}
              </h2>
              <button
                onClick={() => setActiveTab('none')}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            {/* CAMP CONSTRUCTION & TEAMMATES */}
            {activeTab === 'camp' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(gameState.buildings) as BuildingId[]).map((bId) => {
                    const b = gameState.buildings[bId];
                    const cfg = BUILDING_CONFIG[bId];
                    const mult = b.level + 1;
                    return (
                      <div
                        key={bId}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between font-bold text-slate-100">
                            <span>{b.name}</span>
                            <span className="text-amber-400">
                              Lv.{b.level}/{b.maxLevel}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] my-1">{b.description}</p>
                          <div className="text-[11px] text-emerald-300">
                            HP: {Math.round(b.hp)} / {b.maxHp}
                          </div>
                        </div>
                        {b.level < b.maxLevel && (
                          <button
                            onClick={() =>
                              setGameState((st) => constructOrUpgradeBuilding(st, bId))
                            }
                            className="mt-2 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded cursor-pointer"
                          >
                            {b.level === 0 ? 'Construct' : 'Upgrade'} ({cfg.baseCost.coins * mult}{' '}
                            coins)
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <div className="font-bold text-amber-300 mb-2">
                    AI Teammates ({gameState.teammates.length} active)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {gameState.teammates.map((ally) => (
                      <div
                        key={ally.id}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold">{ally.name}</div>
                          <div className="text-[11px] text-slate-400">
                            HP: {ally.hp}/{ally.maxHp} • Role: {ally.role.toUpperCase()}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {(['guard', 'gather', 'heal'] as TeammateRole[]).map((r) => (
                            <button
                              key={r}
                              onClick={() =>
                                setGameState((st) => setTeammateRole(st, ally.id, r))
                              }
                              className={`px-2 py-1 rounded text-[10px] font-bold uppercase cursor-pointer ${
                                ally.role === r
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PET ROSTER & COMMANDS */}
            {activeTab === 'pets' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-400">
                  Up to 3 companions can actively follow you at once; additional tamed companions
                  automatically guard the Sanctuary Camp.
                </p>
                {gameState.pets.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950 rounded-xl text-slate-400">
                    No companions tamed yet. Approach a wild creature in the forest and press E!
                  </div>
                ) : (
                  gameState.pets.map((pet) => (
                    <div
                      key={pet.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-sm text-indigo-300">
                          {pet.name}{' '}
                          <span className="text-xs text-emerald-400">
                            ({pet.active ? 'Active Squad' : 'At Camp'})
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px]">{pet.roleDescription}</div>
                        <div className="text-[11px] text-slate-300 mt-0.5">
                          HP: {pet.hp}/{pet.maxHp} • Damage: {pet.damage} • Order:{' '}
                          <b>{pet.command.toUpperCase()}</b>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setGameState((st) => togglePetActive(st, pet.id))}
                          className="px-2.5 py-1 rounded bg-indigo-600 text-white font-bold cursor-pointer"
                        >
                          {pet.active ? 'Send to Camp' : 'Set Active'}
                        </button>
                        {(['follow', 'defend', 'stay', 'camp'] as PetCommand[]).map((cmd) => (
                          <button
                            key={cmd}
                            onClick={() => setGameState((st) => setPetCommand(st, pet.id, cmd))}
                            className={`px-2 py-1 rounded uppercase font-bold cursor-pointer ${
                              pet.command === cmd
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {cmd}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* WEAPON & SUPPLY SHOP */}
            {activeTab === 'shop' && (
              <div className="space-y-4 text-xs">
                <div className="font-bold text-amber-300">
                  Available Coins: 🪙 {gameState.player.coins}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {WEAPONS.map((w) => {
                    const owned = gameState.player.ownedWeapons.some((ow) => ow.id === w.id);
                    const equipped = gameState.player.equippedWeapon.id === w.id;
                    return (
                      <div
                        key={w.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-100">{w.name}</div>
                          <div className="text-slate-400 text-[11px] my-1">{w.description}</div>
                          <div className="text-emerald-300 text-[11px]">
                            Damage: {w.damage} • Range: {w.range}m • Speed: {w.attackSpeed}x
                          </div>
                        </div>
                        <button
                          onClick={() => setGameState((st) => buyWeaponFromShop(st, w.id))}
                          className={`mt-2 py-1.5 px-3 rounded font-bold cursor-pointer ${
                            equipped
                              ? 'bg-emerald-700 text-white'
                              : owned
                              ? 'bg-indigo-600 text-white'
                              : 'bg-amber-500 text-slate-950'
                          }`}
                        >
                          {equipped ? 'Equipped' : owned ? 'Equip' : `Buy (${w.price} Coins)`}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <div className="font-bold text-slate-200 mb-2">Material & Taming Supply Bundles</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        setGameState((st) => buyResourceBundle(st, 'wood', 6, 15))
                      }
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer"
                    >
                      +6 Wood (15 Coins)
                    </button>
                    <button
                      onClick={() =>
                        setGameState((st) => buyResourceBundle(st, 'stone', 6, 18))
                      }
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer"
                    >
                      +6 Stone (18 Coins)
                    </button>
                    <button
                      onClick={() =>
                        setGameState((st) => buyResourceBundle(st, 'berries', 3, 12))
                      }
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer"
                    >
                      +3 Berries (12 Coins)
                    </button>
                    <button
                      onClick={() =>
                        setGameState((st) => buyResourceBundle(st, 'herbs', 3, 14))
                      }
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer"
                    >
                      +3 Moonleaf Herbs (14 Coins)
                    </button>
                    <button
                      onClick={() =>
                        setGameState((st) => buyResourceBundle(st, 'crystals', 2, 30))
                      }
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer"
                    >
                      +2 Elemental Crystals (30 Coins)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HOSPITAL */}
            {activeTab === 'hospital' && (
              <div className="space-y-4 text-xs">
                <p className="text-slate-300">
                  Hospital Level {gameState.buildings.hospital.level}: Restores your Sorcerer to
                  full HP and revives any incapacitated Pets and Teammates.
                </p>
                <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-emerald-300 text-sm">
                      Full Sanctuary Medical Treatment
                    </div>
                    <div className="text-slate-400">
                      Cost: 1 Moonleaf Herb (or{' '}
                      {Math.max(5, 18 - gameState.buildings.hospital.level * 3)} Coins)
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      soundFX.playTameSuccess();
                      setGameState((st) => startHospitalTreatment(st));
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                  >
                    Receive Treatment Now
                  </button>
                </div>
              </div>
            )}

            {/* SETTINGS & SAVE MANAGEMENT */}
            {activeTab === 'settings' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      saveGameToLocal(gameState);
                      setGameState((st) =>
                        addNotification(st, 'Game saved to local storage!', 'success')
                      );
                    }}
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer"
                  >
                    💾 Save Game Now
                  </button>
                  <button
                    onClick={handleExportSave}
                    className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl cursor-pointer"
                  >
                    📤 Export Save JSON
                  </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="flex justify-between">
                    <span>Master Volume ({Math.round(gameState.settings.masterVolume * 100)}%)</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={gameState.settings.masterVolume}
                      onChange={(e) =>
                        setGameState((st) => ({
                          ...st,
                          settings: {
                            ...st.settings,
                            masterVolume: parseFloat(e.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            )}

            {/* DEVELOPER MODE CONSOLE */}
            {activeTab === 'dev' && (
              <div className="space-y-4 text-xs">
                <div className="font-bold text-amber-300">Jump to Campaign Level</div>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => {
                        const jumped = createInitialGameState(lvl);
                        jumped.screen = 'playing';
                        setGameState(jumped);
                      }}
                      className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                    >
                      Jump to Level {lvl} ({LEVEL_CONFIGS[lvl].unlockedElement.toUpperCase()})
                    </button>
                  ))}
                </div>

                <div className="font-bold text-amber-300 pt-2 border-t border-slate-800">
                  Spawn Encounters & Resources
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setGameState((st) => ({
                        ...st,
                        player: { ...st.player, coins: st.player.coins + 500 },
                        inventory: {
                          wood: st.inventory.wood + 30,
                          stone: st.inventory.stone + 30,
                          coal: st.inventory.coal + 20,
                          minerals: st.inventory.minerals + 20,
                          crystals: st.inventory.crystals + 20,
                          ancientCore: st.inventory.ancientCore + 5,
                          berries: st.inventory.berries + 15,
                          herbs: st.inventory.herbs + 15,
                          dragonRelic: st.inventory.dragonRelic + 3,
                        },
                      }))
                    }
                    className="px-3 py-1.5 rounded bg-emerald-600 text-white font-bold cursor-pointer"
                  >
                    +Grant All Resources & 500 Coins
                  </button>

                  <button
                    onClick={() => {
                      soundFX.playOwlWarning();
                      setGameState((st) => triggerImmortalEncounter(st, 'owl'));
                      setActiveTab('none');
                    }}
                    className="px-3 py-1.5 rounded bg-amber-600 text-slate-950 font-bold cursor-pointer"
                  >
                    🦉 Spawn Immortal Owl Encounter
                  </button>

                  <button
                    onClick={() => {
                      soundFX.playDeerWarning();
                      setGameState((st) => triggerImmortalEncounter(st, 'deer'));
                      setActiveTab('none');
                    }}
                    className="px-3 py-1.5 rounded bg-amber-500 text-slate-950 font-bold cursor-pointer"
                  >
                    🦌 Spawn Immortal Deer Encounter
                  </button>

                  <button
                    onClick={() => {
                      soundFX.playRaidHorn();
                      setGameState((st) => spawnRaidWave(st, true));
                      setActiveTab('none');
                    }}
                    className="px-3 py-1.5 rounded bg-rose-600 text-white font-bold cursor-pointer"
                  >
                    ⚔️ Spawn Raid Wave Now
                  </button>

                  <button
                    onClick={() => {
                      clearLocalSave();
                      const fresh = createInitialGameState(1);
                      fresh.screen = 'playing';
                      setGameState(fresh);
                    }}
                    className="px-3 py-1.5 rounded bg-slate-700 text-rose-300 font-bold cursor-pointer"
                  >
                    Reset Local Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LEVEL COMPLETE MODAL */}
      {gameState.screen === 'levelComplete' && (
        <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center z-40 p-6">
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="text-xs uppercase font-bold text-emerald-400">Stage Cleared</div>
            <h2 className="text-2xl font-extrabold text-white">
              Level {gameState.level} Complete!
            </h2>
            <p className="text-xs text-slate-300">
              Your camp withstood the assault and your elemental mastery grows stronger. Ready to
              unlock{' '}
              <b>
                {LEVEL_CONFIGS[Math.min(5, gameState.level + 1)].unlockedElement.toUpperCase()}
              </b>{' '}
              in {LEVEL_CONFIGS[Math.min(5, gameState.level + 1)].regionName}?
            </p>
            <button
              onClick={() => {
                setGameState((st) => {
                  const next = advanceToNextLevel(st);
                  saveGameToLocal(next);
                  return next;
                });
              }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl cursor-pointer"
            >
              Advance to Level {gameState.level + 1} →
            </button>
          </div>
        </div>
      )}

      {/* CAMPAIGN VICTORY SCREEN */}
      {gameState.screen === 'victory' && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-40 p-6">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-2xl max-w-lg w-full p-8 text-center space-y-4 shadow-2xl">
            <div className="text-xs uppercase tracking-widest text-amber-400 font-bold">
              Grand Five-Element Campaign Victory
            </div>
            <h2 className="text-3xl font-extrabold text-white">
              Archmage of the Enchanted Forest!
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              You mastered Fire, Water, Wind, Ice, and Earth, tamed the Ancient Dragon without
              harming forest wildlife, and defended the Sanctuary Nexus against the Grand Imperial
              Siege!
            </p>
            <div className="bg-slate-950 rounded-xl p-4 text-xs space-y-1 text-left border border-slate-800">
              <div>🏆 Final Score: {gameState.score}</div>
              <div>🐾 Tamed Companions: {gameState.pets.length}</div>
              <div>🛡️ Active Teammates: {gameState.teammates.length}</div>
              <div>🪙 Treasury Coins: {gameState.player.coins}</div>
              <div>⚠️ Wildlife Violations: {gameState.wildlifeViolations}</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setGameState((st) => ({ ...st, screen: 'playing' }))}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs cursor-pointer"
              >
                Continue Free Exploration
              </button>
              <button
                onClick={() => {
                  const fresh = createInitialGameState(1);
                  setGameState(fresh);
                }}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
              >
                Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEFEAT & RECOVERY SCREEN */}
      {gameState.screen === 'defeat' && (
        <div className="fixed inset-0 bg-rose-950/90 flex items-center justify-center z-40 p-6">
          <div className="bg-slate-900 border-2 border-rose-500 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <h2 className="text-2xl font-extrabold text-rose-400">
              {gameState.defeatReason === 'camp_destroyed'
                ? 'Sanctuary Nexus Destroyed!'
                : gameState.defeatReason === 'wildlife_wrath'
                ? 'Struck Down by the Forest Pact!'
                : 'Sorcerer Fallen!'}
            </h2>
            <p className="text-xs text-slate-300">
              {gameState.defeatReason === 'camp_destroyed'
                ? 'The central Sanctuary fell to siege forces. Retry from the start of the current level with your unlocked elements and companions intact.'
                : 'Recover at the Camp Sanctuary checkpoint (-15% coin tithe) with restored health and campfire warmth.'}
            </p>
            <button
              onClick={() => setGameState((st) => recoverFromCheckpoint(st))}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-sm cursor-pointer"
            >
              {gameState.defeatReason === 'camp_destroyed'
                ? `Retry Level ${gameState.level}`
                : 'Recover at Camp Checkpoint'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
