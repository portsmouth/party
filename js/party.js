

var party;

var Party = function(particle_system)
{
    party = this;
    this.particle_system = particle_system;

    let container = document.getElementById("container");
    this.container = container;

    var render_canvas = document.getElementById('render-canvas');
    this.render_canvas = render_canvas;
    this.width = render_canvas.width;
    this.height = render_canvas.height;
    render_canvas.style.width = render_canvas.width;
    render_canvas.style.height = render_canvas.height;

    var text_canvas = document.getElementById('text-canvas');
    this.text_canvas = text_canvas;
    this.textCtx = text_canvas.getContext("2d");

    window.addEventListener( 'resize', this, false );

    // Setup THREE.js orbit camera
    var VIEW_ANGLE = 45;
    var ASPECT = this.width / this.height;
    var NEAR = 1.0e-2;
    var FAR = 1.0e4;
    this.camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
    this.camera.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));
    this.camera.position.set(1.0, 1.0, 1.0);

    this.camControls = new THREE.OrbitControls(this.camera, this.container);
    this.camControls.zoomSpeed = 2.0;
    this.camControls.flySpeed = 0.01;
    this.camControls.addEventListener('change', this.camChanged);
    this.camControls.keyPanSpeed = 100.0;

    this.gui = null;
    this.guiVisible = true;

    // Instantiate engine
    this.engine = new Engine();

    // Instantiate renderer
    this.renderer = new Renderer();

    // Init particle system
    if (this.particle_system == null) GLU.fail('null particle system object supplied to Party');
    if (typeof this.particle_system.init !== "undefined")
        this.particle_system.init(this);

    // Do initial resize:
    this.resize();

    // Create dat gui
    this.gui = new GUI(this.guiVisible);

    // Setup keypress and mouse events
    window.addEventListener( 'mousemove', this, false );
    window.addEventListener( 'mousedown', this, false );
    window.addEventListener( 'mouseup',   this, false );
    window.addEventListener( 'contextmenu',   this, false );
    window.addEventListener( 'click', this, false );
    window.addEventListener( 'keydown', this, false );

    this.initialized = true;
}

Party.prototype.camChanged = function()
{

}

Party.prototype.getVersion = function()
{
	return [1, 0, 0];
}

Party.prototype.handleEvent = function(event)
{
    switch (event.type)
    {
        case 'resize':      this.resize();  break;
        case 'mousemove':   this.onDocumentMouseMove(event);  break;
        case 'mousedown':   this.onDocumentMouseDown(event);  break;
        case 'mouseup':     this.onDocumentMouseUp(event);    break;
        case 'contextmenu': this.onDocumentRightClick(event); break;
        case 'click':       this.onClick(event);  break;
        case 'keydown':     this.onkeydown(event);  break;
    }
}

Party.prototype.getRenderer = function()
{
	return this.renderer;
}

Party.prototype.getEngine = function()
{
	return this.engine;
}

Party.prototype.getGUI = function()
{
    return this.gui;
}

Party.prototype.getCamera = function()
{
    return this.camera;
}

Party.prototype.getControls = function()
{
	return this.camControls;
}

Party.prototype.getGLContext = function()
{
	return GLU.gl;
}

Party.prototype.getShader = function()
{
    if (typeof this.particle_system.shader == "undefined") GLU.fail('Particle system must define a "shader" function');
    return this.particle_system.shader();
}

Party.prototype.showGUI = function(show)
{
	this.guiVisible = show;
}

Party.prototype.emitter_program = function()
{
    return this.particle_system.emitter_program();
}

Party.prototype.force_program = function()
{
    return this.particle_system.force_program();
}

Party.prototype.getParticleSystem = function()
{
	return this.particle_system;
}

Party.prototype.render_dirty = function()
{
    this.renderer.reset();
}

Party.prototype.pauseEngineToggle = function()
{
    this.engine.pauseToggle();
}

Party.prototype.restartEngine = function()
{
    this.engine.restart();
}

// Timestep the simulation
Party.prototype.step = function()
{
    // Issue pre-frame callback
    if (typeof this.particle_system.preframe_callback != "undefined")
    {
        this.particle_system.preframe_callback(this);
    }

    // Run a simulation timestep
    if (!this.paused)
    {
        this.engine.step();
        this.render_dirty();
    }

    this.renderer.render();

    this.update_hud();

    // Issue post-frame callback
    if (typeof this.particle_system.postframe_callback != "undefined")
    {
        this.particle_system.postframe_callback(this);
    }
}

