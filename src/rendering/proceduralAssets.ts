import * as THREE from 'three';
import { CreatureSpecies, ResourceType, SoldierArchetype } from '../types/game';

// Helper to create faceted low-poly stylized materials
function createPBRMaterial(color: number, roughness = 0.5, metalness = 0.1, emissive = 0x000000, emissiveIntensity = 0.0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    flatShading: true,
  });
}

/**
 * 2026+ Stylized Procedural Pine & Ancient Oak Trees
 * Multi-tiered sculpted canopies with layered foliage clusters, bark roots, and moss accents
 */
export function createStylizedTreeMesh(level: number): THREE.Group {
  const group = new THREE.Group();

  // 1. Trunk with twisted root spurs
  const trunkMat = createPBRMaterial(0x4a3222, 0.85, 0.05);
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.65, 3.2, 8);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1.6;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // Root spurs grasping the terrain
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 5), trunkMat);
    root.position.set(Math.cos(angle) * 0.45, 0.4, Math.sin(angle) * 0.45);
    root.rotation.x = Math.sin(angle) * 0.45;
    root.rotation.z = -Math.cos(angle) * 0.45;
    group.add(root);
  }

  // Canopy color palettes matching level biomes
  const foliagePalette: Record<number, { primary: number; secondary: number; highlight: number }> = {
    1: { primary: 0x1e5e3a, secondary: 0x2d8a54, highlight: 0x48b874 }, // Emerald Clearing
    2: { primary: 0x1b4d5e, secondary: 0x257a8a, highlight: 0x3fb8be }, // River Woodland
    3: { primary: 0x24543d, secondary: 0x3d7e56, highlight: 0x62b57a }, // Gale Highland
    4: { primary: 0x2a4365, secondary: 0x426896, highlight: 0x7eb0d5 }, // Rimefrost Grove
    5: { primary: 0x442759, secondary: 0x6a388f, highlight: 0xa855f7 }, // Ancient Dragon Woods
  };
  const pal = foliagePalette[level] || foliagePalette[1];

  const folMat1 = createPBRMaterial(pal.primary, 0.75, 0.05);
  const folMat2 = createPBRMaterial(pal.secondary, 0.7, 0.05);
  const folMat3 = createPBRMaterial(pal.highlight, 0.65, 0.08);

  // Tier 1 (Base wide canopy)
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.2, 8), folMat1);
  c1.position.y = 3.2;
  c1.castShadow = true;
  group.add(c1);

  // Tier 2 (Middle canopy with slight offset for organic silhouette)
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.9, 8), folMat2);
  c2.position.set(0.08, 4.3, -0.05);
  c2.rotation.y = 0.4;
  c2.castShadow = true;
  group.add(c2);

  // Tier 3 (Upper canopy)
  const c3 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.6, 7), folMat3);
  c3.position.set(-0.05, 5.3, 0.05);
  c3.rotation.y = -0.3;
  c3.castShadow = true;
  group.add(c3);

  // Tier 4 (Spire apex tip)
  const c4 = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.1, 6), folMat2);
  c4.position.y = 6.1;
  group.add(c4);

  return group;
}

/**
 * High-Fidelity 3D Resource Nodes
 * Distinct faceted geometries with crystal levitation, glowing runes, and metallic veins
 */
