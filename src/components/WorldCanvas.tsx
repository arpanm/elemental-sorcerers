import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ELEMENT_CONFIG, LEVEL_CONFIGS } from '../config/gameConfig';
import {
  createCreatureMesh,
  createResourceNodeMesh,
  createSoldierMesh,
  createSorcererMesh,
} from '../rendering/proceduralAssets';
import { distance2D } from '../systems/engineLogic';
import { BuildingId, GameState } from '../types/game';

interface WorldCanvasProps {
  gameState: GameState;
  onMovePlayer: (newPos: { x: number; y: number; z: number }, rotY: number, movedDist: number) => void;
  onPrimaryAttack: () => void;
  onCastElement: () => void;
  onContextInteract: () => void;
}

function tryCreateWebGLRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer | null {
  const configs: WebGLContextAttributes[] = [
    { antialias: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false, alpha: false },
    { antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false },
    { antialias: true, powerPreference: 'default', alpha: false },
    {},
  ];

  for (const cfg of configs) {
    try {
      const gl = canvas.getContext('webgl2', cfg);
      if (gl) {
        return new THREE.WebGLRenderer({
          canvas,
          context: gl,
          antialias: false,
          powerPreference: 'default',
        });
      }
    } catch {
      // try next config
    }
  }

  try {
    return new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      failIfMajorPerformanceCaveat: false,
    });
  } catch {
    return null;
  }
}

