import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useComposer } from "./post/Composer";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { LensBlur } from "./post/lensblur";
import { GradeEffect, GRADES } from "./post/grade";

const Inner: React.FC = () => {
  const f = useCurrentFrame();
  const { camera } = useThree();
  const scene = useMemo(() => {
    const g = new THREE.Group();
    for (let i = 0; i < 40; i++) {
      const h = 10 + ((i * 37) % 30);
      const m = new THREE.Mesh(new THREE.BoxGeometry(6, h, 6), new THREE.MeshStandardMaterial({ color: "#2a3050", roughness: 0.8 }));
      m.position.set(((i % 8) - 4) * 9, h / 2, -Math.floor(i / 8) * 14 - 10);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: "#1a1d2e", roughness: 0.3, metalness: 0.2 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
    const neon = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.5, 4) }));
    neon.position.set(-3, 6, -6); g.add(neon);
    const c = document.createElement("canvas"); c.width = 600; c.height = 1000;
    const x = c.getContext("2d")!; x.fillStyle = "#c2552b"; x.beginPath(); x.ellipse(300, 600, 150, 300, 0, 0, 7); x.fill();
    x.lineWidth = 12; x.strokeStyle = "#151020"; x.stroke();
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, alphaTest: 0.5 }));
    card.position.set(0, 0.9, -2); g.add(card);
    const sun = new THREE.DirectionalLight("#ffb070", 2.5); sun.position.set(20, 30, 10); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40 });
    g.add(sun, new THREE.HemisphereLight("#4a5a90", "#151020", 0.8));
    return g;
  }, []);
  const fx = useMemo(() => ({
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.6, luminanceThreshold: 1.0, mipmapBlur: true, levels: 6, radius: 0.6 }),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.golden, 1),
  }), []);
  const ip = getInputProps() as { lens?: boolean; msaa?: number; bloom?: boolean };
  useComposer([...(ip.lens === false ? [] : [fx.lens.pre, fx.lens.main]), [...(ip.bloom === false ? [] : [fx.bloom]), fx.tone, fx.grade]], { msaa: ip.msaa ?? 4 });
  camera.position.set(Math.sin(f / 30) * 2, 1.6, 4);
  camera.lookAt(0, 1.2, -2);
  fx.lens.focus = 6; fx.lens.cInf = 12;
  return (
    <>
      <fogExp2 attach="fog" args={["#1b2140", 0.025]} />
      <primitive object={scene} />
    </>
  );
};

export const Test: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false }} camera={{ fov: 40, near: 0.1, far: 800 }}>
      <Inner />
    </ThreeCanvas>
  </AbsoluteFill>
);
