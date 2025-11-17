#version 300 es

// Vertex attributes
in vec4 vPosition;  // Vertex position in model space
in vec4 vNormal;    // Vertex normal in model space
in vec4 vTangent;   // Vertex tangent in model space (parallel to surface)
in vec2 texCoord;   // Texture coordinates

// Output to fragment shader
out vec3 fN;        // Normal in eye space (perpendicular to surface)
out vec3 fT;        // Tangent in eye space (parallel to surface)
out vec3 fL;        // Light direction in eye space
out vec3 fV;        // View direction in eye space
out vec2 ftexCoord; // Texture coordinates
out vec4 fPosition; // Vertex position in eye space

// Uniforms
uniform int mode;           // Rendering mode
uniform mat4 model_view;    // Model-view transformation matrix
uniform mat4 projection;    // Projection matrix
uniform vec4 light_position; // Light position in eye space

void main()
{
    // Transform vertex position to eye space
    vec4 pos_eye = model_view * vPosition;
    fPosition = pos_eye;

    // Transform normal and tangent vectors from model space to eye space
    // Normalize them to ensure they remain unit vectors after transformation
    fN = normalize((model_view * vNormal).xyz);
    fT = normalize((model_view * vTangent).xyz);

    // Calculate light direction (from vertex to light)
    fL = normalize(light_position.xyz - pos_eye.xyz);

    // Calculate view direction (from vertex to camera at origin)
    fV = normalize(-pos_eye.xyz);

    // Pass texture coordinates through unchanged
    ftexCoord = texCoord;

    // Transform vertex to clip space for rasterization
    gl_Position = projection * pos_eye;
}