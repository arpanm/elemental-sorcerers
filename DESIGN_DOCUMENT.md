# Elemental Sorcerers — Game Design & Systems Document

## 1. Overview
Elemental Sorcerers is an enchanted-forest 3D survival adventure where players balance exploration, resource harvesting, campfire tier upgrades, multi-step nonlethal taming, and tactical defense against imperial soldier raids.

---

## 2. Five Elements & Rules

| Element | Level | Combat Effect | Nonlethal Taming & Camp Utility |
|---|---|---|---|
| **Fire** | 1 | 38 DMG scorch in 11m radius | Restores +18 fuel to campfire; calms Wolves and Dragons. |
| **Water** | 2 | 20 DMG splash in 12m radius | Heals player, active pets, and teammates (+32 HP); soothes Unicorns and Bears. |
| **Wind** | 3 | 26 DMG + 4.5m knockback in 14m radius | Grants +35 stamina surge; attunes Galeplume Sylphs and Dragons. |
| **Ice** | 4 | 30 DMG + 5.0s freeze slow in 12m radius | Cools overheated Frosthorns, Bears, and Dragons. |
| **Earth** | 5 | 45 DMG + 3.0s stagger in 13m radius | Repairs camp structures (+35 HP); grounds Ancient Dragon ritual. |

---

## 3. Campfire Tier Balancing

| Tier | Fuel Type | Fuel Gain | Max Fuel | Burn Rate | Aura Radius | Weaken Effect | Teammate Recruit Interval |
|---|---|---|---|---|---|---|---|
| 1 | Wood | +35 | 100 | 0.70 /s | 14m | 15% enemy weaken | 45s |
| 2 | Coal | +50 | 140 | 0.60 /s | 18m | 22% enemy weaken | 36s |
| 3 | Minerals | +65 | 180 | 0.52 /s | 22m | 28% enemy weaken | 28s |
| 4 | Crystals | +80 | 220 | 0.45 /s | 26m | 35% enemy weaken | 22s |
| 5 | Ancient Core | +120 | 300 | 0.35 /s | 32m | 45% enemy weaken | 16s |

*Extinguished Campfire Penalty:* Invading soldiers receive a +25% strength and damage bonus until the fire is relit with available resources.

---

## 4. Multi-Stage Creature Taming Pipeline

1. **Observe**: Learn creature temperament, favorite food offering, and required elemental attunement sequence.
2. **Offer**: Approach within 9m and present the required offering (Berries, Herbs, Minerals, or Dragon Relic).
3. **Attune**: Cast the requested elemental spell on the creature. Dragons require a 3-stage sequence: `Fire` -> `Ice` -> `Earth`.
4. **Timing Challenge**: Stop the oscillating trust cursor inside the green target zone (30–72% width; 38–64% for Dragons).
5. **Companionship**: Tamed creatures join your roster. Up to 3 pets follow and fight actively; additional companions guard the Camp Sanctuary.

---

## 5. Wildlife Protection Rule

The Ancient Forest Pact strictly forbids slaying wild tameable beasts.
- **Accidental Safety**: Area elemental attacks strictly target enemy soldiers.
- **Prohibited Lethal Action**: Requires a deliberate 1.5-second hold on the prohibited strike button.
- **Penalty**: -60 score and -40 HP per violation. Three violations cause player defeat via `wildlife_wrath`.

---

## 6. Immortal Forest Encounters

- **Immortal Owl**: Appears with a double-hoot warning. The player must stand completely still during its active gaze window (4.5s). Camera rotation and menus do not count as movement. Movement deals 22 DPS.
- **Immortal Celestial Deer**: Appears with a stag bugle. The player must sprint away beyond its 18m perimeter. Escape progress is clearly displayed (0–100%).

---

## 7. Enemy Soldiers & Raids

- **Vanguard Footman (Melee)**: 75 HP, 11 DMG, 4.2 speed, 2.4m range.
- **Crossbow Skirmisher (Ranged)**: 60 HP, 13 DMG, 3.8 speed, 11.0m range.
- **Ironclad Juggernaut (Heavy)**: 155 HP, 20 DMG, 2.7 speed, 2.8m range.
- **Brimstone Sapper (Siege)**: 130 HP, 28 DMG, 2.5 speed, prioritizes Sanctuary Nexus and Walls.

---

## 8. Defeat & Checkpoint Recovery

- **Player Death**: Checkpoint respawn at Sanctuary with 100% HP, restored campfire, and a 15% coin tithe.
- **Sanctuary Destruction**: Restart level with preserved weapons, unlocked elements, and tamed companions.
