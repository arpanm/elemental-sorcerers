import * as THREE from 'three';
import { CreatureSpecies, ResourceType, SoldierArchetype } from '../types/game';

export function createStylizedTreeMesh(level: number): THREE.Group {
  const group = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 2.2, 7), trunkMat);
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  group.add(trunk);

  const foliageColors: Record<number, number> = {
    1: 0x2d6a4f,
    2: 0x1b7a6e,
    3: 0x40916c,
    4: 0x93c5fd,
    5: 0x6d28d9,
  };
  const crownMat = new THREE.MeshStandardMaterial({
    color: foliageColors[level] || 0x2d6a4f,
    roughness: 0.7,
  });

  const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.4, 7), crownMat);
  c1.position.y = 2.6;
  c1.castShadow = true;
  group.add(c1);

  const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.9, 7), crownMat);
  c2.position.y = 3.8;
  group.add(c2);

  return group;
}

export function createResourceNodeMesh(type: ResourceType, level: number): THREE.Group {
  if (type === 'wood') {
    return createStylizedTreeMesh(level);
  }

  const group = new THREE.Group();
  const colorMap: Record<ResourceType, number> = {
    wood: 0x2d6a4f,
    stone: 0x94a3b8,
    coal: 0x1e293b,
    minerals: 0xf59e0b,
    crystals: 0x38bdf8,
    ancientCore: 0xc084fc,
    berries: 0xe11d48,
    herbs: 0x34d399,
    dragonRelic: 0xfacc15,
  };

  if (type === 'crystals' || type === 'ancientCore' || type === 'dragonRelic') {
    const mat = new THREE.MeshStandardMaterial({
      color: colorMap[type],
      emissive: colorMap[type],
      emissiveIntensity: 0.45,
      roughness: 0.25,
    });
    const spire = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), mat);
    spire.position.y = 1.1;
    group.add(spire);
  } else if (type === 'berries' || type === 'herbs') {
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), bushMat);
    bush.position.y = 0.65;
    group.add(bush);

    const accentMat = new THREE.MeshStandardMaterial({
      color: colorMap[type],
      emissive: colorMap[type],
      emissiveIntensity: 0.3,
    });
    for (let i = 0; i < 4; i++) {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), accentMat);
      berry.position.set(Math.cos(i * 1.5) * 0.55, 0.85, Math.sin(i * 1.5) * 0.55);
      group.add(berry);
    }
  } else {
    const rockMat = new THREE.MeshStandardMaterial({
      color: colorMap[type],
      roughness: 0.85,
    });
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), rockMat);
    rock.position.y = 0.75;
    group.add(rock);
  }

  return group;
}

export function createSorcererMesh(): THREE.Group {
  const group = new THREE.Group();

  const robeMat = new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.6 });
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.75, 8), robeMat);
  robe.position.y = 0.88;
  group.add(robe);

  const headMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.5 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), headMat);
  head.position.y = 1.95;
  group.add(head);

  // Wizard hat
  const hatMat = new THREE.MeshStandardMaterial({ color: 0x4338ca, roughness: 0.6 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.08, 10), hatMat);
  brim.position.y = 2.22;
  group.add(brim);

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.85, 8), hatMat);
  cone.position.y = 2.65;
  group.add(cone);

  // Arcane staff with glowing orb
  const staff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 2.1, 6),
    new THREE.MeshStandardMaterial({ color: 0x78350f })
  );
  staff.position.set(0.55, 1.15, 0.25);
  group.add(staff);

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.8,
    })
  );
  orb.position.set(0.55, 2.25, 0.25);
  group.add(orb);

  return group;
}

export function createCreatureMesh(species: CreatureSpecies): THREE.Group {
  const group = new THREE.Group();

  const palette: Record<CreatureSpecies, number> = {
    wolf: 0x94a3b8,
    bear: 0x78350f,
    unicorn: 0xf8fafc,
    sylph: 0x6ee7b7,
    frosthorn: 0x60a5fa,
    dragon: 0xdc2626,
    owl: 0xfef08a,
    deer: 0xfbbf24,
  };

  const mat = new THREE.MeshStandardMaterial({
    color: palette[species],
    roughness: 0.55,
  });

  if (species === 'dragon') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 2.8), mat);
    body.position.y = 1.4;
    group.add(body);

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.3, 6), mat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 2.2, 1.8);
    group.add(head);

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      side: THREE.DoubleSide,
    });
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.4), wingMat);
    leftWing.position.set(-1.8, 2.0, 0);
    leftWing.rotation.z = 0.35;
    group.add(leftWing);

    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.4), wingMat);
    rightWing.position.set(1.8, 2.0, 0);
    rightWing.rotation.z = -0.35;
    group.add(rightWing);
    return group;
  }

  const scale = species === 'bear' || species === 'frosthorn' ? 1.25 : 0.95;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 0.7 * scale, 1.5 * scale), mat);
  torso.position.y = 0.8 * scale;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6 * scale, 0.55 * scale, 0.65 * scale), mat);
  head.position.set(0, 1.25 * scale, 0.85 * scale);
  group.add(head);

  if (species === 'unicorn') {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.7, 6),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.7,
      })
    );
    horn.position.set(0, 1.75, 1.0);
    group.add(horn);
  }

  if (species === 'frosthorn' || species === 'deer') {
    const antlerMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
    });
    const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 5), antlerMat);
    a1.position.set(-0.25, 1.85, 0.85);
    a1.rotation.z = 0.4;
    group.add(a1);

    const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 5), antlerMat);
    a2.position.set(0.25, 1.85, 0.85);
    a2.rotation.z = -0.4;
    group.add(a2);
  }

  return group;
}

export function createSoldierMesh(archetype: SoldierArchetype): THREE.Group {
  const group = new THREE.Group();
  const colors: Record<SoldierArchetype, number> = {
    melee: 0xef4444,
    ranged: 0xa855f7,
    heavy: 0x475569,
    siege: 0xeab308,
  };

  const scale = archetype === 'heavy' ? 1.25 : 1.0;
  const armorMat = new THREE.MeshStandardMaterial({
    color: colors[archetype],
    metalness: 0.4,
    roughness: 0.5,
  });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42 * scale, 0.48 * scale, 1.45 * scale, 8),
    armorMat
  );
  body.position.y = 0.75 * scale;
  group.add(body);

  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.34 * scale, 8, 8), armorMat);
  helm.position.y = 1.68 * scale;
  group.add(helm);

  return group;
}
