var Shaders = {

'initialize-fragment-shader': `#version 300 es
precision highp float;


/////// output buffers ///////
layout(location = 0) out vec4 position_output;
layout(location = 1) out vec4 velocity_output;
layout(location = 2) out vec4 rng_output;

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x*34.0)+1.0)*x);
}

// From https://github.com/ashima/webgl-noise/blob/master/src/noise2D.glsl
// ("Array and textureless GLSL 2D simplex noise function", Ian McEwan, Ashima Arts)
float snoise(vec2 v)
  {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
  // First corner
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

  // Other corners
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  // Permutations
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
		+ i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

  // Gradients: 41 points uniformly over a line, mapped onto a diamond.
  // The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  // Normalise gradients implicitly by scaling m
  // Approximation of: m *= inversesqrt( a0*a0 + h*h );
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

  // Compute final noise value at P
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Float hashes, from https://www.shadertoy.com/view/4dS3Wd
float hash(float n) { return fract(sin(n) * 1e4); }
float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

// Integer Hash, from https://www.shadertoy.com/view/WttXWX
uint triple32(uint x)
{
    x ^= x >> 17;
    x *= 0xed5ad4bbU;
    x ^= x >> 11;
    x *= 0xac4c1b51U;
    x ^= x >> 15;
    x *= 0x31848babU;
    x ^= x >> 14;
    return x;
}
#define hashi(x)  (float(triple32(x)) / float(0xffffffffU))


void main()
{
    // fragments range over [N, N] space
    uvec2 frag = uvec2(gl_FragCoord.xy);

    // initialize the particle position
    vec3 birth_position = vec3(1.0e6); // dummy offscreen particle coordinate

    // initialize the particle birth phase
    float birth_phase = hashi(frag.x + triple32(frag.y));

    position_output = vec4(birth_position, birth_phase);
    velocity_output = vec4(0.0);

    vec4 seed = vec4(hash(gl_FragCoord.x), hash(gl_FragCoord.y), hash(birth_phase), 1.0);
    rng_output = seed;
}
`,

'initialize-vertex-shader': `#version 300 es
precision highp float;

in vec3 Position;
in vec2 TexCoord;

void main() 
{
    gl_Position = vec4(Position, 1.0);
}
`,

'render-fragment-shader': `#version 300 es
precision highp float;

uniform float exposure;
uniform float invGamma;
uniform float saturation;

in vec3 pColor;
out vec4 outColor;


float tonemapReinhard(float x)
{
  return x / (1.0 + x);
}

float tonemapFilmic(float x)
{
  float X = max(0.0, x - 0.004);
  float result = (X * (6.2 * X + 0.5)) / (X * (6.2 * X + 1.7) + 0.06);
  return pow(result, 2.2);
}

vec3 post(in vec3 C)
{
    // apply gamma correction to convert linear RGB to sRGB
    C = pow(C, vec3(invGamma));

    // deal with out-of-gamut RGB.
    float delta = -min(0.0, min(min(C.r, C.g), C.b));
    C.r += delta;
    C.g += delta;
    C.b += delta;

    // apply tonemapping
    C *= pow(2.0, exposure);
    float R = C.r;
    float G = C.g;
    float B = C.b;
    R = tonemapFilmic(R);
    G = tonemapFilmic(G);
    B = tonemapFilmic(B);

    // apply saturation
    float mean = (R + G + B)/3.0;
    float dR = R - mean;
    float dG = G - mean;
    float dB = B - mean;
    R = mean + sign(dR)*pow(abs(dR), 1.0/saturation);
    G = mean + sign(dG)*pow(abs(dG), 1.0/saturation);
    B = mean + sign(dB)*pow(abs(dB), 1.0/saturation);

    return vec3(R,G,B);
}


void main()
{
    vec2 uv = 2.0*gl_PointCoord-1.0;
    float r = length(uv);
    float alpha = smoothstep(1.0, 0.0, r);
    outColor.rgb = post(pColor) * alpha;
    outColor.a = alpha;
}
`,

'render-vertex-shader': `#version 300 es
precision highp float;

uniform sampler2D position_sampler; // 0, particle position
uniform sampler2D velocity_sampler; // 1, particle velocity
uniform sampler2D rng_sampler;      // 2, particle rng seeds
// (User textures start at index 3)

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

    vec3 position = P.xyz;
    float birth_phase = P.w; // in [0,1]

    // Compute particle age, i.e time elapsed since birth
    float global_phase = mod(t, lifetime)/ lifetime; // in [0,1]
    float dphase = global_phase - birth_phase;
    if (dphase < 0.0) dphase += 1.0; // or, dp += 1.0 - step(0, dp)
    float age = lifetime * dphase;

    // Compute particle color via user-specified function
    pColor = COLOR(position, t, age, lifetime, id, N*N);

    gl_Position = u_projectionMatrix * u_modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = radius;
}
`,

'update-fragment-shader': `#version 300 es
precision highp float;

uniform float t;
uniform float lifetime;
uniform float dt; // timestep
uniform int NparticlesSqrt;

uniform sampler2D position_sampler; // 0, particle position
uniform sampler2D velocity_sampler; // 1, particle velocity
uniform sampler2D rng_sampler;      // 2, particle rng seeds
// (User textures start at index 3)

/////// output buffers ///////
layout(location = 0) out vec4 position_output;
layout(location = 1) out vec4 velocity_output;
layout(location = 2) out vec4 rng_output;

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


/*
    - time is broken into specified emission lifetime
    - there are a fixed total number N of particles
    - each particle is given a random birth "phase" p_birth (in [0,1]) within the lifetime
    - any given time t maps to a global phase p(t) = mod(t, lifetime)/lifetime
    - thus we know at any given time the age of each particle, i.e. lifetime*dp, where dp = (p(t) - p_birth) % 1

        float dp = p - p_birth
        if (dp<0) dp += 1.0; // or, dp += 1.0 - step(0, dp)
        float age = lifetime*dp;

    - time advances in specified timesteps dt, corresponding to phase shift dt/lifetime

    - particle positions are initialized to some dummy value ("offscreen")

    - at the beginning of each timestep, we run emission logic:
            - if particle age < dt, this particle is considered stale and re-emitted in this timestep
            - randomly sample an emission location for this particle and reset its position to that
            - (otherwise, don't alter the particle location)

    - in "continuous emission" mode, this emission process is run every timestep
        (and if the force is time-independent, the system settles into a steady state)

    - in "burst emission" mode, the emission is done only in the first lifetime,
        thereafter the particles just advect and are never re-emitted.
        (equivalent to infinite lifetime)

    - on each timestep, after the emission logic we:
            - advect each particle position in an arbitrary specified (force field),
                in general time-dependent
            - render each particle, where the rendered particle vec3 emission is an arbitrary
                function of particle "id", position, time, and birth time

    - e.g.:  N = 1000000, dt=1/25, lifetime=4  (=> 100 frames per lifetime)
    -        in each timestep, about N/100 = 10000 particles are re-emitted
*/

void main()
{
    ivec2 frag = ivec2(gl_FragCoord.xy);

    vec4 P     = texelFetch(position_sampler, frag, 0);
    vec3 V     = texelFetch(velocity_sampler, frag, 0).xyz;
    vec4 seed  = texelFetch(rng_sampler, frag, 0);
    vec3 X = P.xyz;
    float birth_phase = P.w; // in [0,1]

    // @todo;  not quite right..   does not settle into a smooth steady state

    // Compute particle age, i.e time elapsed since last re-birth
    float global_phase = mod(t, lifetime) / lifetime; // in [0,1]
    float dphase = global_phase - birth_phase; // current relative phase of particle birth time and global time
    bool born = (t>lifetime) || (dphase>0.0);
    if (born)
    {
        dphase = mod(dphase, 1.0);
        float age = lifetime * dphase;
        float h = dt;
        if (age < dt)
        {
            // re-emit particle
            int particle_id = frag.x + frag.y*NparticlesSqrt;
            EMIT(seed, particle_id, NparticlesSqrt*NparticlesSqrt, X, V);
            h = age;
        }
        UPDATE(X, V, h);
    }

    position_output.xyz = X;
    position_output.w   = birth_phase;
    velocity_output.xyz = V;
    rng_output      = seed;
}
`,

'update-vertex-shader': `#version 300 es
precision highp float;

in vec3 Position;
in vec2 TexCoord;

void main() 
{
    gl_Position = vec4(Position, 1.0);
}
`,

}