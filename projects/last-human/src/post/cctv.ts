// Part 2: the look of a cheap night-vision security camera. Its own pass at the very end of the chain.
// Wide-lens barrel distortion, a slight colour fringe, monochrome grey-green IR response with a soft shoulder,
// 4 px scanlines, per-frame noise, a heavy vignette, and glitch bands (horizontal tears) driven by `glitch`.
// amount 0 = bypass (every non-camera shot), unless `glitch` > 0: then only the tear, on the ordinary picture.
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Uniform } from "three";

const frag = /* glsl */ `
uniform float amount;
uniform float seed;
uniform float glitch;
uniform float barrel;
uniform float noise;   // 0..1: the picture dissolves into static (a dead camera)
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (amount <= 0.0 && glitch <= 0.0) { outputColor = inputColor; return; }
  if (amount <= 0.0) {
    // an ordinary picture that tears for a frame (the copy skipping like a broken video): shifted bands, a colour split
    vec2 e = uv;
    float rw = floor(e.y * 30.0);
    float pk = step(1.0 - 0.4 * glitch, h1(vec2(rw, floor(seed))));
    e.x += glitch * (pk * (h1(vec2(rw, seed + 3.0)) - 0.5) * 0.12 + (h1(vec2(seed, 9.0)) - 0.5) * 0.01);
    float cb = 0.006 * glitch;
    vec3 cc = vec3(texture2D(inputBuffer, e + vec2(cb, 0.0)).r, texture2D(inputBuffer, e).g, texture2D(inputBuffer, e - vec2(cb, 0.0)).b);
    outputColor = vec4(cc, inputColor.a);
    return;
  }
  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;
  float r2 = dot(p, p) / (aspect * aspect + 1.0);                   // 0 at the centre, 1 in the corners
  vec2 q = p * (1.0 + barrel * (r2 - 1.0));                          // barrel: magnified centre, corners stay put (no black edges)
  q.x /= aspect;
  vec2 d = q * 0.5 + 0.5;
  // glitch: torn horizontal bands, shifted sideways; the whole frame jumps a little
  float row = floor(d.y * 38.0);
  float pick = step(1.0 - 0.35 * glitch, h1(vec2(row, floor(seed))));
  d.x += glitch * (pick * (h1(vec2(row, seed + 3.0)) - 0.5) * 0.16 + (h1(vec2(seed, 9.0)) - 0.5) * 0.012);
  float ca = 0.0012 + 0.006 * glitch;
  vec3 c = vec3(texture2D(inputBuffer, d + vec2(ca, 0.0)).r, texture2D(inputBuffer, d).g, texture2D(inputBuffer, d - vec2(ca, 0.0)).b);
  float inside = step(0.0, d.x) * step(d.x, 1.0) * step(0.0, d.y) * step(d.y, 1.0);
  vec3 g = pow(max(c, 0.0), vec3(1.0 / 2.2));
  float l = dot(g, vec3(0.30, 0.59, 0.11));
  l = max(0.0, l - 0.025) * 1.3;
  l = l / (l + 0.32) * 1.32;                                      // soft shoulder: IR blows out gently
  float sl = 0.9 + 0.1 * sin(uv.y * resolution.y * 1.5708);        // 4 px scanlines
  float roll = 0.04 * smoothstep(0.9, 1.0, sin(uv.y * 3.0 - seed * 0.05));   // a faint bright bar rolling up
  float n = h1(uv * resolution + seed * 17.13) - 0.5;
  l = l * sl + roll + n * (0.085 + 0.1 * glitch);
  l *= 1.0 - 0.6 * smoothstep(0.45, 1.25, length(uv * 2.0 - 1.0));  // heavy vignette
  vec3 col = clamp(l, 0.0, 1.15) * vec3(0.76, 1.0, 0.83) * inside;
  float sn = h1(floor(uv * resolution / 2.0) + seed * 3.7);
  col = mix(col, vec3(sn * 0.85) * vec3(0.9, 1.0, 0.92), noise);
  outputColor = vec4(mix(inputColor.rgb, pow(col, vec3(2.2)), amount), inputColor.a);
}`;

export class CctvEffect extends Effect {
  constructor() {
    super("CctvEffect", frag, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([["amount", new Uniform(0)], ["seed", new Uniform(0)], ["glitch", new Uniform(0)], ["barrel", new Uniform(0.2)], ["noise", new Uniform(0)]]),
    });
  }
  set amount(v: number) { this.uniforms.get("amount")!.value = v; }
  set seed(v: number) { this.uniforms.get("seed")!.value = v; }
  set glitch(v: number) { this.uniforms.get("glitch")!.value = v; }
  set barrel(v: number) { this.uniforms.get("barrel")!.value = v; }
  set noise(v: number) { this.uniforms.get("noise")!.value = v; }
}