export function createResourceNodeMesh(type: ResourceType, level: number): THREE.Group {
  if (type === 'wood') {
    return createStylizedTreeMesh(level);
  }

  const group = new THREE.Group();

  if (type === 'crystals' || type === 'ancientCore' || type === 'dragonRelic') {
    // Crystal pedestal
    const baseMat = createPBRMaterial(0x334155, 0.8, 0.2);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 0.5, 6), baseMat);
    pedestal.position.y = 0.25;
    pedestal.receiveShadow = true;
    group.add(pedestal);

    // Glowing main crystal shard
    const crystalColor = type === 'crystals' ? 0x38bdf8 : type === 'ancientCore' ? 0xc084fc : 0xfacc15;
    const crystalMat = createPBRMaterial(crystalColor, 0.2, 0.4, crystalColor, 0.7);
    const mainShard = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), crystalMat);
    mainShard.position.y = 1.35;
    mainShard.scale.set(0.8, 1.6, 0.8);
    mainShard.castShadow = true;
    group.add(mainShard);

    // Surrounding orbiting orbital shards
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const sub = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), crystalMat);
      sub.position.set(Math.cos(angle) * 0.9, 1.1 + (i % 2) * 0.3, Math.sin(angle) * 0.9);
      sub.rotation.set(0.3, angle, 0.2);
      group.add(sub);
    }

    // Glowing ground rune ring
    const ringMat = new THREE.MeshBasicMaterial({ color: crystalColor, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.25, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);
  } else if (type === 'berries' || type === 'herbs') {
    // Sculpted organic foliage bush
    const bushMat = createPBRMaterial(0x1e7e44, 0.8, 0.05);
    const mainBush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 1), bushMat);
    mainBush.position.y = 0.75;
    mainBush.scale.set(1.2, 0.9, 1.1);
    mainBush.castShadow = true;
    group.add(mainBush);

    const subBush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), bushMat);
    subBush.position.set(0.5, 0.5, -0.3);
    group.add(subBush);

    // Glowing red berries or luminescent herb leaves
    const berryColor = type === 'berries' ? 0xef4444 : 0x34d399;
    const berryMat = createPBRMaterial(berryColor, 0.3, 0.2, berryColor, 0.5);
    for (let i = 0; i < 7; i++) {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), berryMat);
      const theta = (i / 7) * Math.PI * 2;
      berry.position.set(Math.cos(theta) * 0.75, 0.75 + (i % 3) * 0.2, Math.sin(theta) * 0.75);
      group.add(berry);
    }
  } else {
    // Stone / Coal / Minerals rock formations with mineral streaks
    const stoneColor = type === 'coal' ? 0x1e293b : type === 'minerals' ? 0x475569 : 0x64748b;
    const rockMat = createPBRMaterial(stoneColor, 0.88, 0.15);

    const mainRock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), rockMat);
    mainRock.position.y = 0.85;
    mainRock.scale.set(1.2, 0.85, 1.0);
    mainRock.castShadow = true;
    group.add(mainRock);

    const sideRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 0), rockMat);
    sideRock.position.set(0.8, 0.45, 0.4);
    group.add(sideRock);

    if (type === 'minerals' || type === 'coal') {
      const veinColor = type === 'coal' ? 0x0f172a : 0xf59e0b;
      const veinMat = createPBRMaterial(veinColor, 0.4, 0.7, type === 'minerals' ? 0xd97706 : 0x000000, 0.4);
      for (let i = 0; i < 3; i++) {
        const shard = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.5), veinMat);
        shard.position.set(Math.sin(i * 2) * 0.7, 0.85 + i * 0.2, Math.cos(i * 2) * 0.7);
        shard.rotation.set(0.4, i, 0.3);
        group.add(shard);
      }
    }
  }

  return group;
}

/**
 * 2026+ Sculpted Sorcerer Character
 * Multi-layer robes, wizard hat with metal buckle, gold-trimmed mantle, glowing runes,
 * articulated hands, and an enchanted Archstaff with a floating orbiting crystal.
 */
