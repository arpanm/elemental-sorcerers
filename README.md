# Elemental Sorcerers — 3D Survival Adventure

A single-player third-person 3D fantasy survival adventure game built with **React, TypeScript, Three.js, and Vite**.

You are an elemental sorcerer protecting a forest camp alongside AI teammates and tamed mythical creatures across a 5-level campaign.

---

## 🎮 Controls

| Action | Key / Input |
|---|---|
| **Move** | `W`, `A`, `S`, `D` or Arrow keys |
| **Sprint** | Hold `Shift` (uses Stamina) |
| **Rotate 3D Camera** | Click & Drag Mouse |
| **Staff Strike (Primary)** | `Space` |
| **Cast Active Element** | `Q` |
| **Context Action** | `E` (Gather node / Open chest / Stoke fire / Tame creature) |
| **Element Selection** | Keys `1` (Fire), `2` (Water), `3` (Wind), `4` (Ice), `5` (Earth) |
| **Quick Menus** | Bottom HUD Dock (Camp, Pets, Shop, Hospital, Menu) |
| **Developer Console** | `F2` (Jump levels, spawn encounters, grant resources) |
| **Pause / Resume** | `Escape` |

---

## 🌲 Core Gameplay Loop

1. **Explore & Gather**: Harvest Wood, Stone, Coal, Minerals, Crystals, and Berries from replenishing resource nodes.
2. **Sustain the Campfire**: Feed fuel to the 5-tier elemental hearth. While lit, it weakens invading soldiers and recruits teammates. If extinguished, soldiers gain a +25% damage boost.
3. **Tame Mythical Companions**: Nonlethal multi-step taming pipeline:
   - *Observe* temperament.
   - *Offer* required food/berries.
   - *Cast* matching elemental powers (e.g. Fire warmth for Wolves, Water for Unicorns).
   - *Lock* the Trust Timing Ring within the green sweet spot.
4. **Wildlife Protection Rule**: Deliberate lethal strikes against forest wildlife violate the ancient Forest Pact (-60 score, -40 HP); 3 strikes result in defeat.
5. **Immortal Guardians**:
   - **Immortal Owl**: Stand completely still when its gaze locks.
   - **Immortal Deer**: Sprint away to escape its pursuit perimeter.
6. **Defend Sanctuary**: Repel raids, build palisades, defensive sentinel towers, Ranger lodges, and the Herbalist Hospital.
7. **5-Level Campaign**:
   - **Level 1 (Fire)**: The Kindled Clearing — tame Emberfang Wolf, survive starter patrols.
   - **Level 2 (Water)**: River Woodland — heal teammates, upgrade hospital, tame Silvermist Unicorn.
   - **Level 3 (Wind)**: Gale-Swept Canopy — gain wind mobility, build towers, tame Galeplume Sylph.
   - **Level 4 (Ice)**: Rimefrost Sanctuary — crowd-control raids, tame Glacier Frosthorn.
   - **Level 5 (Earth)**: Ancient Dragon Sovereign — perform 3-stage ritual to tame Aurelius the Ancient Dragon and withstand the Grand Imperial Siege!

---

## 🛠️ Local Development & Build

### Prerequisites
- Node.js (v18+ or v20+)
- npm

### Commands
```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run automated test suite
npm test

# Check TypeScript lints
npm run lint

# Build production bundle
npm run build

# Preview production build
npm run preview
```

---

## 📦 Pushing Code to Your GitHub Repository

To check this code into your GitHub repository:

```bash
# 1. Initialize git
git init

# 2. Add and commit all files
git add .
git commit -m "feat: complete Elemental Sorcerers 3D survival adventure game"

# 3. Rename branch to main
git branch -M main

# 4. Link your remote GitHub repository
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git

# 5. Push to GitHub (Git will prompt for your credentials/token)
git push -u origin main
```

*(Note: For security, never commit or paste credentials, personal access tokens, or passwords into public files or chat.)*
