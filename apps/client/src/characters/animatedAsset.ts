import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type AnimationState = "idle" | "walk" | "attack" | "dodge" | "death";
export interface AnimatedAsset {
  readonly loaded: boolean;
  readonly error?: string;
  setState(state: AnimationState): void;
  update(dt: number): void;
}

/** Mounts a rigged GLB beneath the persistent simulation transform.
 *  The original procedural mesh remains visible until loading succeeds.
 */
export async function mountAnimatedAsset(
  anchor: THREE.Group,
  fallback: THREE.Object3D,
  url: string,
  required: readonly string[]
): Promise<AnimatedAsset> {
  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(url);
    const available = new Map(gltf.animations.map(clip => [clip.name, clip]));
    const missing = required.filter(name => !available.has(name));
    if (missing.length) throw new Error("Missing clips: " + missing.join(", "));
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const actions = new Map<string, THREE.AnimationAction>();
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      if (["attack", "dodge", "death"].includes(clip.name)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      actions.set(clip.name, action);
    }
    anchor.add(gltf.scene);
    fallback.visible = false;
    let state: AnimationState | null = null;
    function setState(next: AnimationState) {
      if (next === state || !actions.has(next)) return;
      const previous = state ? actions.get(state) : undefined;
      const action = actions.get(next)!;
      action.reset();
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(1);
      action.play();
      if (previous && previous !== action) {
        action.crossFadeFrom(previous, 0.13, false);
      }
      state = next;
    }
    setState("idle");
    return {
      loaded: true,
      setState,
      update(dt) { mixer.update(Math.max(0, Math.min(0.05, dt))); }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Character GLB fallback:", url, message);
    return {loaded:false,error:message,setState(){},update(){}};
  }
}