export function createSorcererMesh(): THREE.Group {
  const group = new THREE.Group();

  // 1. Lower Robe (Flared gown with pleats)
  const robeMat = createPBRMaterial(0x1e1b4b, 0.75, 0.15);
  const robeLower = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.75, 1.25, 8), robeMat);
  robeLower.position.y = 0.65;
  robeLower.castShadow = true;
  group.add(robeLower);

  // 2. Torso / Tunic
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.34, 0.85, 8), robeMat);
  torso.position.y = 1.6;
  group.add(torso);

  // 3. Golden Sash Belt
  const sashMat = createPBRMaterial(0xf59e0b, 0.4, 0.6);
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.14, 8), sashMat);
  sash.position.y = 1.25;
  group.add(sash);

  // 4. Arcane Mantle / Shoulder Pauldrons with Glowing Runes
  const mantleMat = createPBRMaterial(0x312e81, 0.6, 0.2);
  const mantle = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.55), mantleMat);
  mantle.position.y = 1.95;
  group.add(mantle);

  const runeMat = createPBRMaterial(0x38bdf8, 0.2, 0.3, 0x38bdf8, 0.9);
  const leftRune = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.25), runeMat);
  leftRune.position.set(-0.42, 2.05, 0);
  group.add(leftRune);

  const rightRune = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.25), runeMat);
  rightRune.position.set(0.42, 2.05, 0);
  group.add(rightRune);

  // 5. Flowing Cape (curved back geometry)
  const capeMat = createPBRMaterial(0x4338ca, 0.7, 0.1);
  const cape = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.45, 0.06), capeMat);
  cape.position.set(0, 1.3, -0.28);
  cape.rotation.x = 0.12;
  group.add(cape);

  // 6. Head & Mask/Visor
  const skinMat = createPBRMaterial(0xfde68a, 0.55, 0.05);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), skinMat);
  head.position.y = 2.22;
  group.add(head);

  // Glowing Sorcerer Eyes
  const eyeMat = createPBRMaterial(0x38bdf8, 0.1, 0.1, 0x38bdf8, 1.0);
  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.08), eyeMat);
  leftEye.position.set(-0.1, 2.22, 0.24);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.08), eyeMat);
  rightEye.position.set(0.1, 2.22, 0.24);
  group.add(rightEye);

  // 7. Wizard Hat with curved tip
  const hatMat = createPBRMaterial(0x1e1b4b, 0.65, 0.2);
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 12), hatMat);
  hatBrim.position.y = 2.42;
  group.add(hatBrim);

  const hatCone1 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 10), hatMat);
  hatCone1.position.y = 2.75;
  group.add(hatCone1);

  const hatTip = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.55, 8), hatMat);
  hatTip.position.set(0, 3.25, -0.15);
  hatTip.rotation.x = -0.35;
  group.add(hatTip);

  // Hat buckle
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), sashMat);
  buckle.position.set(0, 2.52, 0.38);
  group.add(buckle);

  // 8. Arms & Staff Hand
  const armMat = createPBRMaterial(0x312e81, 0.7, 0.1);
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.75, 6), armMat);
  rightArm.position.set(0.48, 1.6, 0.15);
  rightArm.rotation.x = 0.45;
  group.add(rightArm);

  // 9. Enchanted Archstaff with Floating Elemental Core
  const staffShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 2.4, 7),
    createPBRMaterial(0x3e2723, 0.8, 0.1)
  );
  staffShaft.position.set(0.58, 1.25, 0.35);
  staffShaft.rotation.x = 0.15;
  group.add(staffShaft);

  // Staff Head Crown (Pronged gold crest)
  const staffCrest = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12, Math.PI * 1.5), sashMat);
  staffCrest.position.set(0.58, 2.45, 0.45);
  staffCrest.rotation.z = Math.PI / 4;
  group.add(staffCrest);

  // Floating rotating elemental crystal orb
  const orbMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), runeMat);
  orbMesh.name = 'staffOrb';
  orbMesh.position.set(0.58, 2.48, 0.45);
  group.add(orbMesh);

  return group;
}

/**
 * 2026+ Mythical Creatures:
 * Wolf with snout, fur ruff, tail; Unicorn with spiral horn, flowing mane;
 * Bear with shoulder armor; Dragon with ribbed wings and horns.
 */
