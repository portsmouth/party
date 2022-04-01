
///////////////////////////////////////////////////////////////////////
// Renderer
///////////////////////////////////////////////////////////////////////

var Renderer = function()
{
    this.settings = {};
    this.settings.exposure = 0.0;
    this.settings.gamma = 2.2;
    this.settings.saturation = 1.0;
    this.settings.contrast = 1.0;
    this.settings.radius = 1.0;

    // Create a quad VBO for rendering textures
    this.quadVbo = this.createQuadVbo();

    this.pointsVbo = null;
    this.pointsCount = 0;

    // Create FBO for render-to-texture
    this.fbo = new GLU.RenderTarget();

    // Compile shaders
    this.shaderSources = GLU.resolveShaderSource(["render"]);
    this.compileShaders();
}

Renderer.prototype.createQuadVbo = function()
{
    let gl = GLU.gl;
    let vbo = new GLU.VertexBuffer();
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

Renderer.prototype.compileShaders = function()
{
    this.compiled_successfully = false;

    let glsl = party.getShader();
    replacements = {};
    replacements._USER_CODE_ = '\n' + glsl + '\n';

    this.render_program = new GLU.Shader('render', this.shaderSources, replacements);
    if (!this.render_program.program) { this.render_program = null; return; }

    this.compiled_successfully = true;
}

Renderer.prototype.reset = function()
{
    // Clear render buffer
    let gl = GLU.gl;
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.fbo.bind();
    this.fbo.drawBuffers(1);
    this.fbo.attachTexture(this.radianceBuffer, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.fbo.unbind();
}

Renderer.prototype.render = function()
{
    let gl = GLU.gl;
    gl.viewport(0, 0, this.width, this.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);

    let engine = party.getEngine();

    // Render points into radianceBuffer
    {
        this.render_program.bind();

        // Setup projection matrix
        let camera = party.getCamera();
        let projectionMatrix = camera.projectionMatrix.toArray();
        let projectionMatrixLocation = this.render_program.getUniformLocation("u_projectionMatrix");
        gl.uniformMatrix4fv(projectionMatrixLocation, false, projectionMatrix);

        // Setup modelview matrix (to match camera)
        camera.updateMatrixWorld();
        let matrixWorldInverse = new THREE.Matrix4();
        matrixWorldInverse.getInverse( camera.matrixWorld );
        let modelViewMatrix = matrixWorldInverse.toArray();
        let modelViewMatrixLocation = this.render_program.getUniformLocation("u_modelViewMatrix");
        gl.uniformMatrix4fv(modelViewMatrixLocation, false, modelViewMatrix);

        let particle_system = party.getParticleSystem();
        if (typeof particle_system.sync_shader !== "undefined")
            particle_system.sync_shader(party, this.render_program);

        // particle data
        let particle_positions  = engine.get_particle_positions();
        let particle_velocities = engine.get_particle_velocities();
        let particle_materials  = engine.get_particle_materials();
        particle_positions.bind(0);  // read from particle_positions
        particle_velocities.bind(1); // read from particle_velocities
        particle_materials.bind(2);  // read from particle_materials
        this.render_program.uniformTexture("position_sampler", particle_positions);
        this.render_program.uniformTexture("velocity_sampler", particle_velocities);
        this.render_program.uniformTexture("material_sampler", particle_materials);

        // other uniform data
        this.render_program.uniformI("NparticlesSqrt", engine.settings.NparticlesSqrt);
        this.render_program.uniformF("radius", this.settings.radius);
        this.render_program.uniformF("t", engine.time);
        this.render_program.uniformF("lifetime", engine.settings.lifetime);
        this.render_program.uniformF("timestep", engine.settings.timestep);
        this.render_program.uniformF("exposure", this.settings.exposure);
        this.render_program.uniformF("invGamma", 1.0/this.settings.gamma);
        this.render_program.uniformF("saturation", this.settings.saturation);
        this.render_program.uniformF("contrast", this.settings.contrast);

        // Draw the particles!
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.enable(gl.BLEND);
        gl.drawArrays(gl.POINTS, 0, engine.settings.Nparticles);
        gl.disable(gl.BLEND);
    }

    gl.finish();
}


Renderer.prototype.resize = function(width, height)
{
    this.width = width;
    this.height = height;
    this.radianceBuffer = new GLU.Texture(width, height, 4, true, false, true, null);
}

