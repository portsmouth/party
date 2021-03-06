
precision highp float;

uniform sampler2D position_sampler; // 0, particle position
uniform sampler2D velocity_sampler; // 1, particle velocity
uniform sampler2D material_sampler; // 2, particle material
uniform sampler2D rng_sampler;      // 3, particle rng seeds
// (User textures start at index 4)

uniform mat4 u_projectionMatrix;
uniform mat4 u_modelViewMatrix;
uniform int NparticlesSqrt;
uniform float radius;
uniform float t;
uniform float lifetime;
uniform float timestep;

out vec3 pColor; // color, for fragment shader

float rand(inout vec4 rnd)
{
    const vec4 q = vec4(   1225.0,    1585.0,    2457.0,    2098.0);
    const vec4 r = vec4(   1112.0,     367.0,      92.0,     265.0);
    const vec4 a = vec4(   3423.0,    2646.0,    1707.0,    1999.0);
    const vec4 m = vec4(4194287.0, 4194277.0, 4194191.0, 4194167.0);
    vec4 beta = floor(rnd/q);
    vec4 p = a*(rnd - beta*q) - beta*r;
    beta = (1.0 - sign(p))*0.5*m;
    rnd = p + beta;
    return fract(dot(rnd/m, vec4(1.0, -1.0, 1.0, -1.0)));
}

/////////////////////// user-defined code ///////////////////////
_USER_CODE_
/////////////////////// user-defined code ///////////////////////


void main()
{
    // Obtain particle position from position_sampler, generated by engine
    int id = gl_VertexID;
    int N = NparticlesSqrt;
    int row = id % N;
    int col = id / N;
    ivec2 frag = ivec2(row, col);

    vec4 P = texelFetch(position_sampler, frag, 0);
    vec3 V = texelFetch(velocity_sampler, frag, 0).xyz;
    vec4 M = texelFetch(material_sampler, frag, 0);

    vec3 position = P.xyz;
    float birth_phase = P.w; // in [0,1]

    // Compute particle age, i.e time elapsed since birth
    float global_phase = mod(t, lifetime) / lifetime; // in [0,1]
    float dphase = global_phase - birth_phase;
    dphase = mod(dphase, 1.0);
    float age = lifetime * dphase;

    // Compute particle color via user-specified function
    pColor = COLOR(position, V, M, t, age, lifetime, id, N*N);

    gl_Position = u_projectionMatrix * u_modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = radius;
}

