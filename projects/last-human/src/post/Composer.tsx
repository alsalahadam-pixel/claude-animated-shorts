// Manual postprocessing chain. @react-three/postprocessing builds its passes in effects after mount, which is too
// late for Remotion's per-frame advance() in a headless render (frames came out black). This builds the composer
// synchronously and renders it from useFrame with priority 1, which also switches off R3F's default render.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, EffectPass, RenderPass, Effect, Pass } from "postprocessing";

export type Stage = Effect | Effect[] | Pass;

export function useComposer(stages: Stage[], { msaa = 4 }: { msaa?: number } = {}) {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: msaa });
    c.addPass(new RenderPass(scene, camera));
    for (const s of stages) {
      if (s instanceof Pass) c.addPass(s);
      else c.addPass(new EffectPass(camera, ...(Array.isArray(s) ? s : [s])));
    }
    return c;
    // the stage list is fixed for the life of the canvas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);
  useEffect(() => { composer.setSize(size.width, size.height); }, [composer, size.width, size.height]);
  useEffect(() => () => composer.dispose(), [composer]);
  useFrame(() => { composer.render(); }, 1);
  return composer;
}
