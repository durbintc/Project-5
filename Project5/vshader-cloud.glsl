#version 300 es
in vec4 vPosition;
in vec2 texCoord;

out vec2 ftexCoord;

uniform mat4 model_view;
uniform mat4 projection;

void main()
{
    vec4 pos_eye = model_view * vPosition;

    ftexCoord = texCoord;
    gl_Position = projection * pos_eye;
}
