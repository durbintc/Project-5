#version 300 es
precision mediump float;

// ===== INPUT FROM VERTEX SHADER =====
in vec3 fN;
in vec3 fT;
in vec3 fL;
in vec3 fV;
in vec2 ftexCoord;
in vec4 fPosition;

// ===== UNIFORMS =====
uniform int mode[5];  // [0]=earth day, [1]=specular, [2]=night, [3]=normal map, [4]=cloud mode
uniform sampler2D earthMap;
uniform sampler2D specularMap;
uniform sampler2D nightMap;
uniform sampler2D normalMap;
uniform sampler2D cloudMap;
uniform vec4 ambient_light;
uniform vec4 light_color;
uniform vec4 vAmbientDiffuseColor;
uniform vec4 vSpecularColor;
uniform float vSpecularExponent;

// ===== OUTPUT =====
out vec4 fColor;

void main()
{
    // ===== EARTH RENDERING (original code) =====
    vec3 N, L, V, R;

    // Normal vector computation
    if (mode[3] == 1) {
        // Normal mapping mode
        vec3 T = normalize(fT);
        vec3 N_vertex = normalize(fN);
        vec3 B = cross(N_vertex, T);

        vec4 v4T = vec4(T, 0.0);
        vec4 v4B = vec4(B, 0.0);
        vec4 v4N = vec4(N_vertex, 0.0);
        vec4 blank = vec4(0.0, 0.0, 0.0, 1.0);
        mat4 cocf = mat4(v4T, v4B, v4N, blank);

        vec4 nM = texture(normalMap, ftexCoord);
        nM = (nM * 2.0) - 1.0;

        vec4 n_eye = cocf * nM;
        N = normalize(n_eye.xyz);
    } else {
        N = normalize(fN);
    }

    L = normalize(fL);
    V = normalize(fV);
    R = reflect(-L, N);

    // Phong lighting
    vec4 amb = vAmbientDiffuseColor * ambient_light;
    vec4 diff = max(dot(L, N), 0.0) * vAmbientDiffuseColor * light_color;

    //Sets specular light if the spec map is on
    vec4 spec = vec4(0.0);
    if (mode[1] == 1) {
        spec = pow(max(dot(R, V), 0.0), vSpecularExponent) * vSpecularColor * light_color;
    }

    // Texture sampling
    vec4 texColor = vec4(1.0);
    fColor = vec4(0.0);

    //Sets earth texture when on
    if (mode[0] == 1) {
        texColor = texture(earthMap, ftexCoord);
        fColor = texColor * (amb + diff);
    }
    else if (mode[0] == 0) {
        fColor = amb + diff;
    }

    // Specular map
    if (mode[1] == 1) {
        vec4 specMap = texture(specularMap, ftexCoord);
        fColor += specMap * spec;
    }

    // Night lights
    if (mode[2] == 1) {
        float dotLN = dot(L, N);
        float num = (dotLN + 0.1) * 5.0; //0-1

        if (dotLN >= 0.1) {
            // Fully lit - keep day texture
        }
        else if (dotLN <= -0.1) {
            // Fully dark - night lights
            texColor = texture(nightMap, ftexCoord);
            fColor = texColor;
        }
        else {
            // Twilight blend
            vec4 dayTex = fColor;
            vec4 nightTex = texture(nightMap, ftexCoord);
            fColor = (num * dayTex) + ((1.0 - num) * nightTex);
        }
    }

    // **CLOUD MODE**
    if (mode[4] == 1) {
        vec4 cloudColor = texture(cloudMap, ftexCoord);
        fColor = cloudColor * diff;
        return;
    }

    fColor.a = 1.0;
}