"use client";

import { useEffect, useRef } from "react";

export default function FluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- WEBGL FLUID SIMULATION LOGIC ---
    // Simplified version for React Background
    let config = {
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 1024,
      CAPTURE_RESOLUTION: 512,
      DENSITY_DISSIPATION: 1,
      VELOCITY_DISSIPATION: 0.2,
      PRESSURE: 0.8,
      PRESSURE_ITERATIONS: 20,
      CURL: 30,
      SPLAT_RADIUS: 0.25,
      SPLAT_FORCE: 6000,
      SHADING: true,
      COLORFUL: true,
      COLOR_UPDATE_SPEED: 10,
      PAUSED: false,
      BACK_COLOR: { r: 0, g: 0, b: 0 },
      TRANSPARENT: false,
      BLOOM: true,
      BLOOM_ITERATIONS: 8,
      BLOOM_RESOLUTION: 256,
      BLOOM_INTENSITY: 0.8,
      BLOOM_THRESHOLD: 0.6,
      BLOOM_SOFT_KNEE: 0.7,
      SUNRAYS: true,
      SUNRAYS_RESOLUTION: 196,
      SUNRAYS_WEIGHT: 1.0,
    };

    function pointerPrototype() {
      this.id = -1;
      this.texcoordX = 0;
      this.texcoordY = 0;
      this.prevTexcoordX = 0;
      this.prevTexcoordY = 0;
      this.deltaX = 0;
      this.deltaY = 0;
      this.down = false;
      this.moved = false;
      this.color = [30, 0, 300];
    }

    let pointers = [];
    let splatStack = [];
    pointers.push(new pointerPrototype());

    const { gl, ext } = getWebGLContext(canvas);

    if (!ext.supportLinearFiltering) {
      config.DYE_RESOLUTION = 512;
      config.SHADING = false;
      config.BLOOM = false;
      config.SUNRAYS = false;
    }

    function getWebGLContext(canvas) {
      const params = {
        alpha: true,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: false,
      };

      let gl = canvas.getContext("webgl2", params);
      const isWebGL2 = !!gl;
      if (!isWebGL2)
        gl =
          canvas.getContext("webgl", params) ||
          canvas.getContext("experimental-webgl", params);

      let halfFloat;
      let supportLinearFiltering;
      if (isWebGL2) {
        gl.getExtension("EXT_color_buffer_float");
        supportLinearFiltering = gl.getExtension("OES_texture_float_linear");
      } else {
        halfFloat = gl.getExtension("OES_texture_half_float");
        supportLinearFiltering = gl.getExtension(
          "OES_texture_half_float_linear"
        );
      }

      gl.clearColor(0.0, 0.0, 0.0, 1.0);

      const halfFloatTexType = isWebGL2
        ? gl.HALF_FLOAT
        : halfFloat.HALF_FLOAT_OES;
      let formatRGBA;
      let formatRG;
      let formatR;

      // ... (Format setup simplified for brevity, assuming standard support) ...
      // In a real robust implementation we check support.
      // For this snippet we assume standard loose WebGL2 or WebGL1 with extensions.
      if (isWebGL2) {
        formatRGBA = getSupportedFormat(
          gl,
          gl.RGBA16F,
          gl.RGBA,
          halfFloatTexType
        );
        formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
      } else {
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      }

      return {
        gl,
        ext: {
          formatRGBA,
          formatRG,
          formatR,
          halfFloatTexType,
          supportLinearFiltering,
        },
      };
    }

    function getSupportedFormat(gl, internalFormat, format, type) {
      if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
        switch (internalFormat) {
          case gl.R16F:
            return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
          case gl.RG16F:
            return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
          default:
            return null;
        }
      }
      return { internalFormat, format };
    }

    function supportRenderTextureFormat(gl, internalFormat, format, type) {
      let texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        4,
        4,
        0,
        format,
        type,
        null
      );
      let fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );
      let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      return status == gl.FRAMEBUFFER_COMPLETE;
    }

    // --- SHADERS ---
    const baseVertexShader = compileShader(
      gl.VERTEX_SHADER,
      `
            precision highp float;
            attribute vec2 aPosition;
            varying vec2 vUv;
            varying vec2 vL;
            varying vec2 vR;
            varying vec2 vT;
            varying vec2 vB;
            uniform vec2 texelSize;
            void main () {
                vUv = aPosition * 0.5 + 0.5;
                vL = vUv - vec2(texelSize.x, 0.0);
                vR = vUv + vec2(texelSize.x, 0.0);
                vT = vUv + vec2(0.0, texelSize.y);
                vB = vUv - vec2(0.0, texelSize.y);
                gl_Position = vec4(aPosition, 0.0, 1.0);
            }
        `
    );

    const blurVertexShader = compileShader(
      gl.VERTEX_SHADER,
      `
            precision highp float;
            attribute vec2 aPosition;
            varying vec2 vUv;
            varying vec2 vL;
            varying vec2 vR;
            void main () {
                vUv = aPosition * 0.5 + 0.5;
                vL = vUv - vec2(texelSize.x, 0.0);
                vR = vUv + vec2(texelSize.x, 0.0);
                gl_Position = vec4(aPosition, 0.0, 1.0);
            }
        `
    );

    const blurShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
            precision mediump float;
            precision mediump sampler2D;
            varying vec2 vUv;
            varying vec2 vL;
            varying vec2 vR;
            uniform sampler2D uTexture;
            void main () {
                vec4 sum = texture2D(uTexture, vUv) * 0.29411764705882354;
                sum += texture2D(uTexture, vL) * 0.35294117647058826;
                sum += texture2D(uTexture, vR) * 0.35294117647058826;
                gl_FragColor = sum;
            }
        `
    );

    const copyShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
            precision mediump float;
            precision mediump sampler2D;
            varying highp vec2 vUv;
            uniform sampler2D uTexture;
            void main () {
                gl_FragColor = texture2D(uTexture, vUv);
            }
        `
    );

    const clearShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
            precision mediump float;
            precision mediump sampler2D;
            varying highp vec2 vUv;
            uniform sampler2D uTexture;
            uniform float value;
            void main () {
                gl_FragColor = value * texture2D(uTexture, vUv);
            }
        `
    );

    const colorShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
            precision mediump float;
            uniform vec4 color;
            void main () {
                gl_FragColor = color;
            }
        `
    );

    const splatShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
            precision highp float;
            precision highp sampler2D;
            varying vec2 vUv;
            uniform sampler2D uTarget;
            uniform float aspectRatio;
            uniform vec3 color;
            uniform vec2 point;
            uniform float radius;
            void main () {
                vec2 p = vUv - point.xy;
                p.x *= aspectRatio;
                vec3 splat = exp(-dot(p, p) / radius) * color;
                vec3 base = texture2D(uTarget, vUv).xyz;
                gl_FragColor = vec4(base + splat, 1.0);
            }
        `
    );

    const advectionShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
            precision highp float;
            precision highp sampler2D;
            varying vec2 vUv;
            uniform sampler2D uVelocity;
            uniform sampler2D uSource;
            uniform vec2 texelSize;
            uniform float dt;
            uniform float dissipation;
            void main () {
                vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize; // Back trace
                vec4 result = texture2D(uSource, coord);
                float decay = 1.0 + dissipation * dt;
                gl_FragColor = result / decay;
            }
        `
    );

    const divergenceShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
            precision mediump float;
            precision mediump sampler2D;
            varying highp vec2 vUv;
            varying highp vec2 vL;
            varying highp vec2 vR;
            varying highp vec2 vT;
            varying highp vec2 vB;
            uniform sampler2D uVelocity;
            void main () {
                float L = texture2D(uVelocity, vL).x;
                float R = texture2D(uVelocity, vR).x;
                float T = texture2D(uVelocity, vT).y;
                float B = texture2D(uVelocity, vB).y;
                vec2 C = texture2D(uVelocity, vUv).xy;
                if (vL.x < 0.0) { L = -C.x; }
                if (vR.x > 1.0) { R = -C.x; }
                if (vT.y > 1.0) { T = -C.y; }
                if (vB.y < 0.0) { B = -C.y; }
                float div = 0.5 * (R - L + T - B);
                gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
            }
        `
    );

    const curlShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
            precision mediump float;
            precision mediump sampler2D;
            varying highp vec2 vUv;
            varying highp vec2 vL;
            varying highp vec2 vR;
            varying highp vec2 vT;
            varying highp vec2 vB;
            uniform sampler2D uVelocity;
            void main () {
                float L = texture2D(uVelocity, vL).y;
                float R = texture2D(uVelocity, vR).y;
                float T = texture2D(uVelocity, vT).x;
                float B = texture2D(uVelocity, vB).x;
                float vorticity = R - L - T + B;
                gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
            }
        `
    );

    const vorticityShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
            precision highp float;
            precision highp sampler2D;
            varying vec2 vUv;
            varying vec2 vL;
            varying vec2 vR;
            varying vec2 vT;
            varying vec2 vB;
            uniform sampler2D uVelocity;
            uniform sampler2D uCurl;
            uniform float curl;
            uniform float dt;
            void main () {
                float L = texture2D(uCurl, vL).x;
                float R = texture2D(uCurl, vR).x;
                float T = texture2D(uCurl, vT).x;
                float B = texture2D(uCurl, vB).x;
                float C = texture2D(uCurl, vUv).x;
                vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
                force /= length(force) + 0.0001;
                force *= curl * C;
                force.y *= -1.0;
                vec2 velocity = texture2D(uVelocity, vUv).xy;
                velocity += force * dt;
                velocity = min(max(velocity, -1000.0), 1000.0);
                gl_FragColor = vec4(velocity, 0.0, 1.0);
            }
        `
    );

    const pressureShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
            precision mediump float;
            precision mediump sampler2D;
            varying highp vec2 vUv;
            varying highp vec2 vL;
            varying highp vec2 vR;
            varying highp vec2 vT;
            varying highp vec2 vB;
            uniform sampler2D uPressure;
            uniform sampler2D uDivergence;
            void main () {
                float L = texture2D(uPressure, vL).x;
                float R = texture2D(uPressure, vR).x;
                float T = texture2D(uPressure, vT).x;
                float B = texture2D(uPressure, vB).x;
                float C = texture2D(uPressure, vUv).x;
                float divergence = texture2D(uDivergence, vUv).x;
                float pressure = (L + R + B + T - divergence) * 0.25;
                gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
            }
        `
    );

    const gradientSubtractShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
            precision mediump float;
            precision mediump sampler2D;
            varying highp vec2 vUv;
            varying highp vec2 vL;
            varying highp vec2 vR;
            varying highp vec2 vT;
            varying highp vec2 vB;
            uniform sampler2D uPressure;
            uniform sampler2D uVelocity;
            void main () {
                float L = texture2D(uPressure, vL).x;
                float R = texture2D(uPressure, vR).x;
                float T = texture2D(uPressure, vT).x;
                float B = texture2D(uPressure, vB).x;
                vec2 velocity = texture2D(uVelocity, vUv).xy;
                velocity.xy -= vec2(R - L, T - B);
                gl_FragColor = vec4(velocity, 0.0, 1.0);
            }
        `
    );

    // --- PROGRAMS ---

    let splatProgram = createProgram(baseVertexShader, splatShader);
    let curlProgram = createProgram(baseVertexShader, curlShader);
    let vorticityProgram = createProgram(baseVertexShader, vorticityShader);
    let divergenceProgram = createProgram(baseVertexShader, divergenceShader);
    let pressureProgram = createProgram(baseVertexShader, pressureShader);
    let gradientSubtractProgram = createProgram(
      baseVertexShader,
      gradientSubtractShader
    );
    let advectionProgram = createProgram(baseVertexShader, advectionShader);

    let blit = (() => {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
        gl.STATIC_DRAW
      );
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array([0, 1, 2, 0, 2, 3]),
        gl.STATIC_DRAW
      );
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      return (destination) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      };
    })();

    function compileShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.trace(gl.getShaderInfoLog(shader));
      }
      return shader;
    }

    function createProgram(vertexShader, fragmentShader) {
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        console.trace(gl.getProgramInfoLog(program));
      return program;
    }

    // --- FBO & TEXTURE HELPERS ---

    let dye, velocity, divergence, curl, pressure;

    function initFramebuffers() {
      let simRes = getResolution(config.SIM_RESOLUTION);
      let dyeRes = getResolution(config.DYE_RESOLUTION);

      const texType = ext.halfFloatTexType;
      const rgba = ext.formatRGBA;
      const rg = ext.formatRG;
      const r = ext.formatR;

      dye = createDoubleFBO(
        dyeRes.width,
        dyeRes.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST
      );
      velocity = createDoubleFBO(
        simRes.width,
        simRes.height,
        rg.internalFormat,
        rg.format,
        texType,
        ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST
      );
      divergence = createFBO(
        simRes.width,
        simRes.height,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST
      );
      curl = createFBO(
        simRes.width,
        simRes.height,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST
      );
      pressure = createDoubleFBO(
        simRes.width,
        simRes.height,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST
      );
    }

    function createFBO(w, h, internalFormat, format, type, param) {
      gl.activeTexture(gl.TEXTURE0);
      let texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        w,
        h,
        0,
        format,
        type,
        null
      );
      let fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        texture,
        fbo,
        width: w,
        height: h,
        attach(id) {
          gl.activeTexture(gl.TEXTURE0 + id);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          return id;
        },
      };
    }

    function createDoubleFBO(w, h, internalFormat, format, type, param) {
      let fbo1 = createFBO(w, h, internalFormat, format, type, param);
      let fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
        width: w,
        height: h,
        texelSizeX: 1.0 / w,
        texelSizeY: 1.0 / h,
        get read() {
          return fbo1;
        },
        get write() {
          return fbo2;
        },
        swap() {
          let temp = fbo1;
          fbo1 = fbo2;
          fbo2 = temp;
        },
      };
    }

    function getResolution(resolution) {
      let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
      let min = Math.round(resolution);
      let max = Math.round(resolution * aspectRatio);
      if (gl.drawingBufferWidth > gl.drawingBufferHeight)
        return { width: max, height: min };
      else return { width: min, height: max };
    }

    initFramebuffers();

    // --- MAIN LOOP ---

    let lastUpdateTime = Date.now();
    let colorIndex = 0;

    function updateKeywords() {
      let displayWidth = window.innerWidth;
      let displayHeight = window.innerHeight;
      gl.canvas.width = displayWidth;
      gl.canvas.height = displayHeight;
    }

    function randomizeColors() {
      pointers.forEach((p) => {
        // Colorful neon colors
        p.color[0] = Math.random();
        p.color[1] = Math.random();
        p.color[2] = Math.random();
      });
    }

    function update() {
      const dt = Math.min((Date.now() - lastUpdateTime) / 1000, 0.016);
      lastUpdateTime = Date.now();

      gl.viewport(0, 0, velocity.width, velocity.height);

      // Advection velocity
      gl.useProgram(advectionProgram);
      gl.uniform2f(
        gl.getUniformLocation(advectionProgram, "texelSize"),
        velocity.texelSizeX,
        velocity.texelSizeY
      );
      gl.uniform1i(
        gl.getUniformLocation(advectionProgram, "uVelocity"),
        velocity.read.attach(0)
      );
      gl.uniform1i(
        gl.getUniformLocation(advectionProgram, "uSource"),
        velocity.read.attach(1)
      );
      gl.uniform1f(gl.getUniformLocation(advectionProgram, "dt"), dt);
      gl.uniform1f(
        gl.getUniformLocation(advectionProgram, "dissipation"),
        config.VELOCITY_DISSIPATION
      );
      blit(velocity.write.fbo);
      velocity.swap();

      // Advection dye
      gl.viewport(0, 0, dye.width, dye.height);
      gl.useProgram(advectionProgram);
      gl.uniform2f(
        gl.getUniformLocation(advectionProgram, "texelSize"),
        dye.texelSizeX,
        dye.texelSizeY
      );
      gl.uniform1i(
        gl.getUniformLocation(advectionProgram, "uVelocity"),
        velocity.read.attach(0)
      );
      gl.uniform1i(
        gl.getUniformLocation(advectionProgram, "uSource"),
        dye.read.attach(1)
      );
      gl.uniform1f(gl.getUniformLocation(advectionProgram, "dt"), dt);
      gl.uniform1f(
        gl.getUniformLocation(advectionProgram, "dissipation"),
        config.DENSITY_DISSIPATION
      );
      blit(dye.write.fbo);
      dye.swap();

      // Splat pointer
      gl.viewport(0, 0, velocity.width, velocity.height);
      gl.useProgram(splatProgram);
      gl.uniform1i(
        gl.getUniformLocation(splatProgram, "uTarget"),
        velocity.read.attach(0)
      );
      gl.uniform1f(
        gl.getUniformLocation(splatProgram, "aspectRatio"),
        canvas.width / canvas.height
      );
      gl.uniform1f(
        gl.getUniformLocation(splatProgram, "radius"),
        config.SPLAT_RADIUS / 100.0
      );

      // Auto Move for background effect
      // If not touched, we add random splats or move smoothly
      if (!pointers[0].down && Math.random() < 0.05) {
        const x = Math.random();
        const y = Math.random();
        const dx = (Math.random() - 0.5) * 500;
        const dy = (Math.random() - 0.5) * 500;
        splat(x, y, dx, dy, [
          Math.random() * 10,
          Math.random() * 10,
          Math.random() * 10,
        ]);
      }

      // Mouse interactions
      for (let i = 0; i < pointers.length; i++) {
        const p = pointers[i];
        if (p.moved) {
          splat(p.texcoordX, p.texcoordY, p.deltaX, p.deltaY, p.color);
          p.moved = false;
        }
      }

      // Curl
      gl.useProgram(curlProgram);
      gl.uniform2f(
        gl.getUniformLocation(curlProgram, "texelSize"),
        velocity.texelSizeX,
        velocity.texelSizeY
      );
      gl.uniform1i(
        gl.getUniformLocation(curlProgram, "uVelocity"),
        velocity.read.attach(0)
      );
      blit(curl.fbo);

      // Vorticity
      gl.useProgram(vorticityProgram);
      gl.uniform2f(
        gl.getUniformLocation(vorticityProgram, "texelSize"),
        velocity.texelSizeX,
        velocity.texelSizeY
      );
      gl.uniform1i(
        gl.getUniformLocation(vorticityProgram, "uVelocity"),
        velocity.read.attach(0)
      );
      gl.uniform1i(
        gl.getUniformLocation(vorticityProgram, "uCurl"),
        curl.attach(1)
      );
      gl.uniform1f(
        gl.getUniformLocation(vorticityProgram, "curl"),
        config.CURL
      );
      gl.uniform1f(gl.getUniformLocation(vorticityProgram, "dt"), dt);
      blit(velocity.write.fbo);
      velocity.swap();

      // Divergence
      gl.useProgram(divergenceProgram);
      gl.uniform2f(
        gl.getUniformLocation(divergenceProgram, "texelSize"),
        velocity.texelSizeX,
        velocity.texelSizeY
      );
      gl.uniform1i(
        gl.getUniformLocation(divergenceProgram, "uVelocity"),
        velocity.read.attach(0)
      );
      blit(divergence.fbo);

      // Pressure
      gl.useProgram(pressureProgram);
      gl.uniform2f(
        gl.getUniformLocation(pressureProgram, "texelSize"),
        velocity.texelSizeX,
        velocity.texelSizeY
      );
      gl.uniform1i(
        gl.getUniformLocation(pressureProgram, "uDivergence"),
        divergence.attach(0)
      );
      gl.uniform1i(
        gl.getUniformLocation(pressureProgram, "uPressure"),
        pressure.read.attach(1)
      );
      blit(pressure.write.fbo);
      pressure.swap();

      for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.useProgram(pressureProgram);
        gl.uniform1i(
          gl.getUniformLocation(pressureProgram, "uDivergence"),
          divergence.attach(0)
        );
        gl.uniform1i(
          gl.getUniformLocation(pressureProgram, "uPressure"),
          pressure.read.attach(1)
        );
        blit(pressure.write.fbo);
        pressure.swap();
      }

      // Gradient Subtract
      gl.useProgram(gradientSubtractProgram);
      gl.uniform2f(
        gl.getUniformLocation(gradientSubtractProgram, "texelSize"),
        velocity.texelSizeX,
        velocity.texelSizeY
      );
      gl.uniform1i(
        gl.getUniformLocation(gradientSubtractProgram, "uPressure"),
        pressure.read.attach(0)
      );
      gl.uniform1i(
        gl.getUniformLocation(gradientSubtractProgram, "uVelocity"),
        velocity.read.attach(1)
      );
      blit(velocity.write.fbo);
      velocity.swap();

      // Render Texture to Screen
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(copyShader);
      if (!config.TRANSPARENT) {
        // Draw Dye
        gl.uniform1i(
          gl.getUniformLocation(copyShader, "uTexture"),
          dye.read.attach(0)
        );
      }

      blit(null); // Draw to screen

      requestAnimationFrame(update);
    }

    function splat(x, y, dx, dy, color) {
      gl.viewport(0, 0, velocity.width, velocity.height);
      gl.useProgram(splatProgram);
      gl.uniform1i(
        gl.getUniformLocation(splatProgram, "uTarget"),
        velocity.read.attach(0)
      );
      gl.uniform1f(
        gl.getUniformLocation(splatProgram, "aspectRatio"),
        canvas.width / canvas.height
      );
      gl.uniform2f(gl.getUniformLocation(splatProgram, "point"), x, y);
      gl.uniform3f(gl.getUniformLocation(splatProgram, "color"), dx, dy, 0.0);
      gl.uniform1f(
        gl.getUniformLocation(splatProgram, "radius"),
        config.SPLAT_RADIUS / 100.0
      );
      blit(velocity.write.fbo);
      velocity.swap();

      gl.viewport(0, 0, dye.width, dye.height);
      gl.uniform1i(
        gl.getUniformLocation(splatProgram, "uTarget"),
        dye.read.attach(0)
      );
      gl.uniform3f(
        gl.getUniformLocation(splatProgram, "color"),
        color[0],
        color[1],
        color[2]
      );
      blit(dye.write.fbo);
      dye.swap();
    }

    // --- EVENTS ---
    const updatePointerDownData = (e) => {
      pointers[0].id = -1;
      pointers[0].down = true;
      pointers[0].moved = false;
      pointers[0].texcoordX = e.clientX / window.innerWidth;
      pointers[0].texcoordY = 1.0 - e.clientY / window.innerHeight;
      pointers[0].prevTexcoordX = pointers[0].texcoordX;
      pointers[0].prevTexcoordY = pointers[0].texcoordY;
      pointers[0].deltaX = 0;
      pointers[0].deltaY = 0;
      pointers[0].color = [
        Math.random() + 0.2,
        Math.random() + 0.2,
        Math.random() + 0.2,
      ];
    };

    const updatePointerMoveData = (e) => {
      const p = pointers[0];
      p.prevTexcoordX = p.texcoordX;
      p.prevTexcoordY = p.texcoordY;
      p.texcoordX = e.clientX / window.innerWidth;
      p.texcoordY = 1.0 - e.clientY / window.innerHeight;
      p.deltaX = (p.texcoordX - p.prevTexcoordX) * config.SPLAT_FORCE;
      p.deltaY = (p.texcoordY - p.prevTexcoordY) * config.SPLAT_FORCE;
      p.moved = Math.abs(p.deltaX) > 0 || Math.abs(p.deltaY) > 0;
    };

    window.addEventListener("mousedown", updatePointerDownData);
    window.addEventListener("touchstart", (e) =>
      updatePointerDownData(e.touches[0])
    );
    window.addEventListener("mousemove", updatePointerMoveData);
    window.addEventListener("touchmove", (e) => {
      e.preventDefault();
      updatePointerMoveData(e.touches[0]);
    });
    window.addEventListener("mouseup", () => {
      pointers[0].down = false;
    });
    window.addEventListener("resize", updateKeywords);

    // Initial random splats
    for (let i = 0; i < 10; i++) {
      splat(
        Math.random(),
        Math.random(),
        1000 * (Math.random() - 0.5),
        1000 * (Math.random() - 0.5),
        [Math.random(), Math.random(), Math.random()]
      );
    }

    updateKeywords();
    update();

    return () => {
      // Cleanup listeners if needed
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-auto"
      style={{ background: "#000" }}
    />
  );
}