Party.prototype.update_hud = function()
{
    // Update HUD text canvas
    if (this.textCtx)
    {
        this.textCtx.textAlign = "left";   	// This determines the alignment of text, e.g. left, center, right
        this.textCtx.textBaseline = "middle";	// This determines the baseline of the text, e.g. top, middle, bottom
        this.textCtx.font = '12px monospace';	// This determines the size of the text and the font family used
        this.textCtx.clearRect(0, 0, this.textCtx.canvas.width, this.textCtx.canvas.height);
        this.textCtx.globalAlpha = 0.95;
        this.textCtx.strokeStyle = 'black';
        this.textCtx.lineWidth  = 2;
        if (this.getGUI().visible)
        {
            if (this.onTrinityLink) this.textCtx.fillStyle = "#ff5500";
            else                    this.textCtx.fillStyle = "#ffff00";
            let ver = this.getVersion();
            let linkWidth = this.textCtx.measureText('Party vX.X.X').width;
            let trinity_version_str = 'Party v'+ver[0]+'.'+ver[1]+'.'+ver[2];
            this.textCtx.strokeText(trinity_version_str, this.textCtx.canvas.width - linkWidth - 14, this.textCtx.canvas.height-20);
            this.textCtx.fillText(  trinity_version_str, this.textCtx.canvas.width - linkWidth - 14, this.textCtx.canvas.height-20);
            {
                // status text
                this.textCtx.fillStyle = "#ffaa22";
                {
                    let spp           = this.renderer.spp;
                    let max_spp       = this.renderer.settings.max_spp;
                    let timestep      = this.engine.frame;
                    let max_timesteps = this.engine.settings.max_timesteps;
                    let time          = Number(this.engine.time.toPrecision(3));
                    let status_txt = 'timestep ' + timestep + '/' + max_timesteps + ", time " + time;
                    this.textCtx.strokeText(status_txt, 14, this.textCtx.canvas.height-25);
                    this.textCtx.fillText(  status_txt, 14, this.textCtx.canvas.height-25);
                }

                // status text
                this.textCtx.fillStyle = "#ccaaff";
                {
                    let help_txt = '[SPC to pause/play, ESC to restart]';
                    this.textCtx.strokeText(help_txt, 14, this.textCtx.canvas.height-42);
                    this.textCtx.fillText(  help_txt, 14, this.textCtx.canvas.height-42);
                }
            }
        }
    }
}

Party.prototype.getUserTextureUnitStart = function()
{
    return 4;
}


Party.prototype.reset = function()
{
    this.renderer.reset();
}

Party.prototype.resize = function()
{
    let width = window.innerWidth;
    let height = window.innerHeight;
    this.width = width;
    this.height = height;

    let render_canvas = this.render_canvas;
    render_canvas.width  = width;
    render_canvas.height = height;
    render_canvas.style.width = width;
    render_canvas.style.height = height;

    var text_canvas = this.text_canvas;
    text_canvas.width  = width;
    text_canvas.height = height

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.camControls.update();

    this.renderer.resize(width, height);
    this.render_dirty();
}

Party.prototype.dumpScene = function()
{
    console.warn('[party] Party.prototype.dumpScene');

    let engine   = party.getEngine();
    let renderer = party.getRenderer();
    let camera   = party.getCamera();
    let controls = party.getControls();

    var code = `
{
    /******* copy-pasted console output on 'O', begin *******/\n`;
    code += `
    let engine   = party.getEngine();
    let renderer = party.getRenderer();
    let camera   = party.getCamera();
    let controls = party.getControls();
`;

    if (typeof this.particle_system.initGenerator !== "undefined")
    {
        code += this.particle_system.initGenerator();
    }

    code += this.guiVisible ? `
    party.showGUI(true);\n` : `\nparty.showGUI(false);\n`;

    code += `
    /** Camera settings **/
    camera.fov = ${camera.fov};
    camera.up.set(${camera.up.x}, ${camera.up.y}, ${camera.up.z});
    camera.position.set(${camera.position.x}, ${camera.position.y}, ${camera.position.z});
    controls.target.set(${controls.target.x}, ${controls.target.y}, ${controls.target.z});

    /** Engine settings **/
    let NparticlesSqrt = ${engine.settings.NparticlesSqrt}; engine.resize(NparticlesSqrt);
    engine.settings.timestep = ${engine.settings.timestep};
    engine.settings.lifetime = ${engine.settings.lifetime};
    engine.settings.max_timesteps = ${engine.settings.max_timesteps};

    /** Renderer settings **/
    renderer.settings.exposure = ${renderer.settings.exposure};
    renderer.settings.gamma = ${renderer.settings.gamma};
    renderer.settings.saturation = ${renderer.settings.saturation};
    renderer.settings.radius = ${renderer.settings.radius};
`;

    code += `
    /******* copy-pasted console output on 'O', end *******/
}`;
    return code;
}


Party.prototype.onClick = function(event)
{
    event.preventDefault();
}

Party.prototype.onDocumentMouseMove = function(event)
{
    this.camControls.update();
}

Party.prototype.onDocumentMouseDown = function(event)
{
    this.camControls.update();
}

Party.prototype.onDocumentMouseUp = function(event)
{
    this.camControls.update();
}

