#version 300 es
in vec4 vPosition;
in vec4 vNormal;
in vec2 texCoord;

out vec3 fN;       // normal in eye space
out vec3 fL;       // light direction in eye space
out vec3 fV;       // view direction in eye space
out vec2 ftexCoord;

uniform int mode;
uniform mat4 model_view;
uniform mat4 projection;
uniform vec4 light_position;

void main()
{
    vec4 pos_eye = model_view * vPosition;
    fN = normalize((model_view * vNormal).xyz);
    fL = normalize(light_position.xyz - pos_eye.xyz);
    fV = normalize(-pos_eye.xyz);

    ftexCoord = texCoord;
    gl_Position = projection * pos_eye;
}
