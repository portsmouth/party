
precision highp float;

uniform float t;
uniform float lifetime;
uniform float dt; // timestep
uniform int NparticlesSqrt;

uniform sampler2D position_sampler; // 0, particle position
uniform sampler2D velocity_sampler; // 1, particle velocity
uniform sampler2D material_sampler; // 2, particle material
uniform sampler2D rng_sampler;      // 3, particle rng seeds
// (User textures start at index 4)

/////// output buffers ///////
layout(location = 0) out vec4 position_output;
layout(location = 1) out vec4 velocity_output;
layout(location = 2) out vec4 material_output;
layout(location = 3) out vec4 rng_output;

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

    vec4 P     = texelFetch(position_sampler, frag, 0);     // current position
    vec3 V     = texelFetch(velocity_sampler, frag, 0).xyz; // current velocity
    vec4 M     = texelFetch(material_sampler, frag, 0);     // current material
    vec4 seed  = texelFetch(rng_sampler, frag, 0);          // current RNG seed

    vec3 X = P.xyz;
    float birth_phase = P.w; // in [0,1]

    // Compute particle age, i.e time elapsed since last re-birth
    float global_phase = mod(t, lifetime) / lifetime; // in [0,1]
    float dphase = global_phase - birth_phase; // current relative phase of particle birth time and global time
    dphase = mod(dphase, 1.0);
    float age = lifetime * dphase;
    float h = min(age, dt);
    if (t==0.0 || age<dt)
    {
        // (re-)emit particle
        int particle_id = frag.x + frag.y*NparticlesSqrt;
        int Nparticles = NparticlesSqrt*NparticlesSqrt;
        EMIT(seed, t, birth_phase, lifetime, particle_id, Nparticles, // inputs
                X, V, M);                                                // emitted position (X), velocity (V), and material (M)
    }

    // update position (X), velocity (V), and material (M)
    UPDATE(X, V, M, t, h);

    position_output.xyz = X;
    position_output.w   = birth_phase;
    velocity_output.xyz = V;
    material_output     = M;
    rng_output      = seed;
}
