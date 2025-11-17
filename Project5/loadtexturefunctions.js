"use strict";
import { initFileShaders, perspective, vec2, vec4, flatten, lookAt, rotateX, rotateY, scalem } from './helperfunctions.js';
let gl;
let program;
//uniform locations
let umv; //uniform for mv matrix
let uproj; //uniform for projection matrix
//matrices
let mv; //local mv
let p; //local projection
let umode;
//shader variable indices for material properties
let vPosition; //
let vNormal;
let vTangent;
let vTexCoord;
let uEarthMap; //this will be a pointer to our sampler2D
let uSpecularMap;
let uNightMap;
let uNormalMap;
let uCloudMap;
let vAmbientDiffuseColor; //Ambient and Diffuse can be the same for the material
let vSpecularColor; //highlight color
let vSpecularExponent;
//uniform indices for light properties
let light_position;
let light_color;
let ambient_light;
let sphereverts;
let mode = 1;
//document elements
let canvas;
//interaction and rotation state
let xAngle;
let yAngle;
let mouse_button_down = false;
let prevMouseX = 0;
let prevMouseY = 0;
let zoom = 45;
let rotateAngle = 0;
let checkerTex;
//we can have multiple textures in graphics memory
let earthTex;
let specularTex;
let nightTex;
let normalTex;
let cloudTex;
//and we need a main memory location to load the files into
let earthImg;
let specularImg;
let nightImg;
let normalImg;
let cloudImg;
let anisotropic_ext;
window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) {
        alert("WebGL isn't available");
    }
    anisotropic_ext =
        gl.getExtension('EXT_texture_filter_anisotropic');
    if (anisotropic_ext == null) {
        alert("Anisotropic filtering isn't supported!");
    }
    console.log(anisotropic_ext);
    //allow the user to rotate mesh with the mouse
    canvas.addEventListener("mousedown", mouse_down);
    canvas.addEventListener("mousemove", mouse_drag);
    canvas.addEventListener("mouseup", mouse_up);
    //black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    program = initFileShaders(gl, "vshader-texture.glsl", "fshader-texture.glsl");
    gl.useProgram(program);
    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");
    umode = gl.getUniformLocation(program, "mode");
    vAmbientDiffuseColor = gl.getUniformLocation(program, "vAmbientDiffuseColor");
    vSpecularColor = gl.getUniformLocation(program, "vSpecularColor");
    vSpecularExponent = gl.getUniformLocation(program, "vSpecularExponent");
    light_position = gl.getUniformLocation(program, "light_position");
    light_color = gl.getUniformLocation(program, "light_color");
    ambient_light = gl.getUniformLocation(program, "ambient_light");
    //note, still just one texture per object, so even though there are
    //multiple textures total, we just need the one texture sampler on the shader side
    uEarthMap = gl.getUniformLocation(program, "earthMap"); //get reference to sampler2D
    uSpecularMap = gl.getUniformLocation(program, "specularMap");
    uNightMap = gl.getUniformLocation(program, "nightMap");
    uNormalMap = gl.getUniformLocation(program, "normalMap");
    //set up basic perspective viewing
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    p = perspective(zoom, (canvas.clientWidth / canvas.clientHeight), 1, 20);
    gl.uniformMatrix4fv(uproj, false, p.flatten());
    //don't forget to load in the texture files to main memory
    initTextures();
    //makeSquareAndBuffer();
    generateSphere(180);
    //initialize rotation angles
    xAngle = 0;
    yAngle = 0;
    gl.uniform1i(umode, 1);
    window.addEventListener("keydown", event => {
        switch (event.key) {
            case "1":
                gl.uniform1i(umode, 1);
                mode = 1;
                console.log(umode);
                break;
            case "2":
                gl.uniform1i(umode, 2);
                mode = 2;
                break;
            case "3":
                gl.uniform1i(umode, 3);
                mode = 3;
                break;
            case "4":
                gl.uniform1i(umode, 4);
                mode = 4;
                break;
            case "ArrowDown":
                if (zoom < 170) {
                    zoom += 5;
                }
                break;
            case "ArrowUp":
                if (zoom > 10) {
                    zoom -= 5;
                }
                break;
            case "l":
                gl.bindTexture(gl.TEXTURE_2D, alpacatex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); //try different min and mag filters
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                console.log("linear");
                break;
            case "n":
                gl.bindTexture(gl.TEXTURE_2D, alpacatex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); //try different min and mag filters
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                break;
            case "a":
                gl.bindTexture(gl.TEXTURE_2D, alpacatex);
                //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                gl.texParameterf(gl.TEXTURE_2D, anisotropic_ext.TEXTURE_MAX_ANISOTROPY_EXT, 16);
                break;
            case "s":
                gl.bindTexture(gl.TEXTURE_2D, alpacatex);
                //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
                gl.texParameterf(gl.TEXTURE_2D, anisotropic_ext.TEXTURE_MAX_ANISOTROPY_EXT, 1);
                break;
        }
        p = perspective(zoom, (canvas.clientWidth / canvas.clientHeight), 1, 20);
        gl.uniformMatrix4fv(uproj, false, p.flatten());
        requestAnimationFrame(render); //and now we need a new frame since we made a change
    });
    //requestAnimationFrame(render);
    window.setInterval(update, 16);
};
function generateSphere(subdiv) {
    let step = (360.0 / subdiv) * (Math.PI / 180.0);
    sphereverts = [];
    for (let lat = 0; lat <= Math.PI; lat += step) { //latitude
        for (let lon = 0; lon + step <= 2 * Math.PI; lon += step) { //longitude
            let u1 = (lon / (2 * Math.PI));
            let u2 = ((lon + step) / (2 * Math.PI));
            let v1 = -(lat / (Math.PI));
            let v2 = -(lat + step) / (Math.PI);
            let tangent1;
            let tangent2;
            tangent1 = new vec4(0, 1, 0, 0).cross(new vec4(Math.sin(lat) * Math.sin(lon), Math.cos(lat), Math.cos(lon) * Math.sin(lat), 0.0));
            tangent2 = new vec4(0, 1, 0, 0).cross(new vec4(Math.sin(lat + step) * Math.sin(lon + step), Math.cos(lat + step), Math.cos(lon + step) * Math.sin(lat + step), 0.0));
            if (tangent1[0] === 0 && tangent1[1] === 0 && tangent1[2] === 0)
                tangent1 = new vec4(1, 0, 0, 0);
            if (tangent2[0] === 0 && tangent2[1] === 0 && tangent2[2] === 0)
                tangent2 = new vec4(1, 0, 0, 0);
            //triangle 1
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
            //triangle 2
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
    let sphereBufferID = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBufferID);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(sphereverts), gl.STATIC_DRAW);
    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 56, 0); //stride is 24 bytes total for position, texcoord
    gl.enableVertexAttribArray(vPosition);
    vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 56, 16); //stride is 24 bytes total for position, texcoord
    gl.enableVertexAttribArray(vNormal);
    vTangent = gl.getAttribLocation(program, "vTangent");
    gl.vertexAttribPointer(vTangent, 4, gl.FLOAT, false, 56, 32); //stride is 24 bytes total for position, texcoord
    gl.enableVertexAttribArray(vTangent);
    vTexCoord = gl.getAttribLocation(program, "texCoord");
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 56, 48); //stride is 24 bytes total for position, texcoord
    gl.enableVertexAttribArray(vTexCoord);
}
//update rotation angles based on mouse movement
//update rotation angles based on mouse movement
function mouse_drag(event) {
    let thetaY, thetaX;
    if (mouse_button_down) {
        thetaY = 360.0 * (event.clientX - prevMouseX) / canvas.clientWidth;
        thetaX = 360.0 * (event.clientY - prevMouseY) / canvas.clientHeight;
        prevMouseX = event.clientX;
        prevMouseY = event.clientY;
        xAngle += thetaX;
        yAngle += thetaY;
    }
    requestAnimationFrame(render);
}
//record that the mouse button is now down
function mouse_down(event) {
    //establish point of reference for dragging mouse in window
    mouse_button_down = true;
    prevMouseX = event.clientX;
    prevMouseY = event.clientY;
    requestAnimationFrame(render);
}
//record that the mouse button is now up, so don't respond to mouse movements
function mouse_up() {
    mouse_button_down = false;
    requestAnimationFrame(render);
}
//TODO uncomment this, but make sure you're comfortable with what's happening
//https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
function initTextures() {
    earthTex = gl.createTexture();
    earthImg = new Image();
    earthImg.onload = function () { handleTextureLoaded(earthImg, earthTex); };
    earthImg.src = 'Earth.png';
    specularTex = gl.createTexture();
    specularImg = new Image();
    specularImg.onload = () => handleTextureLoaded(specularImg, specularTex);
    specularImg.src = "EarthSpec.png"; // your grayscale specular map
    nightTex = gl.createTexture();
    nightImg = new Image();
    nightImg.onload = () => handleTextureLoaded(nightImg, nightTex);
    nightImg.src = "EarthNight.png";
    normalTex = gl.createTexture();
    normalImg = new Image();
    normalImg.onload = () => handleTextureLoaded(normalImg, normalTex);
    normalImg.src = "EarthNormal.png";
}
//TODO There are a bunch of things we need to define for each texture
function handleTextureLoaded(image, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); //disagreement over what direction Y axis goes
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameterf(gl.TEXTURE_2D, anisotropic_ext.TEXTURE_MAX_ANISOTROPY_EXT, 1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    console.log("Loaded:", image.src, "→ texture object:", texture);
}
function update() {
    //alter the rotation angle
    rotateAngle += .5;
    if (rotateAngle >= 360) {
        rotateAngle -= 360;
    }
    requestAnimationFrame(render);
}
//draw a frame
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //position camera 5 units back from origin
    mv = lookAt(new vec4(0, 0, 5, 1), new vec4(0, 0, 0, 1), new vec4(0, 1, 0, 0));
    //rotate if the user has been dragging the mouse around
    let camera = mv = mv.mult(rotateY(yAngle).mult(rotateX(xAngle)).mult(scalem(1.5, 1.5, 1.5)));
    mv = mv.mult(rotateY(rotateAngle));
    //send the modelview matrix over
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    //make sure the appropriate texture is sitting on texture unit 0
    //we could do this once since we only have one texture per object, but eventually you'll have multiple textures
    //so you'll be swapping them in and out for each object
    gl.activeTexture(gl.TEXTURE0); //we're using texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, earthTex); //we want domokun on that texture unit for the next object drawn
    //when the shader runs, the sampler2D will want to know what texture unit the texture is on
    //It's on texture unit 0, so send over the value 0
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
    //note that if we have one value that should be applied to all the vertices,
    //we can send it over just once even if it's an attribute and not a uniform
    gl.uniform4fv(vAmbientDiffuseColor, [1, 1, 1, 1]);
    gl.uniform4fv(vSpecularColor, [1.0, 1.0, 1.0, 1.0]);
    gl.uniform1f(vSpecularExponent, 10.0);
    gl.uniform4fv(light_position, camera.mult(new vec4(10, 10, 10, 1)).flatten());
    gl.uniform4fv(light_color, [.7, .7, .7, 1]);
    gl.uniform4fv(ambient_light, [.1, .1, .1, 1]); //Very high, maybe don't do
    gl.drawArrays(gl.TRIANGLES, 0, sphereverts.length);
    //and now put it back to appropriate values for opaque objects
    //Disable then re-enable
    //gl.disable(gl.BLEND);
    //gl.depthMask(true);
    // if (mode == 4) {
    //     mv = mv.mult(scalem(1.1, 1.1, 1.1));
    //     gl.uniformMatrix4fv(umv, false, mv.flatten());
    //     gl.drawArrays(gl.TRIANGLES, 0, sphereverts.length);
    // }
}
//# sourceMappingURL=loadtexturefunctions.js.map