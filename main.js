const vertexShaderSource = `
    attribute vec2 position;
    attribute vec2 texCoord;
    varying vec2 outTexCoord;
    void main() {
        gl_Position = vec4(position, 0, 1);
        outTexCoord = texCoord;
    }
`;

const fragmentShaderSource = `
    precision mediump float;

    varying vec2 outTexCoord;

    uniform float iTime;
    uniform vec2 iResolution;

    // 2D Random from The Book of Shaders
    float random(vec2 st) {
        return fract(sin(dot(st.xy,
                             vec2(12.9898,78.233)))
                     * 43758.5453123);
    }

    // 2D Noise from The Book of Shaders
    // Based on Morgan McGuire @morgan3d
    // https://www.shadertoy.com/view/4dS3Wd
    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);

        // Four corners in 2D of a tile
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));

        // Smooth Interpolation
        vec2 u = smoothstep(0.,1.,f);

        // Mix 4 coorners percentages
        return mix(a, b, u.x) +
                (c - a)* u.y * (1.0 - u.x) +
                (d - b) * u.x * u.y;
    }

    // Fractal Brownian Motion from The Book of Shaders
    #define OCTAVES 6
    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float lacunarity = 2.0;
        float persistence = 0.5;

        for (int i = 0; i < OCTAVES; i++) {
            value += amplitude * noise(p);
            p *= lacunarity;
            amplitude *= persistence;
        }

        return value;
    }

    vec3 cloud(vec2 uv, float time) {
        float n = fbm(uv * 4.0 + vec2(time * 0.1, 0.0));
        float cloud = smoothstep(0.3, 0.7, n);

        return vec3(cloud);
    }

    void main() {
        vec2 uv = outTexCoord;

        // Aspect ratio correction
        uv.x *= iResolution.x / iResolution.y;

        // Time variable for animation
        float time = iTime * 3.0;

        // Background color (sky)
        vec3 skyBlue = vec3(0.6, 0.8, 1.0);
        vec3 white = vec3(1.0);
        // -- Vertically linearly interpolate from skyBlue to white
        vec3 skyColor = mix(skyBlue, white, uv.y);

        // Combine sky and clouds
        vec3 cloudColor = vec3(1.0);
        vec3 color = mix(skyColor, cloudColor, cloud(uv, time));

        gl_FragColor = vec4(color, 1.0);
    }
`;

let gl, program, buffer;

// Code taken from webgl-by-example
function getRenderingContext() {
    const canvas = document.querySelector("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
        document.getElementById("container").innerHTML =
            "Failed to get WebGL context." +
            "Your browser or device may not support WebGL.";
        return null;
    }
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return gl;
}

function cleanup() {
    gl.useProgram(null);
    if (buffer)
        gl.deleteBuffer(buffer);
    if (program)
        gl.deleteProgram(program);
}

function setup(e) {
    // Clear load event listener
    window.removeEventListener(e.type, setup, false);
    if (!(gl = getRenderingContext()))
        return;

    // Set up shaders
    function compileShader(gl, source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    // Set up program
    function createProgram(gl, vertexShaderSource, fragmentShaderSource) {
        const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }
    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const linkErrLog = gl.getProgramInfoLog(program);
        cleanup();
        console.log("Shader program did not link successfully. " +
            "Error log: " + linkErrLog)
    }

    // Collect info for shader program
    const programInfo = {
        program: program,
        attribLocations: {
            position: gl.getAttribLocation(program, 'position'),
            texCoord: gl.getAttribLocation(program, 'texCoord'),
        },
        uniformLocations: {
            iTime: gl.getUniformLocation(program, 'iTime'),
            iResolution: gl.getUniformLocation(program, 'iResolution'),
        },
    };
    gl.useProgram(programInfo.program);

    // Position buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // texCoord buffer
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    const texCoords = new Float32Array([
        0, 0,
        1, 0,
        0, 1,
        0, 1,
        1, 0,
        1, 1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    // Pass position to vertex shader
    gl.enableVertexAttribArray(programInfo.attribLocations.position);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);

    // Pass texCoord to vertex shader
    gl.enableVertexAttribArray(programInfo.attribLocations.texCoord);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);

    function draw() {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(programInfo.uniformLocations.iTime, performance.now() / 1000);
        gl.uniform2f(programInfo.uniformLocations.iResolution, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(draw);
    }

    draw();
}

(function() {
    window.addEventListener("load", setup, false);
})();