export const WorldCanvas: React.FC<WorldCanvasProps> = ({
  gameState,
  onMovePlayer,
  onPrimaryAttack,
  onCastElement,
  onContextInteract,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(gameState);
  stateRef.current = gameState;

  const callbacksRef = useRef({
    onMovePlayer,
    onPrimaryAttack,
    onCastElement,
    onContextInteract,
  });
  callbacksRef.current = {
    onMovePlayer,
    onPrimaryAttack,
    onCastElement,
    onContextInteract,
  };

  const cameraYawRef = useRef(0);
  const cameraPitchRef = useRef(0.42);
  const isDraggingRef = useRef(false);
  const keysPressedRef = useRef<Record<string, boolean>>({});
  const shakeIntensityRef = useRef(0);

  const [activeMode, setActiveMode] = useState<'3d' | '2.5d'>('3d');
  const [hardwareAccelerationDisabled, setHardwareAccelerationDisabled] = useState(false);

  // ============================================================================
  // 3D THREE.JS RENDERER (Runs when WebGL2 is available)
  // ============================================================================
  useEffect(() => {
    if (activeMode !== '3d') return;
    const container = mountRef.current;
    if (!container) return;

    container.innerHTML = '';
    const canvasElement = document.createElement('canvas');
    canvasElement.style.width = '100%';
    canvasElement.style.height = '100%';
    canvasElement.style.display = 'block';
    container.appendChild(canvasElement);

    const renderer = tryCreateWebGLRenderer(canvasElement);
    if (!renderer) {
      console.warn('WebGL2 is not supported or hardware acceleration is turned off. Falling back to 2.5D Canvas.');
      setHardwareAccelerationDisabled(true);
      setActiveMode('2.5d');
      return;
    }

    const initialWidth = container.clientWidth || window.innerWidth || 800;
    const initialHeight = container.clientHeight || window.innerHeight || 600;

    renderer.setSize(initialWidth, initialHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const scene = new THREE.Scene();
    const levelCfg = LEVEL_CONFIGS[stateRef.current.level] || LEVEL_CONFIGS[1];
    scene.background = new THREE.Color(levelCfg.skyColor);
    scene.fog = new THREE.FogExp2(levelCfg.fogColor, 0.016);

    const camera = new THREE.PerspectiveCamera(58, initialWidth / initialHeight, 0.1, 250);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.85);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    dirLight.position.set(30, 45, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const fireLight = new THREE.PointLight(0xf97316, 3.5, 32);
    fireLight.position.set(0, 2.6, 0);
    scene.add(fireLight);

    // Forest Terrain
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(70, 48),
      new THREE.MeshStandardMaterial({ color: levelCfg.groundColor, roughness: 0.95, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Outer perimeter rocks
    const outerBorderGroup = new THREE.Group();
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const dist = 58 + ((i % 4) - 2) * 2;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(3.5, 1),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 })
      );
      rock.position.set(Math.cos(angle) * dist, 1.8, Math.sin(angle) * dist);
      outerBorderGroup.add(rock);
    }
    scene.add(outerBorderGroup);

    // Central camp cobblestone
    const campGround = new THREE.Mesh(
      new THREE.CircleGeometry(13.5, 36),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.92 })
    );
    campGround.rotation.x = -Math.PI / 2;
    campGround.position.y = 0.02;
    campGround.receiveShadow = true;
    scene.add(campGround);

    // Central Campfire hearth
    const firePitGroup = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.42, 0),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 })
      );
      const a = (i / 10) * Math.PI * 2;
      stone.position.set(Math.cos(a) * 1.35, 0.25, Math.sin(a) * 1.35);
      firePitGroup.add(stone);
    }

    const logMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 6), logMat);
      log.rotation.z = 0.45;
      log.rotation.y = (i / 4) * Math.PI * 2;
      log.position.y = 0.35;
      firePitGroup.add(log);
    }

    const flameMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 1.2, roughness: 0.3 })
    );
    flameMesh.position.y = 1.1;
    firePitGroup.add(flameMesh);
    scene.add(firePitGroup);

    const auraRing = new THREE.Mesh(
      new THREE.RingGeometry(13.6, 14.1, 64),
      new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
    );
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.06;
    scene.add(auraRing);

    // Golden Quest Waypoint Pillar
    const waypointGroup = new THREE.Group();
    const waypointBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 40, 16),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    waypointBeam.position.y = 20;
    waypointGroup.add(waypointBeam);

    const diamondMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85, 0),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.9 })
    );
    diamondMesh.position.y = 3.5;
    waypointGroup.add(diamondMesh);
    scene.add(waypointGroup);

    // Fireflies
    const fireflyCount = 45;
    const fireflyGeo = new THREE.BufferGeometry();
    const fireflyPos = new Float32Array(fireflyCount * 3);
    for (let i = 0; i < fireflyCount; i++) {
      fireflyPos[i * 3] = (Math.random() - 0.5) * 80;
      fireflyPos[i * 3 + 1] = 0.8 + Math.random() * 4.5;
      fireflyPos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));
    scene.add(
      new THREE.Points(
        fireflyGeo,
        new THREE.PointsMaterial({ color: 0xfde047, size: 0.28, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending })
      )
    );

    const playerMesh = createSorcererMesh();
    scene.add(playerMesh);

    const buildingsGroup = new THREE.Group();
    const nodesGroup = new THREE.Group();
    const chestsGroup = new THREE.Group();
    const dummiesGroup = new THREE.Group();
    const creaturesGroup = new THREE.Group();
    const petsGroup = new THREE.Group();
    const alliesGroup = new THREE.Group();
    const soldiersGroup = new THREE.Group();
    const projectilesGroup = new THREE.Group();
    const dropsGroup = new THREE.Group();

    scene.add(buildingsGroup);
    scene.add(nodesGroup);
    scene.add(chestsGroup);
    scene.add(dummiesGroup);
    scene.add(creaturesGroup);
    scene.add(petsGroup);
    scene.add(alliesGroup);
    scene.add(soldiersGroup);
    scene.add(projectilesGroup);
    scene.add(dropsGroup);

    const nodeMeshes = new Map<string, THREE.Group>();
    const chestMeshes = new Map<string, THREE.Mesh>();
    const dummyMeshes = new Map<string, THREE.Group>();
    const creatureMeshes = new Map<string, THREE.Group>();
    const petMeshes = new Map<string, THREE.Group>();
    const allyMeshes = new Map<string, THREE.Mesh>();
    const soldierMeshes = new Map<string, THREE.Group>();
    const projectileMeshes = new Map<string, THREE.Mesh>();
    const dropMeshes = new Map<string, THREE.Mesh>();
    const buildingMeshes = new Map<string, THREE.Mesh>();

    let currentLevelTracked = -1;

    const setupLevelStaticMeshes = (st: GameState) => {
      currentLevelTracked = st.level;

      nodesGroup.clear();
      nodeMeshes.clear();
      st.resourceNodes.forEach((n) => {
        const mesh = createResourceNodeMesh(n.type, st.level);
        mesh.position.set(n.position.x, 0, n.position.z);
        mesh.visible = n.amount > 0;
        nodesGroup.add(mesh);
        nodeMeshes.set(n.id, mesh);
      });

      chestsGroup.clear();
      chestMeshes.clear();
      st.chests.forEach((c) => {
        const chestMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.85, 0.85),
          new THREE.MeshStandardMaterial({
            color: c.rarity === 'rare' ? 0xfacc15 : 0xb45309,
            emissive: c.rarity === 'rare' ? 0xd97706 : 0x000000,
            emissiveIntensity: 0.4,
            metalness: 0.5,
            roughness: 0.4,
          })
        );
        chestMesh.position.set(c.position.x, 0.42, c.position.z);
        chestMesh.visible = !c.opened;
        chestsGroup.add(chestMesh);
        chestMeshes.set(c.id, chestMesh);
      });

      dummiesGroup.clear();
      dummyMeshes.clear();
      st.trainingDummies.forEach((dm) => {
        const dGroup = new THREE.Group();
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.35, 1.8, 6),
          new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 })
        );
        post.position.y = 0.9;
        dGroup.add(post);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 })
        );
        head.position.y = 2.0;
        head.name = 'head';
        dGroup.add(head);

        dGroup.position.set(dm.position.x, 0, dm.position.z);
        dummiesGroup.add(dGroup);
        dummyMeshes.set(dm.id, dGroup);
      });
    };

    setupLevelStaticMeshes(stateRef.current);

    const raycaster = new THREE.Raycaster();
    const mouseCoord = new THREE.Vector2();
    let isMouseDown = false;
    let dragDistance = 0;

    const onPointerDown = () => {
      isMouseDown = true;
      dragDistance = 0;
      isDraggingRef.current = true;
    };

    const onPointerMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      dragDistance += Math.hypot(e.movementX, e.movementY);
      const sens = 0.0035 * (stateRef.current.settings.mouseSensitivity || 1);
      cameraYawRef.current -= e.movementX * sens;
      cameraPitchRef.current = Math.max(0.15, Math.min(1.2, cameraPitchRef.current + e.movementY * sens));
    };

    const onPointerUp = (e: MouseEvent) => {
      isMouseDown = false;
      isDraggingRef.current = false;

      if (dragDistance < 6 && stateRef.current.screen === 'playing') {
        const rect = canvasElement.getBoundingClientRect();
        mouseCoord.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseCoord.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseCoord, camera);

        const targetGroup = [...nodesGroup.children, ...creaturesGroup.children, ...chestsGroup.children, firePitGroup];
        const intersects = raycaster.intersectObjects(targetGroup, true);

        if (intersects.length > 0 && intersects[0].distance <= 18) {
          callbacksRef.current.onContextInteract();
        } else {
          shakeIntensityRef.current = 0.15;
          callbacksRef.current.onPrimaryAttack();
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keysPressedRef.current[e.code] = true;
      if (stateRef.current.screen !== 'playing') return;
      if (e.code === 'Space') {
        e.preventDefault();
        shakeIntensityRef.current = 0.15;
        callbacksRef.current.onPrimaryAttack();
      } else if (e.code === 'KeyQ') {
        shakeIntensityRef.current = 0.22;
        callbacksRef.current.onCastElement();
      } else if (e.code === 'KeyE') {
        callbacksRef.current.onContextInteract();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.code] = false;
    };

    const updateDimensions = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth || 800;
      const h = container.clientHeight || window.innerHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => updateDimensions());
    resizeObserver.observe(container);
    window.addEventListener('resize', updateDimensions);

    canvasElement.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let lastTime = performance.now();
    let animFrameId = 0;

    const updateDynamicScene = (st: GameState) => {
      if (st.level !== currentLevelTracked) {
        setupLevelStaticMeshes(st);
      }

      st.resourceNodes.forEach((n) => {
        const mesh = nodeMeshes.get(n.id);
        if (mesh) mesh.visible = n.amount > 0;
      });

      st.chests.forEach((c) => {
        const mesh = chestMeshes.get(c.id);
        if (mesh) mesh.visible = !c.opened;
      });

      st.trainingDummies.forEach((dm) => {
        const dg = dummyMeshes.get(dm.id);
        if (dg) {
          const head = dg.getObjectByName('head') as THREE.Mesh | undefined;
          if (head && head.material) {
            (head.material as THREE.MeshStandardMaterial).color.setHex(dm.hitReaction > 0 ? 0xef4444 : 0x15803d);
          }
          dg.rotation.z = dm.hitReaction > 0 ? Math.sin(performance.now() * 0.05) * 0.25 : 0;
        }
      });

      flameMesh.visible = st.campfire.isBurning;
      const pulse = 0.9 + Math.sin(performance.now() * 0.009) * 0.15;
      flameMesh.scale.set(pulse, pulse * (0.6 + st.campfire.fuel / st.campfire.maxFuel), pulse);
      fireLight.intensity = st.campfire.isBurning ? 3.0 * pulse : 0.1;

      const auraScale = st.campfire.auraRadius / 14.0;
      auraRing.scale.set(auraScale, auraScale, 1);
      auraRing.visible = st.campfire.isBurning;

      let waypointTarget = { x: 0, z: 0 };
      if (st.assistedStep === 1) {
        const node = st.resourceNodes.find((n) => n.amount > 0 && n.type === 'wood') || st.resourceNodes[0];
        if (node) waypointTarget = { x: node.position.x, z: node.position.z };
      } else if (st.assistedStep === 2) {
        waypointTarget = { x: 0, z: 0 };
      } else if (st.assistedStep === 3) {
        const dummy = st.trainingDummies[0];
        waypointTarget = dummy ? { x: dummy.position.x, z: dummy.position.z } : { x: 0, z: 9 };
      } else if (st.assistedStep === 4) {
        const c = st.wildCreatures[0];
        if (c) waypointTarget = { x: c.position.x, z: c.position.z };
      } else if (st.soldiers.length > 0) {
        waypointTarget = { x: st.soldiers[0].position.x, z: st.soldiers[0].position.z };
      }
      waypointGroup.position.set(waypointTarget.x, 0, waypointTarget.z);
      diamondMesh.rotation.y = performance.now() * 0.002;

      const staffOrb = playerMesh.getObjectByName('staffOrb');
      if (staffOrb && (staffOrb as THREE.Mesh).material) {
        staffOrb.rotation.y += 0.04;
        const activeCfg = ELEMENT_CONFIG[st.player.activeElement];
        ((staffOrb as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(activeCfg.hex);
        ((staffOrb as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(activeCfg.hex);
      }

      (Object.keys(st.buildings) as BuildingId[]).forEach((bId) => {
        const b = st.buildings[bId];
        let mesh = buildingMeshes.get(bId);
        if (!mesh && b.level > 0) {
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(2.4, 2.0, 2.4),
            new THREE.MeshStandardMaterial({
              color: bId === 'sanctuary' ? 0x4f46e5 : bId === 'hospital' ? 0x059669 : 0x475569,
              roughness: 0.7,
              metalness: 0.2,
            })
          );
          buildingsGroup.add(mesh);
          buildingMeshes.set(bId, mesh);
        }
        if (mesh) {
          mesh.visible = b.level > 0;
          mesh.position.set(b.position.x, (1.6 + b.level * 0.45) / 2, b.position.z);
        }
      });

      const wildIds = new Set(st.wildCreatures.map((c) => c.id));
      for (const [id, m] of creatureMeshes.entries()) {
        if (!wildIds.has(id)) {
          creaturesGroup.remove(m);
          creatureMeshes.delete(id);
        }
      }
      st.wildCreatures.forEach((wc) => {
        let cm = creatureMeshes.get(wc.id);
        if (!cm) {
          cm = createCreatureMesh(wc.species);
          creaturesGroup.add(cm);
          creatureMeshes.set(wc.id, cm);
        }
        cm.position.set(wc.position.x, 0, wc.position.z);
      });

      const petIds = new Set(st.pets.map((p) => p.id));
      for (const [id, m] of petMeshes.entries()) {
        if (!petIds.has(id)) {
          petsGroup.remove(m);
          petMeshes.delete(id);
        }
      }
      st.pets.forEach((pet, idx) => {
        let pm = petMeshes.get(pet.id);
        if (!pm) {
          pm = createCreatureMesh(pet.species);
          petsGroup.add(pm);
          petMeshes.set(pet.id, pm);
        }
        const px = pet.command === 'follow' ? st.player.position.x + Math.cos(idx * 2.1) * 2.8 : Math.cos(idx * 1.7) * 6;
        const pz = pet.command === 'follow' ? st.player.position.z + Math.sin(idx * 2.1) * 2.8 : Math.sin(idx * 1.7) * 6;
        pm.position.set(px, 0, pz);
      });

      st.teammates.forEach((ally) => {
        let am = allyMeshes.get(ally.id);
        if (!am) {
          am = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.4, 1.2, 4, 8),
            new THREE.MeshStandardMaterial({
              color: ally.role === 'heal' ? 0x10b981 : ally.role === 'gather' ? 0xf59e0b : 0x38bdf8,
              roughness: 0.6,
            })
          );
          alliesGroup.add(am);
          allyMeshes.set(ally.id, am);
        }
        am.position.set(ally.position.x, 1.0, ally.position.z);
        am.visible = !ally.incapacitated;
      });

      const soldierIds = new Set(st.soldiers.map((s) => s.id));
      for (const [id, m] of soldierMeshes.entries()) {
        if (!soldierIds.has(id)) {
          soldiersGroup.remove(m);
          soldierMeshes.delete(id);
        }
      }
      st.soldiers.forEach((s) => {
        let sm = soldierMeshes.get(s.id);
        if (!sm) {
          sm = createSoldierMesh(s.archetype);
          soldiersGroup.add(sm);
          soldierMeshes.set(s.id, sm);
        }
        sm.position.set(s.position.x, 0, s.position.z);
      });

      const projIds = new Set(st.projectiles.map((p) => p.id));
      for (const [id, m] of projectileMeshes.entries()) {
        if (!projIds.has(id)) {
          projectilesGroup.remove(m);
          projectileMeshes.delete(id);
        }
      }
      st.projectiles.forEach((p) => {
        let pm = projectileMeshes.get(p.id);
        if (!pm) {
          pm = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.35, 1),
            new THREE.MeshStandardMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 1.2 })
          );
          projectilesGroup.add(pm);
          projectileMeshes.set(p.id, pm);
        }
        pm.position.set(p.currentPos.x, p.currentPos.y, p.currentPos.z);
      });

      const dropIds = new Set(st.lootDrops.filter((d) => !d.collected).map((d) => d.id));
      for (const [id, m] of dropMeshes.entries()) {
        if (!dropIds.has(id)) {
          dropsGroup.remove(m);
          dropMeshes.delete(id);
        }
      }
      st.lootDrops.forEach((d) => {
        if (d.collected) return;
        let dm = dropMeshes.get(d.id);
        if (!dm) {
          dm = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.45, 0),
            new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.8 })
          );
          dropsGroup.add(dm);
          dropMeshes.set(d.id, dm);
        }
        dm.position.set(d.position.x, 0.6 + Math.sin(performance.now() * 0.005) * 0.15, d.position.z);
      });
    };

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const st = stateRef.current;
      if (st.screen === 'playing') {
        const keys = keysPressedRef.current;
        let moveForward = 0;
        let moveRight = 0;
        if (keys['KeyW'] || keys['ArrowUp']) moveForward += 1;
        if (keys['KeyS'] || keys['ArrowDown']) moveForward -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveRight += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveRight -= 1;

        const isSprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && st.player.stamina > 8;
        const speed = (isSprinting ? 11.0 : 7.2) * dt;

        let movedDist = 0;
        let nextX = st.player.position.x;
        let nextZ = st.player.position.z;
        let nextRot = st.player.rotationY;

        if (moveForward !== 0 || moveRight !== 0) {
          const inputAngle = Math.atan2(moveRight, moveForward);
          const worldAngle = cameraYawRef.current + inputAngle;
          const dx = Math.sin(worldAngle) * speed;
          const dz = -Math.cos(worldAngle) * speed;

          nextX = Math.max(-56, Math.min(56, nextX + dx));
          nextZ = Math.max(-56, Math.min(56, nextZ + dz));
          nextRot = worldAngle;
          movedDist = Math.hypot(dx, dz);
        }

        if (movedDist > 0) {
          callbacksRef.current.onMovePlayer({ x: nextX, y: 0, z: nextZ }, nextRot, movedDist);
        }

        playerMesh.position.set(nextX, 0, nextZ);
        playerMesh.rotation.y = -nextRot;

        const daySin = Math.sin(((st.timeOfDay - 6) / 24) * Math.PI * 2);
        dirLight.intensity = Math.max(0.35, 0.95 + daySin * 0.5);
        hemiLight.intensity = Math.max(0.4, 0.7 + daySin * 0.25);

        let shakeX = 0;
        let shakeY = 0;
        if (shakeIntensityRef.current > 0 && !st.settings.reducedCameraShake) {
          shakeX = (Math.random() - 0.5) * shakeIntensityRef.current;
          shakeY = (Math.random() - 0.5) * shakeIntensityRef.current;
          shakeIntensityRef.current = Math.max(0, shakeIntensityRef.current - dt * 1.5);
        }

        const camDist = 12.0;
        const camX = nextX - Math.sin(cameraYawRef.current) * Math.cos(cameraPitchRef.current) * camDist + shakeX;
        const camY = Math.max(2.4, Math.sin(cameraPitchRef.current) * camDist) + shakeY;
        const camZ = nextZ + Math.cos(cameraYawRef.current) * Math.cos(cameraPitchRef.current) * camDist;

        camera.position.set(camX, camY, camZ);
        camera.lookAt(nextX, 1.6, nextZ);
      }

      updateDynamicScene(st);
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
      canvasElement.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.dispose();
    };
  }, [activeMode]);

  // ============================================================================
  // 2.5D CANVAS2D TACTICAL VIEWPORT (Always works even with hardware accel off)
  // ============================================================================
  useEffect(() => {
    if (activeMode !== '2.5d') return;
    const canvas = canvas2dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();

    const updateSize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    const onKeyDown = (e: KeyboardEvent) => {
      keysPressedRef.current[e.code] = true;
      if (stateRef.current.screen !== 'playing') return;
      if (e.code === 'Space') {
        e.preventDefault();
        callbacksRef.current.onPrimaryAttack();
      } else if (e.code === 'KeyQ') {
        callbacksRef.current.onCastElement();
      } else if (e.code === 'KeyE') {
        callbacksRef.current.onContextInteract();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.code] = false;
    };

    const onCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const zoom = 14; // pixels per world meter
      const st = stateRef.current;

      const worldTargetX = st.player.position.x + (clickX - canvas.width / 2) / zoom;
      const worldTargetZ = st.player.position.z + (clickY - canvas.height / 2) / zoom;

      // Check if clicked near an interactable object
      const nearNode = st.resourceNodes.find((n) => n.amount > 0 && distance2D({ x: worldTargetX, y: 0, z: worldTargetZ }, n.position) <= 3.5);
      const nearCreature = st.wildCreatures.find((c) => distance2D({ x: worldTargetX, y: 0, z: worldTargetZ }, c.position) <= 4.0);
      const nearHearth = distance2D({ x: worldTargetX, y: 0, z: worldTargetZ }, { x: 0, y: 0, z: 0 }) <= 4.0;

      if (nearNode || nearCreature || nearHearth) {
        callbacksRef.current.onContextInteract();
      } else {
        callbacksRef.current.onPrimaryAttack();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('click', onCanvasClick);

    const render2D = () => {
      animId = requestAnimationFrame(render2D);
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const st = stateRef.current;
      if (st.screen === 'playing') {
        const keys = keysPressedRef.current;
        let dx = 0;
        let dz = 0;
        if (keys['KeyW'] || keys['ArrowUp']) dz -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) dz += 1;
        if (keys['KeyD'] || keys['ArrowRight']) dx += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;

        if (dx !== 0 || dz !== 0) {
          const isSprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && st.player.stamina > 8;
          const speed = (isSprinting ? 11.0 : 7.2) * dt;
          const angle = Math.atan2(dx, -dz);
          const moveX = Math.sin(angle) * speed;
          const moveZ = -Math.cos(angle) * speed;

          const nextX = Math.max(-56, Math.min(56, st.player.position.x + moveX));
          const nextZ = Math.max(-56, Math.min(56, st.player.position.z + moveZ));
          const movedDist = Math.hypot(moveX, moveZ);
          callbacksRef.current.onMovePlayer({ x: nextX, y: 0, z: nextZ }, angle, movedDist);
        }
      }

      // Drawing 2.5D Tactical World
      const zoom = 14;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const px = st.player.position.x;
      const pz = st.player.position.z;

      const toScreen = (wx: number, wz: number) => ({
        x: cx + (wx - px) * zoom,
        y: cy + (wz - pz) * zoom,
      });

      // Background gradient
      const bgGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, canvas.width * 0.7);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Main Clearing Boundary
      const center = toScreen(0, 0);
      ctx.beginPath();
      ctx.arc(center.x, center.y, 60 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#14532d22';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      // Cobblestone Camp Area
      ctx.beginPath();
      ctx.arc(center.x, center.y, 13.5 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#33415533';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.stroke();

      // Campfire Sanctuary Aura
      if (st.campfire.isBurning) {
        ctx.beginPath();
        ctx.arc(center.x, center.y, st.campfire.auraRadius * zoom, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(249, 115, 22, 0.08)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.6)';
        ctx.stroke();
      }

      // Central Campfire Flame
      ctx.beginPath();
      ctx.arc(center.x, center.y, 1.4 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = st.campfire.isBurning ? '#f97316' : '#475569';
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.fillText(st.campfire.isBurning ? '🔥 Hearth' : '⚫ Extinguished', center.x - 22, center.y - 12);

      // Resource Nodes
      st.resourceNodes.forEach((n) => {
        if (n.amount <= 0) return;
        const pos = toScreen(n.position.x, n.position.z);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.2 * zoom, 0, Math.PI * 2);
        ctx.fillStyle = n.type === 'wood' ? '#15803d' : n.type === 'berries' ? '#e11d48' : '#64748b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff44';
        ctx.stroke();
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '10px ui-sans-serif, system-ui';
        ctx.fillText(n.type === 'wood' ? '🌲 Pine' : n.type === 'berries' ? '🍓 Berries' : '🪨 Stone', pos.x - 18, pos.y - 10);
      });

      // Training Dummies
      st.trainingDummies.forEach((dm) => {
        const pos = toScreen(dm.position.x, dm.position.z);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.4 * zoom, 0, Math.PI * 2);
        ctx.fillStyle = dm.hitReaction > 0 ? '#ef4444' : '#0284c7';
        ctx.fill();
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText('🎯 Target Dummy', pos.x - 35, pos.y - 12);
      });

      // Wild Creatures
      st.wildCreatures.forEach((wc) => {
        const pos = toScreen(wc.position.x, wc.position.z);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.6 * zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#fef3c7';
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 11px ui-sans-serif';
        ctx.fillText(`🐾 ${wc.name}`, pos.x - 30, pos.y - 14);
      });

      // Enemy Soldiers
      st.soldiers.forEach((s) => {
        const pos = toScreen(s.position.x, s.position.z);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.4 * zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#dc2626';
        ctx.fill();
        ctx.fillStyle = '#fca5a5';
        ctx.fillText(`⚔️ Raider`, pos.x - 18, pos.y - 10);
      });

      // Projectiles
      st.projectiles.forEach((p) => {
        const pos = toScreen(p.currentPos.x, p.currentPos.z);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 0.8 * zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
      });

      // Player Sorcerer (Center of View)
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#6366f1';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#a5b4fc';
      ctx.stroke();

      // Facing Directional Line
      const angle = st.player.rotationY;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(angle) * 28, cy - Math.cos(angle) * 28);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Active Element Staff Orb
      const activeCfg = ELEMENT_CONFIG[st.player.activeElement];
      ctx.beginPath();
      ctx.arc(cx + Math.sin(angle + 0.5) * 22, cy - Math.cos(angle + 0.5) * 22, 0.6 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = activeCfg.color;
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px ui-sans-serif';
      ctx.fillText('🧙 Sorcerer', cx - 28, cy - 20);
    };

    render2D();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('click', onCanvasClick);
    };
  }, [activeMode]);

  const st = gameState;
  const activeElCfg = ELEMENT_CONFIG[st.player.activeElement];

  return (
    <div className="relative w-full h-full">
      {/* 3D Viewport Container */}
      {activeMode === '3d' && (
        <div
          ref={mountRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          title="Drag to rotate 3D camera | WASD to move | Click to attack or gather"
        />
      )}

      {/* 2.5D Tactical Canvas Viewport */}
      {activeMode === '2.5d' && (
        <canvas
          ref={canvas2dRef}
          className="w-full h-full cursor-crosshair block"
          title="WASD to move | Left-Click to attack/gather"
        />
      )}

      {/* VIEWPORT MODE SELECTOR & HARDWARE ACCELERATION NOTICE */}
      <div className="fixed top-24 right-3 z-30 flex flex-col items-end gap-1.5 pointer-events-auto">
        <div className="flex gap-1 bg-slate-900/90 border border-slate-700 p-1 rounded-xl shadow-xl text-xs">
          <button
            onClick={() => setActiveMode('3d')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              activeMode === '3d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            🎮 3D View
          </button>
          <button
            onClick={() => setActiveMode('2.5d')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              activeMode === '2.5d' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            🗺️ 2.5D Tactical View
          </button>
        </div>

        {hardwareAccelerationDisabled && activeMode === '2.5d' && (
          <div className="max-w-xs bg-slate-900/95 border border-amber-500/80 rounded-xl p-2.5 text-[11px] text-slate-200 shadow-xl">
            <div className="font-bold text-amber-400 mb-0.5">💡 Running in 2.5D Tactical Mode</div>
            <div>
              Browser WebGL2 hardware acceleration is currently disabled. All systems (combat, taming, campfire, spells) are fully playable in 2.5D.
            </div>
          </div>
        )}
      </div>

      {/* 2026+ FANTASY ARCANE RETICLE (Screen Center in 3D Mode) */}
      {activeMode === '3d' && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
          <div
            className="w-8 h-8 rounded-full border border-dashed opacity-60 flex items-center justify-center transition-all animate-spin-slow"
            style={{ borderColor: activeElCfg.color }}
          >
            <div className="w-1.5 h-1.5 rounded-full shadow-lg" style={{ backgroundColor: activeElCfg.color }} />
          </div>
        </div>
      )}

      {/* FLOATING COMBAT / PICKUP TEXT OVERLAYS */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {st.floatingTexts.map((ft) => (
          <div
            key={ft.id}
            className="absolute -translate-x-1/2 font-extrabold text-sm drop-shadow-md transition-all duration-100"
            style={{
              left: `${50 + (ft.position.x - st.player.position.x) * 16}%`,
              top: `${50 - (ft.position.y - 1) * 35}%`,
              color: ft.color,
              opacity: Math.min(1, ft.life * 1.2),
            }}
          >
            {ft.text}
          </div>
        ))}
      </div>

      {/* ASSISTED SPATIAL TARGET CUES */}
      <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 flex gap-3 text-[11px] font-bold">
        {st.resourceNodes
          .filter((n) => n.amount > 0 && distance2D(st.player.position, n.position) <= 12)
          .slice(0, 2)
          .map((n) => {
            const d = distance2D(st.player.position, n.position).toFixed(1);
            return (
              <div
                key={n.id}
                className="px-2.5 py-1 rounded-full bg-emerald-950/85 border border-emerald-400 text-emerald-200 shadow-lg flex items-center gap-1.5"
              >
                <span>🌲 {n.label}</span>
                <span className="bg-emerald-800 px-1.5 py-0.2 rounded text-[10px] text-white">{d}m • [E] / Click</span>
              </div>
            );
          })}

        {st.trainingDummies
          .filter((dm) => distance2D(st.player.position, dm.position) <= 14)
          .slice(0, 1)
          .map((dm) => {
            const d = distance2D(st.player.position, dm.position).toFixed(1);
            return (
              <div
                key={dm.id}
                className="px-2.5 py-1 rounded-full bg-indigo-950/85 border border-sky-400 text-sky-200 shadow-lg flex items-center gap-1.5"
              >
                <span>🎯 {dm.name}</span>
                <span className="bg-sky-800 px-1.5 py-0.2 rounded text-[10px] text-white">{d}m • [Space / L-Click] Strike</span>
              </div>
            );
          })}

        {st.wildCreatures
          .filter((c) => distance2D(st.player.position, c.position) <= 16)
          .slice(0, 1)
          .map((c) => {
            const d = distance2D(st.player.position, c.position).toFixed(1);
            return (
              <div
                key={c.id}
                className="px-2.5 py-1 rounded-full bg-amber-950/85 border border-amber-400 text-amber-200 shadow-lg flex items-center gap-1.5"
              >
                <span>🐾 {c.name}</span>
                <span className="bg-amber-800 px-1.5 py-0.2 rounded text-[10px] text-white">{d}m • [E] Tame</span>
              </div>
            );
          })}
      </div>

      {/* SUBTLE HELPER BADGE */}
      <div
        className="pointer-events-none fixed bottom-3 right-3 px-3.5 py-1.5 rounded-xl bg-slate-900/85 border text-xs text-slate-300 shadow-xl"
        style={{ borderColor: activeElCfg.color }}
      >
        Left-Click / Space: Staff Arcane Blast • Q: {activeElCfg.name} Spell • E / Click: Gather & Tame • Drag: Camera
      </div>
    </div>
  );
};
