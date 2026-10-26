'use client';

import { useEffect, useRef } from 'react';
import { SparklesIcon } from 'lucide-react';

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 v_uv;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_pointer;

// Ethereal Cato Blurple palette:
// Deep Sapphire (#0e1b9a), Electric Blue (#2e4bff), True Blue-Violet (#5b3df5),
// Luminous Blurple (#7459ff), Ethereal Periwinkle Caustic (#b8afff)
float wave(vec2 p, vec2 center, float freq, float speed, float phase) {
  float d = length(p - center);
  return sin(d * freq - u_time * speed + phase) * exp(-d * 1.45);
}

void main() {
  vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
  vec2 uv = (v_uv - 0.5) * aspect + 0.5;
  vec2 ptr = (u_pointer - 0.5) * aspect + 0.5;

  float t = u_time;

  // Gentle organic drift of multiple water drop sources
  vec2 c1 = vec2(0.5 + 0.22 * cos(t * 0.42), 0.5 + 0.18 * sin(t * 0.51));
  vec2 c2 = vec2(0.5 - 0.26 * sin(t * 0.37), 0.5 + 0.21 * cos(t * 0.46));
  vec2 c3 = vec2(0.5 + 0.16 * sin(t * 0.63 + 1.4), 0.5 - 0.22 * cos(t * 0.39));
  vec2 c4 = ptr;

  float h = 0.0;
  h += wave(uv, vec2(0.5, 0.5), 24.0, 3.2, 0.0) * 0.42;
  h += wave(uv, c1, 31.0, 3.8, 1.1) * 0.34;
  h += wave(uv, c2, 27.0, 2.9, 2.4) * 0.32;
  h += wave(uv, c3, 38.0, 4.3, 4.0) * 0.25;
  h += wave(uv, c4, 34.0, 4.1, 0.5) * 0.30;

  // Subtle surface micro-ripples
  h += 0.08 * sin(uv.x * 18.0 + t * 1.7) * cos(uv.y * 16.0 - t * 1.4);

  // Compute approximate surface normals via finite offset in wave field
  float eps = 0.004;
  float hx =
    wave(uv + vec2(eps, 0.0), vec2(0.5, 0.5), 24.0, 3.2, 0.0) * 0.42 +
    wave(uv + vec2(eps, 0.0), c1, 31.0, 3.8, 1.1) * 0.34 +
    wave(uv + vec2(eps, 0.0), c2, 27.0, 2.9, 2.4) * 0.32 - h;
  float hy =
    wave(uv + vec2(0.0, eps), vec2(0.5, 0.5), 24.0, 3.2, 0.0) * 0.42 +
    wave(uv + vec2(0.0, eps), c1, 31.0, 3.8, 1.1) * 0.34 +
    wave(uv + vec2(0.0, eps), c2, 27.0, 2.9, 2.4) * 0.32 - h;

  vec3 normal = normalize(vec3(-hx * 16.0, -hy * 16.0, 1.0));
  vec3 lightDir = normalize(vec3(-0.35, 0.45, 0.85));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfVec = normalize(lightDir + viewDir);

  float diff = clamp(dot(normal, lightDir), 0.0, 1.0);
  float spec = pow(clamp(dot(normal, halfVec), 0.0, 1.0), 42.0);
  float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.4);

  vec3 deepIndigo = vec3(0.055, 0.105, 0.58);     // #0e1b94
  vec3 electricBlue = vec3(0.180, 0.294, 1.00);   // #2e4bff
  vec3 catoBlurple = vec3(0.380, 0.265, 0.965);   // #6144f6
  vec3 trueBlueViolet = vec3(0.495, 0.365, 0.99); // #7e5dfd
  vec3 causticGlow = vec3(0.78, 0.75, 1.00);      // #c7bfff

  float band = clamp(0.5 + 0.5 * h + 0.2 * sin(v_uv.x * 3.14159 + t * 0.4), 0.0, 1.0);
  vec3 base = mix(deepIndigo, electricBlue, smoothstep(0.0, 0.48, band));
  base = mix(base, catoBlurple, smoothstep(0.32, 0.76, band + 0.18 * sin(v_uv.y * 4.0 - t * 0.5)));
  base = mix(base, trueBlueViolet, smoothstep(0.62, 1.0, diff * 0.85 + h * 0.35));

  vec3 color = base + causticGlow * (spec * 0.65 + fresnel * 0.38);

  // Subtle vignette so the square feels deep and luminous
  float vig = smoothstep(1.05, 0.22, length(v_uv - 0.5));
  color *= mix(0.76, 1.06, vig);

  gl_FragColor = vec4(color, 1.0);
}
`;

export function CatoBlurpleRipple({
  title = 'Synthesizing architecture into live canvas…',
  subtitle = 'Sapphire, Azure, Ice & Indigo are preparing to draw your website in real time.',
  onSkip,
}: {
  title?: string;
  subtitle?: string;
  onSkip?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;
    const pointer = { x: 0.5, y: 0.5 };
    const start = performance.now();

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        pointer.x = (e.clientX - rect.left) / rect.width;
        pointer.y = 1.0 - (e.clientY - rect.top) / rect.height;
      }
    };
    canvas.addEventListener('pointermove', onMove);

    const gl =
      canvas.getContext('webgl', { antialias: true, alpha: false }) ||
      canvas.getContext('experimental-webgl');

    if (gl && gl instanceof WebGLRenderingContext) {
      const compile = (type: number, src: string) => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      const prog = gl.createProgram();

      if (vs && fs && prog) {
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        gl.useProgram(prog);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
          gl.STATIC_DRAW
        );

        const posLoc = gl.getAttribLocation(prog, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const uTime = gl.getUniformLocation(prog, 'u_time');
        const uRes = gl.getUniformLocation(prog, 'u_resolution');
        const uPtr = gl.getUniformLocation(prog, 'u_pointer');

        const renderGl = (now: number) => {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
          const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
          }
          gl.uniform1f(uTime, (now - start) * 0.001);
          gl.uniform2f(uRes, w, h);
          gl.uniform2f(uPtr, pointer.x, pointer.y);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          raf = requestAnimationFrame(renderGl);
        };
        raf = requestAnimationFrame(renderGl);

        return () => {
          cancelAnimationFrame(raf);
          canvas.removeEventListener('pointermove', onMove);
        };
      }
    }

    // Graceful 2D canvas water-ripple fallback when WebGL context is unavailable
    const ctx = canvas.getContext('2d');
    const render2d = (now: number) => {
      if (!ctx) return;
      const w = (canvas.width = Math.max(300, canvas.clientWidth));
      const h = (canvas.height = Math.max(300, canvas.clientHeight));
      const t = (now - start) * 0.001;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#1226c8');
      grad.addColorStop(0.45, '#2e4bff');
      grad.addColorStop(0.75, '#5b3df5');
      grad.addColorStop(1, '#7e5dfd');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 7; i++) {
        const r = (((t * 75 + i * 52) % Math.max(w, h)) * 0.65);
        const alpha = Math.max(0, 0.32 * (1 - r / (Math.max(w, h) * 0.65)));
        ctx.strokeStyle = `rgba(199, 191, 255, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.5, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      raf = requestAnimationFrame(render2d);
    };
    raf = requestAnimationFrame(render2d);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div className="cato-blurple-ripple" data-blurple-ripple>
      <canvas ref={canvasRef} className="cato-blurple-ripple__canvas" aria-hidden="true" />
      <div className="cato-blurple-ripple__rings" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="cato-blurple-ripple__overlay">
        <div className="cato-blurple-ripple__card">
          <div className="cato-blurple-ripple__badge">
            <SparklesIcon size={14} />
            <span>Cato Blurple · Ethereal Render Stage</span>
          </div>
          <h4>{title}</h4>
          <p>{subtitle}</p>
          <div className="cato-blurple-ripple__crew">
            <span style={{ '--crew-c': '#1226c8' } as React.CSSProperties}>
              <i /> Sapphire · Strategy
            </span>
            <span style={{ '--crew-c': '#2e4bff' } as React.CSSProperties}>
              <i /> Azure · Design
            </span>
            <span style={{ '--crew-c': '#6b87ff' } as React.CSSProperties}>
              <i /> Ice · Engineering
            </span>
            <span style={{ '--crew-c': '#6656e8' } as React.CSSProperties}>
              <i /> Indigo · Discoverability
            </span>
          </div>
          {onSkip && (
            <button type="button" className="cato-blurple-ripple__skip" onClick={onSkip}>
              Enter live canvas now →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