Party.prototype.onDocumentRightClick = function(event)
{

}

Party.prototype.onkeydown = function(event)
{
    var charCode = (event.which) ? event.which : event.keyCode;
    switch (charCode)
    {
        case 122: // F11 key: go fullscreen
            var element	= document.body;
            if      ( 'webkitCancelFullScreen' in document ) element.webkitRequestFullScreen();
            else if ( 'mozCancelFullScreen'    in document ) element.mozRequestFullScreen();
            else console.assert(false);
            break;

        case 72: // H key: toggle hide/show dat gui
            this.guiVisible = !this.guiVisible;
            Party.getGUI().toggleHide();
            break;

        case 65: // A key: cam left
        {
            if (!this.camControls.enabled) break;
            let toTarget = new THREE.Vector3();
            toTarget.copy(this.camControls.target);
            toTarget.sub(this.camera.position);
            let distToTarget = toTarget.length();
            var localX = new THREE.Vector3(1.0, 0.0, 0.0);
            var worldX = localX.transformDirection( this.camera.matrix );
            var move = new THREE.Vector3();
            move.copy(worldX);
            move.multiplyScalar(-this.camControls.flySpeed*distToTarget);
            this.camera.position.add(move);
            this.camControls.target.add(move);
            this.reset(true);
            break;
        }

        case 87: // W key: cam forward
        {
            if (!this.camControls.enabled) break;
            let toTarget = new THREE.Vector3();
            toTarget.copy(this.camControls.target);
            toTarget.sub(this.camera.position);
            let distToTarget = toTarget.length();
            toTarget.normalize();
            var move = new THREE.Vector3();
            move.copy(toTarget);
            move.multiplyScalar(this.camControls.flySpeed*distToTarget);
            this.camera.position.add(move);
            this.camControls.target.add(move);
            this.reset(true);
            break;
        }

        case 83: // S key: cam back
        {
            if (!this.camControls.enabled) break;
            let toTarget = new THREE.Vector3();
            toTarget.copy(this.camControls.target);
            toTarget.sub(this.camera.position);
            let distToTarget = toTarget.length();
            toTarget.normalize();
            var move = new THREE.Vector3();
            move.copy(toTarget);
            move.multiplyScalar(-this.camControls.flySpeed*distToTarget);
            this.camera.position.add(move);
            this.camControls.target.add(move);
            this.reset(true);
            break;
        }

        case 68: // D key: cam right
        {
            if (!this.camControls.enabled) break;
            let toTarget = new THREE.Vector3();
            toTarget.copy(this.camControls.target);
            toTarget.sub(this.camera.position);
            let distToTarget = toTarget.length();
            var localX = new THREE.Vector3(1.0, 0.0, 0.0);
            var worldX = localX.transformDirection( this.camera.matrix );
            var move = new THREE.Vector3();
            move.copy(worldX);
            move.multiplyScalar(this.camControls.flySpeed*distToTarget);
            this.camera.position.add(move);
            this.camControls.target.add(move);
            this.reset(true);
            break;
        }

        case 79: // O key: output scene settings code to console
            let code = this.dumpScene();
            console.log(code);
            break;

        case 32: // space bar: pause toggle
            if (!this.camControls.enabled) break;
            this.pauseEngineToggle();
            break;

        case 27: // escape key: restart sim from t=0
            this.restartEngine();
            break;

    }
}


Party.prototype.gif_init = function(gif_name, gif_frame_ms)
{
    let blob = new Blob([gifworker_code]);
    let blobURL = window.URL.createObjectURL(blob);

    this.gif_frame_ms = gif_frame_ms;

    if (this.GIF)
    {
        delete this.GIF;
        this.GIF = null;
    }

    this.GIF = new GIF({
        repeat: 0,
        workers: 20,
        workerScript: blobURL,
        quality: 30,
        width:  Math.floor(this.width),
        height: Math.floor(this.height)
    });

    let engine = this.getEngine();

    this.GIF.on('finished', function(blob) {
            console.log("gif rendering done.");
            var link = document.createElement('a');
            link.download = gif_name;
            link.href = URL.createObjectURL(blob);
            var event = new MouseEvent('click');
            link.dispatchEvent(event);
            document.body.removeChild(link);
            delete this.GIF;
            this.GIF = null;
            engine.play();
    });
}

Party.prototype.gif_add_frame = function()
{
    let gl = this.getGLContext();
    let webglCanvas = GLU.canvas;
    var offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = webglCanvas.width;
    offscreenCanvas.height = webglCanvas.height;
    var ctx = offscreenCanvas.getContext("2d");
    ctx.drawImage(webglCanvas,0,0);
    this.GIF.addFrame(ctx, {delay: 30, copy: true});
}

Party.prototype.gif_render = function()
{
    console.log("rendering gif...");
    this.GIF.render();
}







