#version 300 es

/**
 * VERTEX SHADER - Texture Mapping with Normal Mapping Support
 *
 * This shader transforms vertex data from model space to eye (camera) space
 * and prepares vectors needed for lighting calculations in the fragment shader.
 * It supports both standard lighting and normal mapping (bump mapping).
 */

// ===== INPUT ATTRIBUTES (per vertex data) =====
in vec4 vPosition;  // Vertex position in model space (x, y, z, w=1)
in vec4 vNormal;    // Vertex normal vector in model space (perpendicular to surface)
in vec4 vTangent;   // Vertex tangent vector in model space (parallel to surface, needed for normal mapping)
in vec2 texCoord;   // 2D texture coordinates (u, v) for mapping texture onto surface

// ===== OUTPUT TO FRAGMENT SHADER (interpolated across triangle) =====
out vec3 fN;        // Normal vector in eye space
out vec3 fT;        // Tangent vector in eye space (for constructing tangent space in fragment shader)
out vec3 fL;        // Light direction vector in eye space (from vertex to light)
out vec3 fV;        // View direction vector in eye space (from vertex to camera)
out vec2 ftexCoord; // Texture coordinates (passed through unchanged)
out vec4 fPosition; // Vertex position in eye space

// ===== UNIFORMS (constant for all vertices in a draw call) =====
uniform int mode[5];           // Feature toggles: [earth texture, specular map, night map, normal map]
uniform mat4 model_view;       // Model-view matrix (transforms from model space to eye space)
uniform mat4 projection;       // Projection matrix (transforms from eye space to clip space)
uniform vec4 light_position;   // Light position in eye space (already transformed by CPU)

void main()
{
    // ===== TRANSFORM VERTEX POSITION TO EYE SPACE =====
    // Multiply model-view matrix by vertex position to get position relative to camera
    vec4 pos_eye = model_view * vPosition;
    fPosition = pos_eye;  // Pass to fragment shader for per-pixel lighting

    // ===== TRANSFORM NORMAL AND TANGENT TO EYE SPACE =====
    // Transform normal vector from model space to eye space
    // Normalize ensures it remains a unit vector after transformation (scales may have been applied)
    fN = normalize((model_view * vNormal).xyz);

    // Transform tangent vector similarly
    // Tangent is used in fragment shader to construct tangent-space coordinate system for normal mapping
    fT = normalize((model_view * vTangent).xyz);

    // ===== CALCULATE LIGHT DIRECTION =====
    // Light direction points FROM the vertex TO the light source
    // Subtract vertex position from light position, then normalize to get unit vector
    fL = normalize(light_position.xyz - pos_eye.xyz);

    // ===== CALCULATE VIEW DIRECTION =====
    // View direction points FROM the vertex TO the camera
    // Camera is at origin (0,0,0) in eye space, so view direction is -position
    fV = normalize(-pos_eye.xyz);

    // ===== PASS TEXTURE COORDINATES UNCHANGED =====
    // Texture coordinates are 2D (u,v) values that don't need transformation
    ftexCoord = texCoord;

    // ===== FINAL VERTEX POSITION FOR RASTERIZATION =====
    // Transform from eye space to clip space using projection matrix
    // This is the position used by GPU for determining where pixel appears on screen
    gl_Position = projection * pos_eye;
}