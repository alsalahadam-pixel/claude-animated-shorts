// A drawn character living in the 3D world: a plane carrying a CanvasTexture, pivoting at the feet, turned toward the
// camera around Y (or laid flat). Unlit (the drawing carries its own cel lighting, chosen per shot to match the scene),
// fogged like the world, casting a cutout shadow, with a soft contact blob under the feet.
import * as THREE from "three";
import { blob } from "../world/props";
import type { Frame } from "./draw";

export class Card {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  pivot = new THREE.Group();
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  blob: THREE.Mesh;
  frame: Frame = { x0: -60, y0: -4, w: 120, h: 190 };

  constructor(pw: number, ph: number, o: { castShadow?: boolean; blob?: [number, number, number] } = {}) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = pw; this.canvas.height = ph;
    this.ctx = this.canvas.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.tex.generateMipmaps = true;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.04, depthWrite: true, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0.5, 0.5, 0);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = o.castShadow ?? true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.tex, alphaTest: 0.5 });
    this.mesh.renderOrder = 10;
    this.pivot.add(this.mesh);
    const [bw, bd, ba] = o.blob ?? [0.7, 0.32, 0.6];
    this.blob = blob(bw, bd, ba);
    this.blob.position.y = 0.006;
    this.setFrame(this.frame);
  }

  setFrame(F: Frame) {
    this.frame = F;
    this.mesh.scale.set(F.w / 100, F.h / 100, 1);
    this.mesh.position.set(F.x0 / 100, F.y0 / 100, 0);
  }

  /** change the canvas resolution (e.g. for a close push-in); the texture is re-allocated on the next upload */
  resize(pw: number, ph: number) {
    if (this.canvas.width === pw && this.canvas.height === ph) return;
    this.canvas.width = pw; this.canvas.height = ph; this.tex.dispose();
  }

  /** redraw: fn draws onto the card canvas (it clears it itself) */
  draw(fn: (ctx: CanvasRenderingContext2D, F: Frame) => void) {
    fn(this.ctx, this.frame);
    this.tex.needsUpdate = true;
  }

  /** stand at p (feet), turned toward the camera around Y; blob follows at floor height `floorY` */
  stand(p: THREE.Vector3, cam: THREE.Vector3, yawOffset = 0, floorY = p.y) {
    this.pivot.position.copy(p);
    this.pivot.rotation.set(0, Math.atan2(cam.x - p.x, cam.z - p.z) + yawOffset, 0);
    this.blob.position.set(p.x, floorY + 0.006, p.z);
    this.blob.visible = true;
  }

  add(parent: THREE.Object3D) { parent.add(this.pivot); parent.add(this.blob); }
  set visible(v: boolean) { this.pivot.visible = v; this.blob.visible = v; }
}
