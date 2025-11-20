"use strict";
/*
===========================================================
IMPORTS
===========================================================
*/
import { initFileShaders, perspective, vec2, vec4, flatten, lookAt, rotateX, rotateY, scalem } from './helperfunctions.js';
/*
===========================================================
GLOBAL VARIABLES
===========================================================
WebGL handles, shader locations, matrices, buffers,
textures, images, sphere geometry, camera parameters, etc.
*/
let gl;
let program;
// Uniform variable locations
let umv;
let uproj;
let umode;
let mv; // model–view matrix
let p; // projection matrix
// Vertex attribute locations
let vPosition;
let vNormal;
let vTangent;
let vTexCoord;
// Texture uniform samplers
let uEarthMap;
let uSpecularMap;
let uNightMap;
let uNormalMap;
let uCloudMap;
// Lighting uniforms
let vAmbientDiffuseColor;
let vSpecularColor;
let vSpecularExponent;
let light_position;
let light_color;
let ambient_light;
// Sphere vertex data
let sphereverts;
// Mode array controlling effects: [earth, specular, night, normal, clouds]
let mode = [1, 0, 0, 0, 0];
let cloudsEnabled = false;
// Interaction state
let canvas;
let xAngle;
let yAngle;
let mouse_button_down = false;
let prevMouseX = 0;
let prevMouseY = 0;
let zoom = 45;
// Animation angles
let rotateAngle = 0;
let cloudRotateAngle = 0;
let stop = false;
// Texture handles
let earthTex;
let specularTex;
let nightTex;
let normalTex;
let cloudTex;
// Texture images
let earthImg;
let specularImg;
let nightImg;
let normalImg;
let cloudImg;
// Anisotropic filtering extension
let anisotropic_ext;
/*
===========================================================
WINDOW ONLOAD — PROGRAM ENTRY POINT
===========================================================
*/
window.onload = function init() {
    // Fetch canvas and initialize WebGL2 context
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) {
        alert("WebGL isn't available");
    }
    // Enable anisotropic texture filtering if available
    anisotropic_ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (!anisotropic_ext) {
        alert("Anisotropic filtering isn't supported!");
    }
    // Mouse controls
    canvas.addEventListener("mousedown", mouse_down);
    canvas.addEventListener("mousemove", mouse_drag);
    canvas.addEventListener("mouseup", mouse_up);
    // GL setup
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    // Compile and link shaders
    program = initFileShaders(gl, "vshader-texture.glsl", "fshader-texture.glsl");
    gl.useProgram(program);
    // Lookup uniform locations
    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");
    umode = gl.getUniformLocation(program, "mode");
    vAmbientDiffuseColor = gl.getUniformLocation(program, "vAmbientDiffuseColor");
    vSpecularColor = gl.getUniformLocation(program, "vSpecularColor");
    vSpecularExponent = gl.getUniformLocation(program, "vSpecularExponent");
    light_position = gl.getUniformLocation(program, "light_position");
    light_color = gl.getUniformLocation(program, "light_color");
    ambient_light = gl.getUniformLocation(program, "ambient_light");
    uEarthMap = gl.getUniformLocation(program, "earthMap");
    uSpecularMap = gl.getUniformLocation(program, "specularMap");
    uNightMap = gl.getUniformLocation(program, "nightMap");
    uNormalMap = gl.getUniformLocation(program, "normalMap");
    uCloudMap = gl.getUniformLocation(program, "cloudMap");
    // Set projection matrix
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    p = perspective(zoom, canvas.clientWidth / canvas.clientHeight, 1, 20);
    gl.uniformMatrix4fv(uproj, false, p.flatten());
    // Load all textures
    initTextures();
    // Build sphere mesh
    generateSphere(180);
    // Initial rotation
    xAngle = 0;
    yAngle = 0;
    gl.uniform1iv(umode, mode);
    /*
    Keyboard controls:
        1-4   toggle textures/maps
        5     toggle clouds
        arrows adjust zoom
        space pause rotation
    */
    window.addEventListener("keydown", event => {
        switch (event.key) {
            case "1":
                mode[0] ^= 1;
                break;
            case "2":
                mode[1] ^= 1;
                break;
            case "3":
                mode[2] ^= 1;
                break;
            case "4":
                mode[3] ^= 1;
                break;
            case "5":
                cloudsEnabled = !cloudsEnabled;
                break;
            case "ArrowDown":
                if (zoom < 170)
                    zoom += 5;
                break;
            case "ArrowUp":
                if (zoom > 10)
                    zoom -= 5;
                break;
            case " ":
                stop = !stop;
                break;
        }
        // Update projection matrix if zoom changed
        gl.uniform1iv(umode, mode);
        p = perspective(zoom, canvas.clientWidth / canvas.clientHeight, 1, 20);
        gl.uniformMatrix4fv(uproj, false, p.flatten());
        requestAnimationFrame(render);
    });
    // Refresh world each ~16ms (60 FPS)
    window.setInterval(update, 16);
};
/*
===========================================================
SPHERE GENERATION
===========================================================
Builds a sphere using latitude/longitude bands.
Each vertex stores:
    vec4 position
    vec4 normal
    vec4 tangent
    vec2 texCoord
This feeds the shader for lighting + normal mapping.
*/
function generateSphere(subdiv) {
    let step = (360.0 / subdiv) * (Math.PI / 180.0);
    sphereverts = [];
    // Lat/lon loops
    for (let lat = 0; lat <= Math.PI; lat += step) {
        for (let lon = 0; lon + step <= 2 * Math.PI; lon += step) {
            // Compute texture coordinates
            let u1 = lon / (2 * Math.PI);
            let u2 = (lon + step) / (2 * Math.PI);
            let v1 = -(lat / Math.PI);
            let v2 = -(lat + step) / Math.PI;
            // Compute tangents (for normal mapping)
            let tangent1 = new vec4(0, 1, 0, 0).cross(new vec4(Math.sin(lat) * Math.sin(lon), Math.cos(lat), Math.cos(lon) * Math.sin(lat), 0.0));
            let tangent2 = new vec4(0, 1, 0, 0).cross(new vec4(Math.sin(lat + step) * Math.sin(lon + step), Math.cos(lat + step), Math.cos(lon + step) * Math.sin(lat + step), 0.0));
            // fallback tangents
            if (tangent1[0] === 0 && tangent1[1] === 0 && tangent1[2] === 0)
                tangent1 = new vec4(1, 0, 0, 0);
            if (tangent2[0] === 0 && tangent2[1] === 0 && tangent2[2] === 0)
                tangent2 = new vec4(1, 0, 0, 0);
            /*
            Two triangles per quad. Push positions, normals,
            tangents, and texcoords in the correct order.
            */
            // TRIANGLE 1
            sphereverts.push(new vec4(Math.sin(lat) * Math.sin(lon), Math.cos(lat), Math.cos(lon) * Math.sin(lat), 1.0));
            sphereverts.push(new vec4(Math.sin(lat) * Math.sin(lon), Math.cos(lat), Math.cos(lon) * Math.sin(lat), 0.0));
            sphereverts.push(tangent1);
            sphereverts.push(new vec2(u1, v1));
            sphereverts.push(new vec4(Math.sin(lat) * Math.sin(lon + step), Math.cos(lat), Math.sin(lat) * Math.cos(lon + step), 1.0));
            sphereverts.push(new vec4(Math.sin(lat) * Math.sin(lon + step), Math.cos(lat), Math.sin(lat) * Math.cos(lon + step), 0.0));
            sphereverts.push(tangent1);
            sphereverts.push(new vec2(u2, v1));
            sphereverts.push(new vec4(Math.sin(lat + step) * Math.sin(lon + step), Math.cos(lat + step), Math.cos(lon + step) * Math.sin(lat + step), 1.0));
            sphereverts.push(new vec4(Math.sin(lat + step) * Math.sin(lon + step), Math.cos(lat + step), Math.cos(lon + step) * Math.sin(lat + step), 0.0));
            sphereverts.push(tangent2);
            sphereverts.push(new vec2(u2, v2));
            // Second triangle
            sphereverts.push(new vec4(Math.sin(lat + step) * Math.sin(lon + step), Math.cos(lat + step), Math.cos(lon + step) * Math.sin(lat + step), 1.0));
            sphereverts.push(new vec4(Math.sin(lat + step) * Math.sin(lon + step), Math.cos(lat + step), Math.cos(lon + step) * Math.sin(lat + step), 0.0));
            sphereverts.push(tangent2);
            sphereverts.push(new vec2(u2, v2));
            sphereverts.push(new vec4(Math.sin(lat + step) * Math.sin(lon), Math.cos(lat + step), Math.sin(lat + step) * Math.cos(lon), 1.0));
            sphereverts.push(new vec4(Math.sin(lat + step) * Math.sin(lon), Math.cos(lat + step), Math.sin(lat + step) * Math.cos(lon), 0.0));
            sphereverts.push(tangent2);
            sphereverts.push(new vec2(u1, v2));
            sphereverts.push(new vec4(Math.sin(lat) * Math.sin(lon), Math.cos(lat), Math.cos(lon) * Math.sin(lat), 1.0));
            sphereverts.push(new vec4(Math.sin(lat) * Math.sin(lon), Math.cos(lat), Math.cos(lon) * Math.sin(lat), 0.0));
            sphereverts.push(tangent1);
            sphereverts.push(new vec2(u1, v1));
        }
    }
    // Upload to GPU
    let sphereBufferID = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBufferID);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(sphereverts), gl.STATIC_DRAW);
    // Layout: 4 vec4 + vec2 = 56 bytes stride
    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 56, 0);
    gl.enableVertexAttribArray(vPosition);
    vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 56, 16);
    gl.enableVertexAttribArray(vNormal);
    vTangent = gl.getAttribLocation(program, "vTangent");
    gl.vertexAttribPointer(vTangent, 4, gl.FLOAT, false, 56, 32);
    gl.enableVertexAttribArray(vTangent);
    vTexCoord = gl.getAttribLocation(program, "texCoord");
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 56, 48);
    gl.enableVertexAttribArray(vTexCoord);
}
/*
===========================================================
MOUSE CONTROL — DRAG TO ROTATE CAMERA
===========================================================
*/
function mouse_drag(event) {
    if (mouse_button_down) {
        let thetaY = 360.0 * (event.clientX - prevMouseX) / canvas.clientWidth;
        let thetaX = 360.0 * (event.clientY - prevMouseY) / canvas.clientHeight;
        prevMouseX = event.clientX;
        prevMouseY = event.clientY;
        xAngle += thetaX;
        yAngle += thetaY;
    }
    requestAnimationFrame(render);
}
function mouse_down(event) {
    mouse_button_down = true;
    prevMouseX = event.clientX;
    prevMouseY = event.clientY;
    requestAnimationFrame(render);
}
function mouse_up() {
    mouse_button_down = false;
    requestAnimationFrame(render);
}
/*
===========================================================
TEXTURE LOADING
===========================================================
*/
function initTextures() {
    // Earth surface
    earthTex = gl.createTexture();
    earthImg = new Image();
    earthImg.onload = () => handleTextureLoaded(earthImg, earthTex);
    earthImg.src = 'Earth.png';
    // Specular map
    specularTex = gl.createTexture();
    specularImg = new Image();
    specularImg.onload = () => handleTextureLoaded(specularImg, specularTex);
    specularImg.src = "EarthSpec.png";
    // Night lights map
    nightTex = gl.createTexture();
    nightImg = new Image();
    nightImg.onload = () => handleTextureLoaded(nightImg, nightTex);
    nightImg.src = "EarthNight.png";
    // Normal map
    normalTex = gl.createTexture();
    normalImg = new Image();
    normalImg.onload = () => handleTextureLoaded(normalImg, normalTex);
    normalImg.src = "EarthNormal.png";
    // Clouds
    cloudTex = gl.createTexture();
    cloudImg = new Image();
    cloudImg.onload = () => handleTextureLoaded(cloudImg, cloudTex);
    cloudImg.src = "earthcloudmap-visness.png";
}
/*
Apply texture data & sampler settings
*/
function handleTextureLoaded(image, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameterf(gl.TEXTURE_2D, anisotropic_ext.TEXTURE_MAX_ANISOTROPY_EXT, 1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    console.log("Loaded:", image.src, "→ texture object:", texture);
}
/*
===========================================================
UPDATE LOOP (ANIMATION)
===========================================================
*/
function update() {
    if (!stop) {
        rotateAngle += .5; // Earth rotation
        cloudRotateAngle += .3; // Clouds rotate slightly slower
        if (rotateAngle >= 360)
            rotateAngle -= 360;
    }
    // Clouds rotate even when animation stopped
    cloudRotateAngle += .1;
    if (cloudRotateAngle >= 360)
        cloudRotateAngle -= 360;
    requestAnimationFrame(render);
}
/*
===========================================================
RENDER FUNCTION
===========================================================
Draws two passes:
    1. Earth (opaque)
    2. Clouds (transparent overlay)
===========================================================
*/
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Build camera/view transform
    let baseView = lookAt(new vec4(0, 0, 5, 1), // eye
    new vec4(0, 0, 0, 1), // center
    new vec4(0, 1, 0, 0) // up
    );
    // Apply user rotation + scaling
    let camera = baseView.mult(rotateY(yAngle)).mult(rotateX(xAngle)).mult(scalem(1.5, 1.5, 1.5));
    /*
    -------------------------------------------
    FIRST PASS: EARTH (OPAQUE)
    -------------------------------------------
    */
    mode[4] = 0; // Cloud mode OFF
    gl.uniform1iv(umode, mode);
    mv = camera.mult(rotateY(rotateAngle));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    // Bind textures to units 0–3
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, earthTex);
    gl.uniform1i(uEarthMap, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, specularTex);
    gl.uniform1i(uSpecularMap, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, nightTex);
    gl.uniform1i(uNightMap, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, normalTex);
    gl.uniform1i(uNormalMap, 3);
    // Material + lighting
    gl.uniform4fv(vAmbientDiffuseColor, [1, 1, 1, 1]);
    gl.uniform4fv(vSpecularColor, [1, 1, 1, 1]);
    gl.uniform1f(vSpecularExponent, 7.0);
    gl.uniform4fv(light_position, camera.mult(new vec4(10, 10, 10, 1)).flatten());
    gl.uniform4fv(light_color, [.7, .7, .7, 1]);
    gl.uniform4fv(ambient_light, [.1, .1, .1, 1]);
    // Draw Earth solid
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.drawArrays(gl.TRIANGLES, 0, sphereverts.length);
    /*
    -------------------------------------------
    SECOND PASS: CLOUDS (TRANSPARENT)
    -------------------------------------------
    */
    if (cloudsEnabled) {
        mode[4] = 1; // Cloud mode ON
        gl.uniform1iv(umode, mode);
        // Slightly larger sphere
        mv = camera.mult(rotateY(cloudRotateAngle)).mult(scalem(1.02, 1.02, 1.02));
        gl.uniformMatrix4fv(umv, false, mv.flatten());
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, cloudTex);
        gl.uniform1i(uCloudMap, 4);
        // Transparent blending for clouds
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.drawArrays(gl.TRIANGLES, 0, sphereverts.length);
        // Reset
        gl.disable(gl.BLEND);
        gl.depthMask(true);
    }
}
//# sourceMappingURL=globefunctions.js.map