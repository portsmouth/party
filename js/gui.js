
/** @constructor 
* Interface to the dat.GUI UI.
*/
var GUI = function(visible = true) 
{
    // Create dat gui
    this.gui = new dat.GUI();
    this.gui.domElement.id = 'gui';
    var gui = this.gui;
    this.visible = visible;
	
    this.createUserSettings();
    this.createEngineSettings();
    this.createRendererSettings();
    if (!visible)
        this.gui.__proto__.constructor.toggleHide();
}

function updateDisplay(gui) 
{
    for (var i in gui.__controllers) {
        gui.__controllers[i].updateDisplay();
    }
    for (var f in gui.__folders) {
        updateDisplay(gui.__folders[f]);
    }
}

/**
* Call to explicitly force the GUI to synchronize with the
* current parameter values, if they have been changed programmatically.
*/
GUI.prototype.sync = function()
{
	updateDisplay(this.gui);
}

GUI.prototype.toggleHide = function()
{
	this.visible = !this.visible;
}

function hexToRgb(hex) 
{
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

GUI.prototype.createUserSettings = function()
{
    let particle_system = party.getParticleSystem();
    if (typeof particle_system.init_gui !== "undefined") 
    {
        this.userFolder = this.gui.addFolder('User settings');
        particle_system.init_gui(this);
        this.userFolder.open();
    }
}

GUI.prototype.createEngineSettings = function()
{
    this.engineFolder = this.gui.addFolder('Engine');
    let engine = party.getEngine();
    this.engineFolder.add(engine.settings, 'NparticlesSqrt', 1.0, 10000.0).onChange(function(v) { engine.resize(Math.floor(v)); });
    this.engineFolder.add(engine.settings, 'timestep', 0.0, 1.0).onChange(function() { engine.restart(); } );
    this.engineFolder.add(engine.settings, 'lifetime', 0.0, 100.0).onChange(function() { engine.restart(); } );
    this.engineFolder.add(engine.settings, 'max_timesteps', 10, 10000).onChange(function(v) { engine.settings.max_timesteps = Math.floor(v); engine.restart(); } );
    this.engineFolder.open();
}

GUI.prototype.createRendererSettings = function()
{
    this.rendererFolder = this.gui.addFolder('Raytracer');
    let renderer = party.getRenderer();
    this.rendererFolder.add(renderer.settings, 'exposure', -10.0, 10.0).onChange(     function() { party.render_dirty(); });
    this.rendererFolder.add(renderer.settings, 'gamma', 0.0, 10.0).onChange(           function() { party.render_dirty(); });
    this.rendererFolder.add(renderer.settings, 'saturation', 0.0, 3.0).onChange(      function() { party.render_dirty(); });
    this.rendererFolder.add(renderer.settings, 'radius', 0.0, 100.0).onChange(     function() { party.render_dirty(); });
    this.rendererFolder.open();
}





/**
 * Add a dat.GUI UI slider to control a float parameter.
 * The scene parameters need to be organized into an Object as
 * key-value pairs, for supply to this function.
 * @param {Object} parameters - the parameters object for the scene, with a key-value pair (where value is number) for the float parameter name
 * @param {Object} param - the slider range for this parameter, in the form `{name: 'foo', min: 0.0, max: 100.0, step: 1.0, recompile: true}` (step is optional, recompile is optional [default is false])
 * @param {Object} folder - optionally, pass the dat.GUI folder to add the parameter to (defaults to the main scene folder)
 * @returns {Object} the created dat.GUI slider item
 * @example
 *		Scene.prototype.initGui = function(gui)
 *		{
 *			gui.addSlider(this.parameters, c);
 *			gui.addSlider(this.parameters, {name: 'foo2', min: 0.0, max: 1.0});
 *			gui.addSlider(this.parameters, {name: 'bar', min: 0.0, max: 3.0, recompile: true});
 *		}
 */
GUI.prototype.addSlider = function(parameters, param, folder=undefined)
{
	let _f = this.userFolder;
	if (typeof folder !== 'undefined') _f = folder;
	var name = param.name;
	var min  = param.min;
	var max  = param.max;
	var step = param.step;
	var recompile = param.recompile;
	var no_recompile = true;
	if (!(recompile==null || recompile==undefined)) no_recompile = !recompile;
	var item;
	if (step==null || step==undefined) { item = _f.add(parameters, name, min, max, step); }
	else                               { item = _f.add(parameters, name, min, max);       }
	item.onChange( function(value) { party.reset(); party.camera.enabled = false; } );
	item.onFinishChange( function(value) { party.camera.enabled = true; } );
	return item;
}

/** 
 * Add a dat.GUI UI color picker to control a 3-element array parameter (where the RGB color channels are mapped into [0,1] float range)
 * @param {Object} parameters - the parameters object for the scene, with a key-value pair (where value is a 3-element array) for the color parameter name
 * @param {Object} name - the color parameter name
 * @param {Object} folder - optionally, pass a scale factor to apply to the RGB color components to calculate the result (defaults to 1.0)
 * @param {Object} folder - optionally, pass the dat.GUI folder to add the parameter to (defaults to the main scene folder)
 * @returns {Object} the created dat.GUI color picker item
*/
GUI.prototype.addColor = function(parameters, name, scale=1.0, folder=undefined)
{
	let _f = this.userFolder;
	if (typeof folder !== 'undefined') _f = folder;
	_f[name] = [parameters[name][0]*255.0, parameters[name][1]*255.0, parameters[name][2]*255.0];
	var item = _f.addColor(_f, name);
	item.onChange( function(color) {
								if (typeof color==='string' || color instanceof String)
								{
									var C = hexToRgb(color);
									parameters[name][0] = scale * C.r / 255.0;
									parameters[name][1] = scale * C.g / 255.0;
									parameters[name][2] = scale * C.b / 255.0;
								}
								else
								{
									parameters[name][0] = scale * color[0] / 255.0;
									parameters[name][1] = scale * color[1] / 255.0;
									parameters[name][2] = scale * color[2] / 255.0;
								}
								party.reset();
							} );
	return item;
}

// (deprecated)
GUI.prototype.addParameter = function(parameters, param)
{
	this.addSlider(parameters, param);
}

/**
* Access to internal dat.GUI object
* @returns {dat.GUI}
*/
GUI.prototype.getGUI = function()
{
	return this.gui;
}

/**
* Access to dat.GUI object folder object containing user UI parameters
* @returns {dat.GUI}
*/
GUI.prototype.getUserFolder = function()
{
	return this.userFolder;
}



