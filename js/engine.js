
///////////////////////////////////////////////////////////////////////
// Engine
///////////////////////////////////////////////////////////////////////

var Engine = function()
{
    this.settings = {};
    this.settings.NparticlesSqrt = 100;
    this.settings.timestep = 1.0/24.0;
    this.settings.lifetime = 5.0;
    this.settings.max_timesteps = 1000;

    let gl = GLU.gl;
    let MAX_TEX_WIDTH = gl.getParameter(gl.MAX_TEXTURE_SIZE); // maximum texture width available in WebGL2
    //if (this.NparticlesSqrt > MAX_TEX_WIDTH)
    //{
        // @todo: blah
    //}

    // Create a quad VBO for rendering textures
    this.quadVbo = this.createQuadVbo();

    // Create FBO for render-to-texture
    this.fbo = new GLU.RenderTarget();

    // Compile shaders
    this.shaderSources = GLU.resolveShaderSource(["initialize", "update"]);
    this.compileShaders();

    this.resize(this.settings.NparticlesSqrt);
    this.restart();

    this.paused = false;
}



Engine.prototype.alloc_texture_pair = function(width, height, channels, isFloat, isLinear, isClamped, texels)
{
    return [ new GLU.Texture(width, height, channels, isFloat, isLinear, isClamped, texels),
             new GLU.Texture(width, height, channels, isFloat, isLinear, isClamped, texels) ];
}

Engine.prototype.compileShaders = function()
{
    this.compiled_successfully = false;

    let glsl = party.getShader();
    replacements = {};
    replacements._USER_CODE_ = '\n' + glsl + '\n';

    this.initialize_program = new GLU.Shader('initialize', this.shaderSources, null);
    if (!this.initialize_program.program) { this.initialize_program = null; return; }

    this.update_program = new GLU.Shader('update', this.shaderSources, replacements);
    if (!this.update_program.program) { this.update_program = null;  return; }

    this.compiled_successfully = true;
}


Engine.prototype.resize = function(NparticlesSqrt)
{
    NparticlesSqrt = Math.round(NparticlesSqrt);
    let MAX_PARTICLE_SQRT = 10000;
    if (NparticlesSqrt > MAX_PARTICLE_SQRT)
        NparticlesSqrt = MAX_PARTICLE_SQRT;
    this.settings.NparticlesSqrt = NparticlesSqrt;
    this.settings.Nparticles     = NparticlesSqrt * NparticlesSqrt;
    this.particle_positions  = this.alloc_texture_pair(NparticlesSqrt, NparticlesSqrt, 4, true, false, true, null);
    this.particle_velocities = this.alloc_texture_pair(NparticlesSqrt, NparticlesSqrt, 4, true, false, true, null);
    this.particle_rngs       = this.alloc_texture_pair(NparticlesSqrt, NparticlesSqrt, 4, true, false, true, null);
    this.restart();
}


Engine.prototype.createQuadVbo = function()
{
	let gl = GLU.gl;
    var vbo = new GLU.VertexBuffer();
    vbo.addAttribute("Position", 3, gl.FLOAT, false);
    vbo.addAttribute("TexCoord", 2, gl.FLOAT, false);
    vbo.init(4);
    vbo.copy(new Float32Array([
         1.0,  1.0, 0.0, 1.0, 1.0,
        -1.0,  1.0, 0.0, 0.0, 1.0,
        -1.0, -1.0, 0.0, 0.0, 0.0,
         1.0, -1.0, 0.0, 1.0, 0.0
    ]));
    return vbo;
}

Engine.prototype.restart = function()
{
    this.frame = 0;
    this.time = 0.0;
}

Engine.prototype.get_frame = function()
{
    return this.frame;
}

Engine.prototype.get_timestep = function()
{
    return this.settings.timestep;
}

Engine.prototype.pauseToggle = function()
{
    this.paused = !this.paused;
}

Engine.prototype.pause = function()
{
    this.paused = true;
}

Engine.prototype.play = function()
{
    this.paused = false;
}

Engine.prototype.step = function()
{
    if (!this.compiled_successfully)
        return;
    if (this.paused)
        return;
    if (this.frame >= this.settings.max_timesteps)
        this.restart();

    let particle_system = party.getParticleSystem();

    let gl = GLU.gl;
    gl.viewport(0, 0, this.settings.NparticlesSqrt, this.settings.NparticlesSqrt);
    this.quadVbo.bind();

    let BUFFER_0 = this.frame % 2; // ping-pong the index 0 buffer for v, P
    let BUFFER_1 = 1 - BUFFER_0;   // ping-pong the index 1 buffer for v, P

    // Initialize on first frame of simulation
    if (this.frame==0)
    {
        this.initialize_program.bind();
        this.fbo.bind();
        this.fbo.drawBuffers(3);
        this.fbo.attachTexture(this.particle_positions[BUFFER_0],  0); // write to particle_positions[BUFFER_0]
        this.fbo.attachTexture(this.particle_velocities[BUFFER_0], 1); // write to particle_velocities[BUFFER_0]
        this.fbo.attachTexture(this.particle_rngs[BUFFER_0],       2); // write to particle_rngs[BUFFER_0]
        this.quadVbo.draw(this.initialize_program, gl.TRIANGLE_FAN);
        this.fbo.detachTexture(0);
        this.fbo.detachTexture(1);
        this.fbo.detachTexture(2);
        this.fbo.unbind();
    }

    // Run per-timestep simulation update
    {
        this.update_program.bind();
        this.update_program.uniformF("t", this.time);
        this.update_program.uniformF("lifetime", this.settings.lifetime);
        this.update_program.uniformF("dt", this.settings.timestep);
        this.update_program.uniformI("NparticlesSqrt", this.settings.NparticlesSqrt);
        if (typeof particle_system.sync_shader !== "undefined")
            particle_system.sync_shader(party, this.update_program);

        this.fbo.bind();
        this.fbo.drawBuffers(3);
        this.fbo.attachTexture(this.particle_positions[BUFFER_1],  0); // write to particle_positions[BUFFER_1]
        this.fbo.attachTexture(this.particle_velocities[BUFFER_1], 1); // write to particle_velocities[BUFFER_1]
        this.fbo.attachTexture(this.particle_rngs[BUFFER_1],       2); // write to particle_rngs[BUFFER_1]
        this.particle_positions[BUFFER_0].bind(0);                     // read from particle_positions[BUFFER_0]
        this.particle_velocities[BUFFER_0].bind(1);                    // read from particle_velocities[BUFFER_0]
        this.particle_rngs[BUFFER_0].bind(2);                          // read from particle_rngs[BUFFER_0]
        this.update_program.uniformTexture("position_sampler", this.particle_positions[BUFFER_0]);
        this.update_program.uniformTexture("velocity_sampler", this.particle_velocities[BUFFER_0]);
        this.update_program.uniformTexture("rng_sampler",      this.particle_rngs[BUFFER_0]);
        this.quadVbo.draw(this.update_program, gl.TRIANGLE_FAN);
        this.fbo.detachTexture(0);
        this.fbo.detachTexture(1);
        this.fbo.detachTexture(2);
        this.fbo.unbind();
    }

    gl.bindTexture(gl.TEXTURE_2D, null);

    this.frame++;
    this.time += this.settings.timestep;
}


Engine.prototype.get_particle_positions = function()
{
	return this.particle_positions[0];
}

