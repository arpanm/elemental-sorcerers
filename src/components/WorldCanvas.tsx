import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ELEMENT_CONFIG, LEVEL_CONFIGS } from '../config/gameConfig';
import {
  createCreatureMesh,
  createResourceNodeMesh,
  createSoldierMesh,
  createSorcererMesh,
} from '../rendering/proceduralAssets';
import { BuildingId, GameState } from '../types/game';

interface WorldCanvasProps {
  gameState: GameState;
  onMovePlayer: (newPos: { x: number; y: number; z: number }, rotY: number, movedDist: number) => void;
  onPrimaryAttack: () => void;
  onCastElement: () => void;
  onContextInteract: () => void;
}

export const WorldCanvas: React.FC<WorldCanvasProps> = ({
  gameState,
  onMovePlayer,
  onPrimaryAttack,
  onCastElement,
  onContextInteract,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
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
  const cameraPitchRef = useRef(0.48);
  const isDraggingRef = useRef(false);
  const keysPressedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const levelCfg = LEVEL_CONFIGS[stateRef.current.level] || LEVEL_CONFIGS[1];
    scene.background = new THREE.Color(levelCfg.skyColor);
    scene.fog = new THREE.FogExp2(levelCfg.fogColor, 0.014);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      160
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Room Environment for PBR metallic/roughness reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Warm Key Light & Cool Fill Light
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.65);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(25, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);

    const fireLight = new THREE.PointLight(0xf97316, 2.8, 28);
    fireLight.position.set(0, 2.4, 0);
    scene.add(fireLight);

    // Ground
    const groundGeo = new THREE.CircleGeometry(65, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: levelCfg.groundColor,
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Central Camp Clearing Cobblestone Ring
    const campGround = new THREE.Mesh(
      new THREE.CircleGeometry(13, 32),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 })
    );
    campGround.rotation.x = -Math.PI / 2;
    campGround.position.y = 0.02;
    scene.add(campGround);

    // Central Campfire & Protective Aura Ring
    const firePitGroup = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.35, 0),
        new THREE.MeshStandardMaterial({ color: 0x64748b })
      );
      const a = (i / 8) * Math.PI * 2;
      stone.position.set(Math.cos(a) * 1.1, 0.2, Math.sin(a) * 1.1);
      firePitGroup.add(stone);
    }
    const flameMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 1.8, 7),
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 0.9,
      })
    );
    flameMesh.position.y = 0.9;
    firePitGroup.add(flameMesh);
    scene.add(firePitGroup);

    const auraRingGeo = new THREE.RingGeometry(13.7, 14.0, 48);
    const auraRingMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });
    const auraRing = new THREE.Mesh(auraRingGeo, auraRingMat);
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.06;
    scene.add(auraRing);

    // Player Mesh
    const playerMesh = createSorcererMesh();
    scene.add(playerMesh);

    // Dynamic Entity Group Containers
    const buildingsGroup = new THREE.Group();
    const nodesGroup = new THREE.Group();
    const chestsGroup = new THREE.Group();
    const creaturesGroup = new THREE.Group();
    const petsGroup = new THREE.Group();
    const alliesGroup = new THREE.Group();
    const soldiersGroup = new THREE.Group();
    const dropsGroup = new THREE.Group();
    const immortalGroup = new THREE.Group();

    scene.add(buildingsGroup);
    scene.add(nodesGroup);
    scene.add(chestsGroup);
    scene.add(creaturesGroup);
    scene.add(petsGroup);
    scene.add(alliesGroup);
    scene.add(soldiersGroup);
    scene.add(dropsGroup);
    scene.add(immortalGroup);

    // Input Listeners
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

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        isDraggingRef.current = true;
      }
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current && document.pointerLockElement !== renderer.domElement) return;
      const sens = 0.004 * (stateRef.current.settings.mouseSensitivity || 1);
      cameraYawRef.current -= e.movementX * sens;
      cameraPitchRef.current = Math.max(
        0.18,
        Math.min(1.25, cameraPitchRef.current + e.movementY * sens)
      );
    };

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);

    let lastTime = performance.now();
    let animFrameId = 0;

    const rebuildDynamicGroups = (st: GameState) => {
      const lvCfg = LEVEL_CONFIGS[st.level] || LEVEL_CONFIGS[1];
      (ground.material as THREE.MeshStandardMaterial).color.setHex(lvCfg.groundColor);
      scene.background = new THREE.Color(lvCfg.skyColor);

      // Campfire visual update
      flameMesh.visible = st.campfire.isBurning;
      const pulse = 0.85 + Math.sin(performance.now() * 0.008) * 0.15;
      flameMesh.scale.set(pulse, pulse * (0.5 + st.campfire.fuel / st.campfire.maxFuel), pulse);
      fireLight.intensity = st.campfire.isBurning ? 2.5 * pulse : 0.1;

      const auraScale = st.campfire.auraRadius / 14.0;
      auraRing.scale.set(auraScale, auraScale, 1);
      auraRing.visible = st.campfire.isBurning;

      // Buildings
      buildingsGroup.clear();
      (Object.keys(st.buildings) as BuildingId[]).forEach((bId) => {
        const b = st.buildings[bId];
        if (b.level <= 0) return;
        const bMesh = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 1.4 + b.level * 0.45, 2.2),
          new THREE.MeshStandardMaterial({
            color: bId === 'sanctuary' ? 0x6366f1 : bId === 'hospital' ? 0x10b981 : 0x64748b,
          })
        );
        bMesh.position.set(b.position.x, (1.4 + b.level * 0.45) / 2, b.position.z);
        buildingsGroup.add(bMesh);
      });

      // Resource Nodes
      nodesGroup.clear();
      st.resourceNodes.forEach((n) => {
        if (n.amount <= 0) return;
        const mesh = createResourceNodeMesh(n.type, st.level);
        mesh.position.set(n.position.x, 0, n.position.z);
        nodesGroup.add(mesh);
      });

      // Chests
      chestsGroup.clear();
      st.chests.forEach((c) => {
        if (c.opened) return;
        const chestMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 0.75, 0.75),
          new THREE.MeshStandardMaterial({
            color: c.rarity === 'rare' ? 0xfacc15 : 0xb45309,
            emissive: c.rarity === 'rare' ? 0xf59e0b : 0x000000,
            emissiveIntensity: 0.35,
          })
        );
        chestMesh.position.set(c.position.x, 0.38, c.position.z);
        chestsGroup.add(chestMesh);
      });

      // Wild Creatures
      creaturesGroup.clear();
      st.wildCreatures.forEach((wc) => {
        const cm = createCreatureMesh(wc.species);
        cm.position.set(wc.position.x, 0, wc.position.z);
        creaturesGroup.add(cm);
      });

      // Tamed Pets
      petsGroup.clear();
      st.pets.forEach((pet, idx) => {
        const pm = createCreatureMesh(pet.species);
        const px =
          pet.command === 'follow'
            ? st.player.position.x + Math.cos(idx * 2.1) * 2.8
            : Math.cos(idx * 1.7) * 6;
        const pz =
          pet.command === 'follow'
            ? st.player.position.z + Math.sin(idx * 2.1) * 2.8
            : Math.sin(idx * 1.7) * 6;
        pm.position.set(px, 0, pz);
        petsGroup.add(pm);
      });

      // Teammates
      alliesGroup.clear();
      st.teammates.forEach((ally) => {
        const am = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.38, 1.0, 4, 8),
          new THREE.MeshStandardMaterial({
            color: ally.role === 'heal' ? 0x34d399 : ally.role === 'gather' ? 0xfbbf24 : 0x38bdf8,
          })
        );
        am.position.set(ally.position.x, 0.9, ally.position.z);
        alliesGroup.add(am);
      });

      // Enemy Soldiers
      soldiersGroup.clear();
      st.soldiers.forEach((s) => {
        const sm = createSoldierMesh(s.archetype);
        sm.position.set(s.position.x, 0, s.position.z);
        soldiersGroup.add(sm);
      });

      // Loot Drops
      dropsGroup.clear();
      st.lootDrops.forEach((d) => {
        if (d.collected) return;
        const orb = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.45, 0),
          new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            emissive: 0xfacc15,
            emissiveIntensity: 0.7,
          })
        );
        orb.position.set(d.position.x, 0.6, d.position.z);
        dropsGroup.add(orb);
      });

      // Immortal Owl or Deer Encounter
      immortalGroup.clear();
      if (st.immortalEncounter.activeType !== 'none') {
        const imMesh = createCreatureMesh(st.immortalEncounter.activeType);
        imMesh.position.set(
          st.immortalEncounter.originPosition.x,
          st.immortalEncounter.activeType === 'owl' ? 2.5 : 0,
          st.immortalEncounter.originPosition.z
        );
        immortalGroup.add(imMesh);

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(17.5, 18.0, 48),
          new THREE.MeshBasicMaterial({
            color: st.immortalEncounter.activeType === 'owl' ? 0xef4444 : 0xfacc15,
            side: THREE.DoubleSide,
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(
          st.immortalEncounter.originPosition.x,
          0.08,
          st.immortalEncounter.originPosition.z
        );
        immortalGroup.add(ring);
      }
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
        const speed = (isSprinting ? 10.5 : 6.8) * dt;

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

        // Day/Night lighting factor
        const daySin = Math.sin(((st.timeOfDay - 6) / 24) * Math.PI * 2);
        dirLight.intensity = Math.max(0.2, 0.75 + daySin * 0.55);
        hemiLight.intensity = Math.max(0.28, 0.55 + daySin * 0.25);

        // Third-person camera follow with pitch & yaw
        const camDist = 11.5;
        const camX =
          nextX - Math.sin(cameraYawRef.current) * Math.cos(cameraPitchRef.current) * camDist;
        const camY = Math.max(2.2, Math.sin(cameraPitchRef.current) * camDist);
        const camZ =
          nextZ + Math.cos(cameraYawRef.current) * Math.cos(cameraPitchRef.current) * camDist;

        camera.position.set(camX, camY, camZ);
        camera.lookAt(nextX, 1.6, nextZ);
      }

      rebuildDynamicGroups(st);
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  const activeElCfg = ELEMENT_CONFIG[gameState.player.activeElement];

  return (
    <div className="relative w-full h-full">
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        title="Drag mouse to rotate camera | WASD to move | Space Attack | Q Elemental Ability | E Interact"
      />
      <div
        className="pointer-events-none fixed bottom-3 right-3 px-3 py-1.5 rounded bg-slate-900/80 border text-xs text-slate-300"
        style={{ borderColor: activeElCfg.color }}
      >
        Drag Mouse: Rotate 3D Camera • WASD: Move • Shift: Sprint • Space: Staff Attack • Q:{' '}
        {activeElCfg.name} Ability • E: Context Action
      </div>
    </div>
  );
};