export function createCreatureMesh(species: CreatureSpecies): THREE.Group {
  const group = new THREE.Group();

  if (species === 'wolf') {
    const furMat = createPBRMaterial(0x475569, 0.8, 0.1);
    const bellyMat = createPBRMaterial(0x94a3b8, 0.85, 0.05);
    const eyeMat = createPBRMaterial(0xf59e0b, 0.2, 0.2, 0xf59e0b, 0.8);

    // Torso & chest
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 1.6), furMat);
    body.position.y = 0.85;
    body.castShadow = true;
    group.add(body);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.6, 0.9), bellyMat);
    chest.position.set(0, 0.75, 0.2);
    group.add(chest);

    // Head with muzzle & snout
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.65), furMat);
    head.position.set(0, 1.35, 0.85);
    group.add(head);

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.48), bellyMat);
    muzzle.position.set(0, 1.25, 1.25);
    group.add(muzzle);

    // Wolf ears
    const leftEar = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 4), furMat);
    leftEar.position.set(-0.2, 1.72, 0.85);
    group.add(leftEar);

    const rightEar = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 4), furMat);
    rightEar.position.set(0.2, 1.72, 0.85);
    group.add(rightEar);

    // Glowing amber wolf eyes
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), eyeMat);
    leftEye.position.set(-0.16, 1.4, 1.1);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), eyeMat);
    rightEye.position.set(0.16, 1.4, 1.1);
    group.add(rightEye);

    // 4 Articulated legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.65, 0.2);
    const offsets = [
      [-0.28, 0.32, 0.55],
      [0.28, 0.32, 0.55],
      [-0.28, 0.32, -0.55],
      [0.28, 0.32, -0.55],
    ];
    offsets.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, furMat);
      leg.position.set(x, y, z);
      group.add(leg);
    });

    // Curved Tail
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.8, 5), furMat);
    tail.position.set(0, 0.85, -0.95);
    tail.rotation.x = -0.7;
    group.add(tail);

    return group;
  }

  if (species === 'unicorn') {
    const coatMat = createPBRMaterial(0xf8fafc, 0.55, 0.2);
    const maneMat = createPBRMaterial(0x38bdf8, 0.3, 0.4, 0x38bdf8, 0.4);
    const hornMat = createPBRMaterial(0xfacc15, 0.1, 0.8, 0xfacc15, 0.9);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 1.8), coatMat);
    body.position.y = 1.1;
    body.castShadow = true;
    group.add(body);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.9, 6), coatMat);
    neck.position.set(0, 1.7, 0.7);
    neck.rotation.x = 0.5;
    group.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.75), coatMat);
    head.position.set(0, 2.15, 1.05);
    group.add(head);

    // Starlight Spiral Horn
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.95, 6), hornMat);
    horn.position.set(0, 2.65, 1.25);
    horn.rotation.x = 0.4;
    group.add(horn);

    // Glowing mane along crest
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.4), maneMat);
    mane.position.set(0, 1.9, 0.45);
    mane.rotation.x = 0.5;
    group.add(mane);

    // Legs with hooves
    const legGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.9, 6);
    const offsets = [
      [-0.32, 0.45, 0.65],
      [0.32, 0.45, 0.65],
      [-0.32, 0.45, -0.65],
      [0.32, 0.45, -0.65],
    ];
    offsets.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, coatMat);
      leg.position.set(x, y, z);
      group.add(leg);

      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.15, 6), hornMat);
      hoof.position.set(x, 0.08, z);
      group.add(hoof);
    });

    return group;
  }

  if (species === 'dragon') {
    const scaleMat = createPBRMaterial(0x991b1b, 0.6, 0.3);
    const bellyMat = createPBRMaterial(0xd97706, 0.7, 0.2);
    const wingMat = createPBRMaterial(0xf97316, 0.65, 0.1, 0xf97316, 0.25);
    const hornMat = createPBRMaterial(0x1e293b, 0.4, 0.5);

    // Dragon Torso & Underbelly
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.4, 3.2), scaleMat);
    body.position.y = 1.6;
    body.castShadow = true;
    group.add(body);

    const belly = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 2.8), bellyMat);
    belly.position.set(0, 1.25, 0.1);
    group.add(belly);

    // Dragon Neck & Draconic Head
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 1.4, 6), scaleMat);
    neck.position.set(0, 2.4, 1.4);
    neck.rotation.x = 0.6;
    group.add(neck);

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.6, 6), scaleMat);
    head.position.set(0, 3.1, 2.2);
    head.rotation.x = Math.PI / 2;
    group.add(head);

    // Glowing Dragon Eyes
    const eyeMat = createPBRMaterial(0xfacc15, 0.1, 0.2, 0xfacc15, 1.0);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), eyeMat);
    eyeL.position.set(-0.45, 3.15, 2.0);
    group.add(eyeL);

    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), eyeMat);
    eyeR.position.set(0.45, 3.15, 2.0);
    group.add(eyeR);

    // Dragon Horns
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.1, 5), hornMat);
    hornL.position.set(-0.55, 3.7, 1.6);
    hornL.rotation.set(-0.4, 0, -0.5);
    group.add(hornL);

    const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.1, 5), hornMat);
    hornR.position.set(0.55, 3.7, 1.6);
    hornR.rotation.set(-0.4, 0, 0.5);
    group.add(hornR);

    // Wide Ribbed Dragon Wings
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.8), wingMat);
    wingL.position.set(-2.4, 2.5, 0.2);
    wingL.rotation.set(0.2, 0, 0.4);
    group.add(wingL);

    const wingR = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.8), wingMat);
    wingR.position.set(2.4, 2.5, 0.2);
    wingR.rotation.set(0.2, 0, -0.4);
    group.add(wingR);

    // Long Tail with Spaded Fin
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 2.4, 6), scaleMat);
    tail.position.set(0, 1.4, -2.4);
    tail.rotation.x = -0.5;
    group.add(tail);

    const tailSpade = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), hornMat);
    tailSpade.position.set(0, 0.9, -3.6);
    tailSpade.rotation.x = -Math.PI / 2;
    group.add(tailSpade);

    return group;
  }

  // Fallback for Bear, Sylph, Frosthorn, Owl, Deer
  const colors: Record<CreatureSpecies, number> = {
    wolf: 0x475569,
    bear: 0x451a03,
    unicorn: 0xf8fafc,
    sylph: 0x34d399,
    frosthorn: 0x60a5fa,
    dragon: 0xdc2626,
    owl: 0xfef08a,
    deer: 0xfbbf24,
  };
  const c = colors[species];
  const mat = createPBRMaterial(c, 0.7, 0.15);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.8), mat);
  torso.position.y = 1.0;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 0.8), mat);
  head.position.set(0, 1.5, 1.0);
  group.add(head);

  if (species === 'frosthorn' || species === 'deer') {
    const hornMat = createPBRMaterial(0xe0f2fe, 0.2, 0.5, 0x60a5fa, 0.6);
    const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 5), hornMat);
    a1.position.set(-0.35, 2.2, 0.9);
    a1.rotation.z = 0.5;
    group.add(a1);

    const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 5), hornMat);
    a2.position.set(0.35, 2.2, 0.9);
    a2.rotation.z = -0.5;
    group.add(a2);
  }

  return group;
}

