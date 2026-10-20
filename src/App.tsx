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
    'none' | 'camp' | 'pets' | 'shop' | 'hospital' | 'guide' | 'settings' | 'dev'
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

  // Main Simulation Tick (10Hz logical step for deterministic resource & AI updates)
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

  // Pause simulation when tab loses focus
  useEffect(() => {
    const onBlur = () => {
      setGameState((prev) => (prev.screen === 'playing' ? { ...prev, screen: 'paused' } : prev));
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  // Keyboard number hotkeys for element switching, F2 dev mode, Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'F2') {
        e.preventDefault();
        setActiveTab((prev) => (prev === 'dev' ? 'none' : 'dev'));
      }
      if (e.code === 'KeyH') {
        setActiveTab((prev) => (prev === 'guide' ? 'none' : 'guide'));
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

  // Context-sensitive E key action
  const handleContextInteract = () => {
    setGameState((prev) => {
      // 1. Collect nearby soldier drops
      const hasDrop = prev.lootDrops.some(
        (d) => !d.collected && distance2D(prev.player.position, d.position) <= 8.5
      );
      if (hasDrop) {
        soundFX.playGather();
        return collectNearbyLoot(prev);
      }

      // 2. Open nearby treasure chest
      const chest = prev.chests.find(
        (c) => !c.opened && distance2D(prev.player.position, c.position) <= 7.5
      );
      if (chest) {
        soundFX.playTameSuccess();
        return openTreasureChest(prev, chest.id);
      }

      // 3. Gather from nearby resource node
      const node = prev.resourceNodes.find(
        (n) => n.amount > 0 && distance2D(prev.player.position, n.position) <= 8.5
      );
      if (node) {
        soundFX.playGather();
        return gatherFromNode(prev, node.id);
      }

      // 4. Stoke campfire if near center
      if (distance2D(prev.player.position, { x: 0, y: 0, z: 0 }) <= 8.0) {
        soundFX.playElement('fire');
        return stokeCampfire(prev);
      }

      // 5. Interact with nearby wild creature
      const creature = prev.wildCreatures.find(
        (c) => distance2D(prev.player.position, c.position) <= 10.0
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

      // 6. Test strike on nearby training dummy
      const dummy = prev.trainingDummies.find(
        (d) => distance2D(prev.player.position, d.position) <= 8.0
      );
      if (dummy) {
        soundFX.playAttack();
        return performPrimaryAttack(prev);
      }

      return addNotification(
        prev,
        'No interactive target nearby. Walk towards the Golden Waypoint Pillar shining into the sky!',
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

  // Target detection helpers
  const distToCamp = distance2D(gameState.player.position, { x: 0, y: 0, z: 0 });
  const nearestCreature = gameState.wildCreatures.find(
    (c) => distance2D(gameState.player.position, c.position) <= 12
  );
  const nearestNode = gameState.resourceNodes.find(
    (n) => n.amount > 0 && distance2D(gameState.player.position, n.position) <= 9
  );
  const nearestChest = gameState.chests.find(
    (c) => !c.opened && distance2D(gameState.player.position, c.position) <= 8
  );
  const nearestDummy = gameState.trainingDummies.find(
    (d) => distance2D(gameState.player.position, d.position) <= 8
  );

  const levelCfg = LEVEL_CONFIGS[gameState.level] || LEVEL_CONFIGS[1];
  const fireTierCfg = CAMPFIRE_TIERS[gameState.campfire.tier];
  const prereqsDone = arePrerequisitesMet(gameState);

  // Assisted Step Context Instructions
  const getAssistedInstruction = () => {
    switch (gameState.assistedStep) {
      case 1: {
        const availablePine =
          gameState.resourceNodes.find((n) => n.type === 'wood' && n.amount > 0) ||
          gameState.resourceNodes[0];
        return {
          title: 'STEP 1: HOW TO COLLECT ITEMS (WOOD, BERRIES, STONE)',
          instruction:
            'Walk up to the Enchanted Pine or Wildberry Bush right in front of you (Golden Waypoint). Press [E], Left-Click it, or click the green button below to gather resources.',
          icon: '🌲',
          btnText: nearestNode ? `Gather ${nearestNode.label} (E)` : 'Gather Starter Wood (E)',
          action: () => {
            soundFX.playGather();
            if (nearestNode) {
              setGameState((st) => gatherFromNode(st, nearestNode.id));
            } else if (availablePine) {
              setGameState((st) => gatherFromNode(st, availablePine.id));
            }
          },
        };
      }
      case 2:
        return {
          title: 'STEP 2: HOW TO STOKE & MAINTAIN THE CAMPFIRE',
          instruction:
            'The Campfire Hearth shields the camp from enemies. Walk to the center and press [E] or click "Stoke Campfire" to feed wood and restore the protective sanctuary aura.',
          icon: '🔥',
          btnText: 'Stoke Campfire Hearth (E)',
          action: () => {
            soundFX.playCampfireIgnite();
            setGameState((st) => stokeCampfire(st));
          },
        };
      case 3:
        return {
          title: 'STEP 3: HOW TO ATTACH ARMS & FIRE WEAPON BLASTS',
          instruction:
            'Your Novice Rowan Staff is attached in hand! Left-Click or press [Space] to blast arcane projectiles at the Corrupted Creeper Dummy right ahead. Open "🛒 Armory" to attach new blades or wands.',
          icon: '⚔️',
          btnText: 'Blast Arcane Bolt (Left-Click / Space)',
          action: handlePrimaryAttack,
        };
      case 4:
        return {
          title: `STEP 4: HOW TO TAME CREATURES (${nearestCreature ? nearestCreature.name : 'Emberfang Wolf'})`,
          instruction:
            'Walk to the Emberfang Wolf (10m east): 1. Observe -> 2. Feed 4 Berries -> 3. Cast Fire (Q) -> 4. Lock Trust Ring inside the green zone! Tamed beasts defend your sanctuary.',
          icon: '🐾',
          btnText: nearestCreature ? `Tame ${nearestCreature.name} (E)` : 'Approach Emberfang Wolf',
          action: handleContextInteract,
        };
      case 5:
      default:
        return {
          title: 'STEP 5: HOW TO DEFEND AGAINST ENEMY RAIDS',
          instruction:
            'Soldier squads will raid the clearing! Left-Click or Space to strike with staff bolts, press [Q] for Elemental powers (1-5 to switch), and command your tamed pets to repel them.',
          icon: '🛡️',
          btnText: 'Defend Campfire (Left-Click / Space)',
          action: handlePrimaryAttack,
        };
    }
  };

  const assistedInfo = getAssistedInstruction();

  // ============================================================================
  // TITLE SCREEN
  // ============================================================================
  if (gameState.screen === 'title') {
    const hasSavedGame = Boolean(loadGameFromLocal());
    return (
      <div className="w-screen h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-emerald-950 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-8 shadow-2xl">
          <div className="text-xs uppercase tracking-widest text-amber-400 font-semibold mb-1">
            2026+ 3D Survival Adventure Campaign
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3">Elemental Sorcerers</h1>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            Welcome to the enchanted forest sanctuary. You are guided from the very first step with
            interactive 3D waypoints, assisted gathering, weapon attachment, multi-stage beast taming,
            and tactical elemental combat against imperial soldier raids.
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
              Start New Guided Campaign (Level 1)
            </button>

            {hasSavedGame && (
              <button
                onClick={() => {
                  const loaded = loadGameFromLocal();
                  if (loaded) setGameState({ ...loaded, screen: 'playing' });
                }}
                className="py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition cursor-pointer"
              >
                Continue Saved Game (Lv.{gameState.level})
              </button>
            )}

            <button
              onClick={() => setActiveTab('guide')}
              className="py-2.5 px-4 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-200 text-sm font-medium border border-indigo-700 cursor-pointer"
            >
              📖 How to Play & Controls Guide
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 cursor-pointer"
            >
              Import Save JSON
            </button>
          </div>

          <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 text-xs text-slate-300 space-y-1.5">
            <div className="font-bold text-amber-300 uppercase">Immediate Controls & Guide</div>
            <div>• <b>WASD</b> to move | <b>Hold Shift</b> to sprint | <b>Drag Mouse</b> to rotate 3D camera</div>
            <div>• <b>Follow the Golden Waypoint Light Beam</b> in the sky to your next objective</div>
            <div>• <b>[E] or Click</b> to gather trees/rocks, stoke hearth, and interact</div>
            <div>• <b>[Space]</b> to blast staff arcane energy | <b>[Q]</b> to cast active Elemental spell</div>
            <div>• <b>Keys 1, 2, 3, 4, 5</b> to switch between Fire, Water, Wind, Ice, and Earth</div>
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

      {/* 2026+ ASSISTED ONBOARDING & OBJECTIVE BANNER (Top Center) */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-20 w-[96vw] max-w-3xl pointer-events-none">
        <div className="pointer-events-auto bg-slate-900/95 border-2 border-amber-400/80 rounded-2xl p-3 shadow-2xl flex flex-col gap-2">
          {/* Step Selector Pills */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-[11px]">
            <div className="flex items-center gap-1 font-bold flex-wrap">
              <span className="text-amber-400 uppercase tracking-wider text-[10px] mr-1">Onboarding Guide:</span>
              {[
                { step: 1, label: '1. Collect Items' },
                { step: 2, label: '2. Stoke Hearth' },
                { step: 3, label: '3. Attach Arms' },
                { step: 4, label: '4. Tame Beast' },
                { step: 5, label: '5. Repel Raids' },
              ].map(({ step, label }) => (
                <button
                  key={step}
                  onClick={() => setGameState((st) => ({ ...st, assistedStep: step }))}
                  className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                    gameState.assistedStep === step
                      ? 'bg-amber-500 text-slate-950 font-extrabold shadow'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setActiveTab('guide')}
              className="px-2 py-0.5 rounded-lg bg-indigo-900 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 cursor-pointer font-semibold text-[10px] shrink-0"
            >
              📖 How to Play
            </button>
          </div>

          {/* Active Step Content */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-xl shrink-0">
                {assistedInfo.icon}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider font-extrabold text-amber-400">
                  {assistedInfo.title}
                </div>
                <div className="text-xs text-slate-100 font-medium leading-snug">
                  {assistedInfo.instruction}
                </div>
              </div>
            </div>
            <button
              onClick={assistedInfo.action || handleContextInteract}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shrink-0 shadow-lg cursor-pointer"
            >
              {assistedInfo.btnText}
            </button>
          </div>
        </div>
      </div>

      {/* TOP LEFT: Sorcerer Vitals & Active Weapon */}
      <div className="fixed top-20 left-3 z-10 w-72 pointer-events-auto bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 shadow-xl">
        <div className="flex justify-between items-center mb-1.5">
          <span className="font-bold text-xs text-amber-300">{levelCfg.name}</span>
          <span className="text-[11px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700">
            Score: {gameState.score}
          </span>
        </div>

        {/* HP */}
        <div className="text-[11px] flex justify-between mb-0.5">
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
        <div className="text-[11px] flex justify-between mb-0.5">
          <span className="text-emerald-300">Stamina (Shift to Sprint)</span>
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
        <div className="text-[11px] flex justify-between mb-0.5">
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

        <div className="flex justify-between items-center text-xs text-slate-300 pt-1.5 border-t border-slate-800">
          <span>🪙 Coins: {gameState.player.coins}</span>
          <button
            onClick={() => setActiveTab('shop')}
            className="text-[11px] text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer"
          >
            ⚔️ {gameState.player.equippedWeapon.name} (Change)
          </button>
        </div>
      </div>

      {/* TOP RIGHT: Campfire Status & Level Objectives */}
      <div className="fixed top-20 right-3 z-10 w-80 space-y-2 pointer-events-auto">
        {/* Campfire Hearth */}
        <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-3 shadow-xl">
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

        {/* Objectives Checklist */}
        <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3 shadow-xl">
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
              ⚔️ Launch Final Defense Wave Now
            </button>
          )}
        </div>
      </div>

      {/* IMMORTAL ENCOUNTER ALERT */}
      {gameState.immortalEncounter.activeType !== 'none' && (
        <div className="fixed top-40 left-1/2 -translate-x-1/2 z-30 bg-rose-950/95 border-2 border-amber-400 rounded-2xl px-6 py-3 text-center shadow-2xl max-w-lg">
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
      <div className="fixed bottom-24 left-3 z-20 flex flex-col gap-2 max-w-sm pointer-events-auto">
        {/* Resource Inventory Bar */}
        <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-2.5 text-xs flex flex-wrap gap-2 shadow-xl">
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

        {/* Nearby Interactive Prompt (Tree / Rock / Chest / Dummy) */}
        {nearestNode && (
          <div className="bg-emerald-950/90 border-2 border-emerald-500 rounded-xl p-3 text-xs flex items-center justify-between shadow-2xl">
            <div>
              <div className="font-bold text-emerald-300 text-sm">🌲 {nearestNode.label}</div>
              <div className="text-slate-300">
                Yields {nearestNode.type} ({nearestNode.amount} charges left)
              </div>
            </div>
            <button
              onClick={() => {
                soundFX.playGather();
                setGameState((st) => gatherFromNode(st, nearestNode.id));
              }}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl shadow-lg cursor-pointer"
            >
              Gather (E)
            </button>
          </div>
        )}

        {nearestDummy && !nearestNode && (
          <div className="bg-indigo-950/90 border-2 border-sky-400 rounded-xl p-3 text-xs flex items-center justify-between shadow-2xl">
            <div>
              <div className="font-bold text-sky-300 text-sm">🎯 {nearestDummy.name}</div>
              <div className="text-slate-300">Test combat strikes & spell blasts</div>
            </div>
            <button
              onClick={handlePrimaryAttack}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold rounded-xl shadow-lg cursor-pointer"
            >
              Strike (Space)
            </button>
          </div>
        )}

        {nearestChest && (
          <div className="bg-amber-950/90 border-2 border-amber-400 rounded-xl p-3 text-xs flex items-center justify-between shadow-2xl">
            <div>
              <div className="font-bold text-amber-300 text-sm">
                📦 {nearestChest.rarity.toUpperCase()} Treasure Chest
              </div>
              <div className="text-slate-300">Contains +{nearestChest.coins} coins & supplies</div>
            </div>
            <button
              onClick={() => {
                soundFX.playTameSuccess();
                setGameState((st) => openTreasureChest(st, nearestChest.id));
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl shadow-lg cursor-pointer"
            >
              Open (E)
            </button>
          </div>
        )}

        {/* Multi-Step Assisted Creature Taming Card */}
        {nearestCreature && (
          <div className="bg-slate-900/95 border-2 border-indigo-400/90 rounded-2xl p-4 text-xs space-y-2.5 shadow-2xl">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-sm text-indigo-300">
                🐾 {nearestCreature.name}
              </span>
              <span className="px-2.5 py-1 rounded bg-indigo-950 text-indigo-200 border border-indigo-700 font-bold">
                Trust: {nearestCreature.taming.trust}%
              </span>
            </div>
            <div className="text-slate-300 text-[11px] leading-relaxed">
              {nearestCreature.temperament}
            </div>

            {nearestCreature.taming.failureReason && (
              <div className="text-rose-400 font-semibold bg-rose-950/60 px-2 py-1 rounded border border-rose-800">
                ⚠️ {nearestCreature.taming.failureReason}
              </div>
            )}

            {/* Step Controls */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  setGameState((st) => observeWildCreature(st, nearestCreature.id))
                }
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold border border-slate-600 cursor-pointer"
              >
                1. Observe
              </button>
              <button
                onClick={() =>
                  setGameState((st) => offerFoodToCreature(st, nearestCreature.id))
                }
                className="py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold cursor-pointer"
              >
                2. Feed ({nearestCreature.offeringAmount} {nearestCreature.requiredOffering})
              </button>
            </div>

            {(nearestCreature.taming.stage === 'offered' ||
              nearestCreature.taming.stage === 'attuned') && (
              <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/50">
                <div className="font-bold text-indigo-200 mb-1.5">
                  3. Cast Required Element (
                  {
                    nearestCreature.taming.elementSequence[
                      nearestCreature.taming.requiredElementIndex
                    ]?.toUpperCase()
                  }
                  ):
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {gameState.player.unlockedElements.map((el) => (
                    <button
                      key={el}
                      onClick={() => handleCastElement(el)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold uppercase cursor-pointer"
                    >
                      Cast {el}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {nearestCreature.taming.stage === 'challenge' && (
              <div className="p-3 rounded-xl bg-emerald-950/85 border-2 border-emerald-500">
                <div className="font-bold text-emerald-300 mb-1">
                  4. Trust Timing Challenge — Click Lock inside Green Zone!
                </div>
                <div className="relative w-full h-5 bg-slate-800 rounded-lg overflow-hidden mb-2">
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-500/60"
                    style={{
                      left: `${nearestCreature.taming.challengeTargetMin}%`,
                      width: `${
                        nearestCreature.taming.challengeTargetMax -
                        nearestCreature.taming.challengeTargetMin
                      }%`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-white shadow-lg"
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
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl shadow-lg cursor-pointer"
                >
                  Lock Trust Ring Now! (E)
                </button>
              </div>
            )}

            {/* Prohibited Lethal Action (Deliberate Hold) */}
            <div className="pt-1.5 border-t border-slate-800">
              <button
                onMouseDown={() => startLethalHold(nearestCreature.id)}
                onMouseUp={stopLethalHold}
                onMouseLeave={stopLethalHold}
                className="w-full py-1.5 px-2 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-300 text-[11px] cursor-pointer"
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

      {/* BOTTOM UNIFIED ACTION DOCK */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/95 border border-slate-700 px-4 py-2.5 rounded-2xl shadow-2xl">
        <button
          onClick={handlePrimaryAttack}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold border border-indigo-400 shadow cursor-pointer"
          title="Fire Archstaff Bolt (Space or Left-Click)"
        >
          ⚔️ Staff Strike (Space)
        </button>

        <button
          onClick={handleContextInteract}
          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold border border-emerald-400 shadow cursor-pointer"
          title="Gather wood/stone, stoke fire, open chests, or tame beasts (E or Click)"
        >
          ✋ Collect / Interact (E)
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
                  ? 'bg-amber-500 text-slate-950 border-amber-300 scale-105 shadow-md'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <div>
                {idx + 1}. {cfg.name}
              </div>
              <div className="text-[10px] font-normal opacity-85">
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
            ['shop', '🛒 Armory'],
            ['hospital', '🏥 Hospital'],
            ['guide', '📖 Guide'],
            ['settings', '⚙️ Save'],
          ] as const
        ).map(([tabId, label]) => (
          <button
            key={tabId}
            onClick={() => setActiveTab((prev) => (prev === tabId ? 'none' : tabId))}
            className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              activeTab === tabId
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* NOTIFICATIONS FEED */}
      <div className="fixed top-64 right-3 z-10 w-80 space-y-1.5 pointer-events-none">
        {gameState.notifications.map((n) => (
          <div
            key={n.id}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-medium border shadow-xl ${
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

      {/* MODAL DRAWERS */}
      {activeTab !== 'none' && (
        <div className="fixed inset-0 bg-slate-950/65 flex items-center justify-center z-30 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[82vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
              <h2 className="text-lg font-extrabold text-amber-300 uppercase">
                {activeTab === 'camp' && 'Camp Construction, Upgrades & Teammates'}
                {activeTab === 'pets' && 'Tamed Companion Roster & Orders'}
                {activeTab === 'shop' && 'Arcane Armory & Weapon Attachment'}
                {activeTab === 'hospital' && 'Herbalist Sanctuary Hospital'}
                {activeTab === 'guide' && 'Complete 2026+ Gameplay & Systems Guide'}
                {activeTab === 'settings' && 'Game Settings, Save & Export'}
                {activeTab === 'dev' && 'Developer Verification Console'}
              </h2>
              <button
                onClick={() => setActiveTab('none')}
                className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            {/* ARMORY & WEAPON ATTACHMENT */}
            {activeTab === 'shop' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-indigo-950/60 border border-indigo-500/40 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-indigo-300 font-bold">
                      Currently Equipped Weapon
                    </div>
                    <div className="text-base font-extrabold text-white">
                      {gameState.player.equippedWeapon.name}
                    </div>
                    <div className="text-slate-300 text-xs mt-0.5">
                      Damage: {gameState.player.equippedWeapon.damage} • Range: {gameState.player.equippedWeapon.range}m • Speed: {gameState.player.equippedWeapon.attackSpeed}x
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-400 font-bold">🪙 {gameState.player.coins} Coins</div>
                  </div>
                </div>

                <div className="font-bold text-slate-200">Available Weapons in Armory</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {WEAPONS.map((w) => {
                    const owned = gameState.player.ownedWeapons.some((ow) => ow.id === w.id);
                    const equipped = gameState.player.equippedWeapon.id === w.id;
                    return (
                      <div
                        key={w.id}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-center font-bold text-slate-100">
                            <span>{w.name}</span>
                            {w.elementBonus && (
                              <span className="text-[10px] uppercase text-amber-400 font-bold">
                                {w.elementBonus} Boost
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-[11px] my-1">{w.description}</p>
                          <div className="text-emerald-300 text-[11px]">
                            ATK: {w.damage} • Range: {w.range}m • Speed: {w.attackSpeed}x
                          </div>
                        </div>
                        <button
                          onClick={() => setGameState((st) => buyWeaponFromShop(st, w.id))}
                          className={`mt-2.5 py-2 px-3 rounded-xl font-bold cursor-pointer ${
                            equipped
                              ? 'bg-emerald-700 text-white'
                              : owned
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          }`}
                        >
                          {equipped ? '✔ Equipped in Hand' : owned ? 'Attach to Hand' : `Buy (${w.price} Coins)`}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <div className="font-bold text-slate-200 mb-2">Buy Material Bundles</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setGameState((st) => buyResourceBundle(st, 'wood', 6, 15))}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer"
                    >
                      +6 Wood (15 Coins)
                    </button>
                    <button
                      onClick={() => setGameState((st) => buyResourceBundle(st, 'stone', 6, 18))}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer"
                    >
                      +6 Stone (18 Coins)
                    </button>
                    <button
                      onClick={() => setGameState((st) => buyResourceBundle(st, 'berries', 3, 12))}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer"
                    >
                      +3 Berries (12 Coins)
                    </button>
                    <button
                      onClick={() => setGameState((st) => buyResourceBundle(st, 'crystals', 2, 30))}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer"
                    >
                      +2 Crystals (30 Coins)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HOW TO PLAY & ASSISTANT GUIDE */}
            {activeTab === 'guide' && (
              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-200">
                  <div className="font-bold text-sm mb-1">🌟 2026+ Guided Sorcerer's Handbook</div>
                  <div>Welcome! Everything in Elemental Sorcerers is assisted from your very first step. Follow the golden beam in the sky and use the guides below:</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950 rounded-xl border border-emerald-500/40">
                    <div className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                      <span>🌲</span> 1. How to Collect Items
                    </div>
                    <div className="space-y-1 text-slate-300">
                      <div>• Walk up to any tree, bush, rock, or chest (within 8 meters).</div>
                      <div>• Press <b>[E]</b> on keyboard, <b>Left-Click</b> the 3D model, or click the on-screen <b>'✋ Collect (E)'</b> button.</div>
                      <div>• Yields <b>Wood</b> (for hearth fuel), <b>Berries</b> (for taming), <b>Stone</b> & <b>Minerals</b> (for camp structures).</div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-indigo-500/40">
                    <div className="font-bold text-indigo-300 mb-1 flex items-center gap-1.5">
                      <span>⚔️</span> 2. How to Attach & Use Arms
                    </div>
                    <div className="space-y-1 text-slate-300">
                      <div>• Open the <b>'🛒 Armory'</b> tab in the bottom dock.</div>
                      <div>• Click <b>'Attach to Hand'</b> on any weapon you own (you start with the Novice Rowan Staff).</div>
                      <div>• Press <b>[Space]</b> or <b>Left-Click</b> anywhere on screen to shoot projectile blasts!</div>
                      <div>• Face the <b>Corrupted Creeper Dummy</b> in front of camp to test your attack strikes and damage numbers.</div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/40">
                    <div className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                      <span>🐾</span> 3. How to Tame Wild Beasts
                    </div>
                    <div className="space-y-1 text-slate-300">
                      <div>• Approach the wild creature (e.g. Emberfang Wolf at 10m).</div>
                      <div>• Click <b>'1. Observe'</b> to read its temperament (+25 Trust).</div>
                      <div>• Click <b>'2. Feed'</b> to offer gathered berries/food (+30 Trust).</div>
                      <div>• Press <b>[Q]</b> to cast the attuned element (Fire for wolf) to soothe it.</div>
                      <div>• Click <b>'Lock Trust Ring'</b> when the moving needle is inside the green zone!</div>
                      <div>• Tamed pets follow you and attack invading soldiers automatically!</div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-sky-500/40">
                    <div className="font-bold text-sky-300 mb-1 flex items-center gap-1.5">
                      <span>🧭</span> 4. Where to Go (Navigation)
                    </div>
                    <div className="space-y-1 text-slate-300">
                      <div>• Look up into the sky for the <b>Golden Waypoint Light Pillar</b>! It points straight to your active objective.</div>
                      <div>• Floating distance badges appear above targets (e.g. <i>'🌲 Pine: 3.5m'</i>, <i>'🎯 Dummy: 4.0m'</i>).</div>
                      <div>• The top banner keeps your next assisted task highlighted with a 1-click action button.</div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-rose-500/40">
                    <div className="font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                      <span>🔥</span> 5. Sustaining the Campfire Hearth
                    </div>
                    <div className="space-y-1 text-slate-300">
                      <div>• Walk to the central stone hearth and press <b>[E]</b> or click <b>'Stoke Hearth'</b>.</div>
                      <div>• Burning wood sustains the sanctuary shield aura which weakens enemy raiders and recruits guards.</div>
                      <div>• If the fire extinguishes, invading soldiers gain +25% attack strength!</div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/40">
                    <div className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                      <span>⚠️</span> 6. Wildlife Protection Law
                    </div>
                    <div className="space-y-1 text-slate-300">
                      <div>• Standard attacks strictly damage soldier raiders and training dummies.</div>
                      <div>• Deliberately attacking or killing wild creatures breaks the Forest Pact (-60 score, -40 HP penalty). 3 violations cause defeat!</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CAMP CONSTRUCTION */}
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

            {/* PET ROSTER */}
            {activeTab === 'pets' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-400">
                  Up to 3 companions follow you on patrol; additional companions guard the Camp Hearth.
                </p>
                {gameState.pets.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950 rounded-xl text-slate-400">
                    No companions tamed yet. Approach a wild beast and follow the step-by-step Taming Guide!
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

            {/* SETTINGS & SAVE */}
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

            {/* DEVELOPER CONSOLE */}
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
