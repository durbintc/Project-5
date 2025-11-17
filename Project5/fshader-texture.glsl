#version 300 es
precision mediump float;

// Input from vertex shader (interpolated across triangle)
in vec3 fN;         // Normal in eye space
in vec3 fT;         // Tangent in eye space
in vec3 fL;         // Light direction in eye space
in vec3 fV;         // View direction in eye space
in vec2 ftexCoord;  // Texture coordinates
in vec4 fPosition;  // Position in eye space

// Uniforms
uniform int mode;                    // Rendering mode selector
uniform sampler2D earthMap;          // Earth day texture
uniform sampler2D specularMap;       // Specular map (glossiness)
uniform sampler2D nightMap;          // Earth night lights texture
uniform sampler2D normalMap;          // Normal map (bump map)
uniform vec4 ambient_light;          // Ambient light color/intensity
uniform vec4 light_color;            // Light source color/intensity
uniform vec4 vAmbientDiffuseColor;   // Material ambient/diffuse color
uniform vec4 vSpecularColor;         // Material specular color
uniform float vSpecularExponent;     // Material shininess

// Output
out vec4 fColor;  // Final fragment color

void main()
{
    // Vectors for lighting calculations
    vec3 N, L, V, R;

    if (mode == 4) {
        // ===== NORMAL MAPPING MODE =====

        // Re-normalize tangent and normal vectors after interpolation
        // Interpolation can cause vectors to lose unit length
        vec3 T = normalize(fT);
        vec3 N_vertex = normalize(fN);

        // Compute binormal (bitangent) as cross product of normal and tangent
        // This creates a third basis vector perpendicular to both N and T
        vec3 B = cross(N_vertex, T);

        // Construct a change of coordinate frame matrix (tangent space to eye space)
        // Columns are: Tangent, Binormal, Normal, and homogeneous coordinate
        // This matrix transforms vectors from the surface's local space to eye space
        vec4 v4T = vec4(T, 0.0);
        vec4 v4B = vec4(B, 0.0);
        vec4 v4N = vec4(N_vertex, 0.0);
        vec4 blank = vec4(0.0, 0.0, 0.0, 1.0);

        mat4 cocf = mat4(v4T, v4B, v4N, blank);

        // Sample the normal map texture
        // Normal maps store surface perturbations encoded in RGB color
        vec4 nM = texture(normalMap, ftexCoord);

        // Convert normal from texture space [0,1] to standard range [-1,1]
        // RGB values (0.5, 0.5, 1.0) represent an unperturbed normal
        nM = (nM * 2.0) - 1.0;

        // Transform the normal from tangent space (local surface coordinates)
        // to eye space (camera coordinates) using our change of basis matrix
        vec4 n_eye = cocf * nM;

        // Use the transformed normal for lighting (normalize to ensure unit length)
        N = normalize(n_eye.xyz);
    } else {
        // ===== REGULAR MODE (NO NORMAL MAPPING) =====
        // Use the interpolated vertex normal directly
        N = normalize(fN);
    }

    L = normalize(fL);
    V = normalize(fV);
    R = reflect(-L, N);

    vec4 amb = vAmbientDiffuseColor * ambient_light;
    vec4 diff = max(dot(L, N), 0.0) * vAmbientDiffuseColor * light_color;
    vec4 spec = pow(max(dot(R, V), 0.0), vSpecularExponent) * vSpecularColor * light_color;

    vec4 texColor = vec4(1.0);

    if (mode == 1){
        texColor = texture(earthMap, ftexCoord);
        fColor = texColor * (amb + diff) + spec;
    }
    else if (mode == 2){
        texColor = texture(specularMap, ftexCoord);
        if(texColor != vec4(0.0)){
            fColor = texColor * (amb + diff) + spec;
        }
        else
        {
            fColor = texColor * (amb + diff);
        }
    }
    else if (mode == 3){
        float dotLN = dot(L, N);
        float num = (dotLN + 0.1) * 5.0;

        if (dotLN >= 0.1) {
            texColor = texture(earthMap, ftexCoord);
            fColor = texColor * (amb + diff) + spec;
        }
        else if (dotLN <= -0.1) {
            texColor = texture(nightMap, ftexCoord);
            fColor = texColor;
        }
        else {
            vec4 dayTex = texture(earthMap, ftexCoord) * (amb + diff) + spec;
            vec4 nightTex = texture(nightMap, ftexCoord);
            texColor = (num * dayTex) + ((1.0 - num) * nightTex);
            fColor = texColor;
        }
    }
    else if (mode == 4){
        // Normal mapped Earth
        texColor = texture(earthMap, ftexCoord);
        fColor = texColor * (amb + diff) + spec;
    }

    fColor.a = 1.0;
}