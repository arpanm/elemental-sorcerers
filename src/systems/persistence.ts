import { SAVE_STORAGE_KEY, SAVE_VERSION } from '../config/gameConfig';
import { GameState } from '../types/game';
import { createInitialGameState } from './engineLogic';

export function saveGameToLocal(state: GameState): boolean {
  try {
    const serialized = JSON.stringify({
      ...state,
      saveVersion: SAVE_VERSION,
    });
    localStorage.setItem(SAVE_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function loadGameFromLocal(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    return parseAndValidateSave(raw);
  } catch {
    return null;
  }
}

export function parseAndValidateSave(jsonString: string): GameState | null {
  try {
    const parsed = JSON.parse(jsonString) as Partial<GameState>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.saveVersion !== SAVE_VERSION ||
      typeof parsed.level !== 'number' ||
      !parsed.player ||
      !parsed.inventory ||
      !parsed.campfire ||
      !parsed.buildings
    ) {
      return null;
    }

    const fallback = createInitialGameState(parsed.level);
    return {
      ...fallback,
      ...parsed,
      screen: parsed.screen === 'title' ? 'playing' : (parsed.screen ?? 'playing'),
      player: {
        ...fallback.player,
        ...parsed.player,
      },
      inventory: {
        ...fallback.inventory,
        ...parsed.inventory,
      },
      campfire: {
        ...fallback.campfire,
        ...parsed.campfire,
      },
      settings: {
        ...fallback.settings,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return null;
  }
}

export function clearLocalSave(): void {
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
