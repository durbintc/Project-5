#version 300 es
precision mediump float;

in vec3 fN;
in vec3 fL;
in vec3 fV;
in vec2 ftexCoord;

uniform int mode;
uniform sampler2D earthMap;
uniform sampler2D specularMap;
uniform sampler2D nightMap;
uniform vec4 ambient_light;
uniform vec4 light_color;
uniform vec4 vAmbientDiffuseColor;
uniform vec4 vSpecularColor;
uniform float vSpecularExponent;

out vec4 fColor;

void main()
{
    vec3 N = normalize(fN);
    vec3 L = normalize(fL);
    vec3 V = normalize(fV);
    vec3 R = reflect(-L, N);

    vec4 amb = vAmbientDiffuseColor * ambient_light;
    vec4 diff = max(dot(L, N), 0.0) * vAmbientDiffuseColor * light_color;
    vec4 spec = pow(max(dot(R, V), 0.0), vSpecularExponent) * vSpecularColor * light_color;

    //if (dot(L, N) < 0.0) spec = vec4(0.0);

    vec4 texColor = vec4(1.0);
    if (mode == 1){
        texColor = texture(earthMap, ftexCoord);
        fColor = texColor * (amb + diff) + spec;
    }
    if (mode == 2){
        texColor = texture(specularMap, ftexCoord);
        fColor = texColor * (amb + diff) + spec;
    }
    if (mode == 3){
        float dotLN = dot(L, N);
        float num = (dotLN + 0.1) * 5.0;  // Use float, not int! Range: 0.0 to 1.0

        if (dotLN >= 0.1) {
            texColor = texture(earthMap, ftexCoord);  // Day side - SWAPPED
            fColor = texColor * (amb + diff) + spec;
        }
        else if (dotLN <= -0.1) {
            texColor = texture(nightMap, ftexCoord);  // Night side - SWAPPED
            fColor = texColor;
        }
        else {  // Blend zone: -0.1 to 0.1
            vec4 dayTex = texture(earthMap, ftexCoord) * (amb + diff) + spec;
            vec4 nightTex = texture(nightMap, ftexCoord);
            texColor = (num * dayTex) + ((1.0 - num) * nightTex);
            fColor = texColor;
        }
    }
    if (mode == 4){
            texColor = texture(earthMap, ftexCoord);
            fColor = texColor * (amb + diff) + spec;
    }

    fColor.a = 1.0;
}