/**
 * 2026+ Imperial Raid Soldiers:
 * Visored knight helm with crest, plate armor cuirass, heraldic tunic,
 * riveted kite shield, and gleaming steel broadsword.
 */
export function createSoldierMesh(archetype: SoldierArchetype): THREE.Group {
  const group = new THREE.Group();

  const palette: Record<SoldierArchetype, { steel: number; cloth: number; crest: number }> = {
    melee: { steel: 0x94a3b8, cloth: 0xdc2626, crest: 0xef4444 }, // Crimson Vanguard
    ranged: { steel: 0x64748b, cloth: 0x7c3aed, crest: 0xa855f7 }, // Shadow Crossbow
    heavy: { steel: 0x334155, cloth: 0x1e293b, crest: 0xf59e0b }, // Juggernaut
    siege: { steel: 0x78350f, cloth: 0xb45309, crest: 0xf97316 }, // Brimstone Sapper
  };
  const pal = palette[archetype];

  const scale = archetype === 'heavy' ? 1.3 : 1.0;
  const steelMat = createPBRMaterial(pal.steel, 0.35, 0.7);
  const clothMat = createPBRMaterial(pal.cloth, 0.8, 0.05);
  const goldMat = createPBRMaterial(pal.crest, 0.3, 0.8, pal.crest, 0.3);

  // 1. Legs / Greaves
  const legGeo = new THREE.CylinderGeometry(0.14 * scale, 0.16 * scale, 0.9 * scale, 6);
  const leftLeg = new THREE.Mesh(legGeo, steelMat);
  leftLeg.position.set(-0.25 * scale, 0.45 * scale, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, steelMat);
  rightLeg.position.set(0.25 * scale, 0.45 * scale, 0);
  group.add(rightLeg);

  // 2. Tunic & Cuirass Breastplate
  const cuirass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42 * scale, 0.48 * scale, 1.0 * scale, 8),
    steelMat
  );
  cuirass.position.y = 1.35 * scale;
  cuirass.castShadow = true;
  group.add(cuirass);

  // Heraldic surcoat
  const surcoat = new THREE.Mesh(
    new THREE.BoxGeometry(0.75 * scale, 0.85 * scale, 0.5 * scale),
    clothMat
  );
  surcoat.position.y = 1.35 * scale;
  group.add(surcoat);

  // 3. Knight Visored Helmet
  const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * scale, 0.36 * scale, 0.55 * scale, 8), steelMat);
  helm.position.y = 2.05 * scale;
  group.add(helm);

  // Helmet Visor Slit
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.38 * scale, 0.08 * scale, 0.25 * scale),
    createPBRMaterial(0x0f172a, 0.9, 0.1)
  );
  visor.position.set(0, 2.05 * scale, 0.25 * scale);
  group.add(visor);

  // Helmet Crest Plume
  const crest = new THREE.Mesh(
    new THREE.BoxGeometry(0.1 * scale, 0.45 * scale, 0.65 * scale),
    goldMat
  );
  crest.position.set(0, 2.45 * scale, -0.05 * scale);
  group.add(crest);

  // 4. Weapons & Shield
  if (archetype === 'ranged') {
    // Crossbow
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.85),
      createPBRMaterial(0x451a03, 0.8, 0.1)
    );
    stock.position.set(0.45, 1.45, 0.4);
    group.add(stock);

    const bowCross = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.08, 0.08),
      steelMat
    );
    bowCross.position.set(0.45, 1.45, 0.8);
    group.add(bowCross);
  } else {
    // Steel Broadsword
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.08 * scale, 1.1 * scale, 0.15 * scale),
      createPBRMaterial(0xe2e8f0, 0.2, 0.9)
    );
    blade.position.set(0.55 * scale, 1.55 * scale, 0.4 * scale);
    blade.rotation.x = 0.5;
    group.add(blade);

    // Kite Shield with golden emblem
    const shield = new THREE.Mesh(
      new THREE.BoxGeometry(0.12 * scale, 1.1 * scale, 0.7 * scale),
      clothMat
    );
    shield.position.set(-0.55 * scale, 1.35 * scale, 0.25 * scale);
    group.add(shield);

    const shieldTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.14 * scale, 0.4 * scale, 0.4 * scale),
      goldMat
    );
    shieldTrim.position.set(-0.56 * scale, 1.45 * scale, 0.25 * scale);
    group.add(shieldTrim);
  }

  return group;
}
