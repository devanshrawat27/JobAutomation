"use client";

import { useEffect, useRef } from "react";

/**
 * A slow aurora behind the hero: three drifting light fields mixed in a tiny
 * WebGL shader. It renders at half resolution and is blurred by CSS, so it
 * stays cheap; it stops when offscreen and paints once under reduced motion.
 */
const VERTEX = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision mediump float;

uniform vec2 resolution;
uniform float time;
uniform float dark;

float blob(vec2 uv, vec2 center, float radius) {
  float d = length(uv - center);
  return smoothstep(radius, 0.0, d);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv.x *= resolution.x / resolution.y;

  float t = time * 0.06;

  vec2 a = vec2(0.55 + sin(t * 1.1) * 0.14, 0.72 + cos(t * 0.9) * 0.1);
  vec2 b = vec2(1.45 + cos(t * 0.8) * 0.16, 0.32 + sin(t * 1.3) * 0.12);
  vec2 c = vec2(1.05 + sin(t * 0.7 + 1.4) * 0.18, 0.95 + cos(t * 1.2) * 0.08);

  float blue = blob(uv, a, 0.72);
  float violet = blob(uv, b, 0.62);
  float aqua = blob(uv, c, 0.5);

  vec3 pale = vec3(0.804, 0.886, 1.0) * blue
            + vec3(0.886, 0.863, 1.0) * violet
            + vec3(0.741, 0.933, 1.0) * aqua;

  vec3 deep = vec3(0.106, 0.286, 0.702) * blue
            + vec3(0.361, 0.310, 0.867) * violet
            + vec3(0.086, 0.545, 0.831) * aqua;

  vec3 color = mix(pale, deep, dark);
  float coverage = blue * 0.62 + violet * 0.5 + aqua * 0.4;
  float alpha = clamp(coverage, 0.0, 1.0) * mix(0.85, 0.7, dark);

  gl_FragColor = vec4(color, alpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function Aurora() {
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;

    const gl = element.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) {
      element.dataset.fallback = "";
      return;
    }

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) {
      element.dataset.fallback = "";
      return;
    }

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      element.dataset.fallback = "";
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "resolution");
    const time = gl.getUniformLocation(program, "time");
    const dark = gl.getUniformLocation(program, "dark");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = true;
    let start = performance.now();

    // The app defaults to light, so only "dark" and "auto" may go dark.
    const isDark = () => {
      const attr = document.documentElement.getAttribute("data-theme");
      if (attr === "dark") return 1;
      if (attr === "auto") return window.matchMedia("(prefers-color-scheme: dark)").matches ? 1 : 0;
      return 0;
    };

    const resize = () => {
      const scale = 0.5;
      const width = Math.max(1, Math.floor(element.clientWidth * scale));
      const height = Math.max(1, Math.floor(element.clientHeight * scale));
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(resolution, width, height);
    };

    const draw = (now: number) => {
      resize();
      gl.uniform1f(time, (now - start) / 1000);
      gl.uniform1f(dark, isDark());
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      if (!visible) {
        frame = 0;
        return;
      }
      draw(now);
      frame = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (frame) return;
      start = performance.now();
      frame = requestAnimationFrame(loop);
    };

    if (still.matches) {
      draw(performance.now());
    } else {
      startLoop();
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible && !still.matches) startLoop();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    observer.observe(element);

    const onStill = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      draw(performance.now());
    };
    still.addEventListener("change", onStill);

    const onVisible = () => {
      if (!still.matches) startLoop();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      still.removeEventListener("change", onStill);
      document.removeEventListener("visibilitychange", onVisible);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return <canvas aria-hidden="true" className="aurora" ref={canvas} />;
}
