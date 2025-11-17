#version 300 es
precision mediump float;

in vec2 ftexCoord;
uniform sampler2D cloudMap;

out vec4 fColor;

void main()
{
    vec4 cloudColor = texture(cloudMap, ftexCoord);
    fColor = vec4(cloudColor.rgb, cloudColor.a * 0.8);  // Adjust transparency
}