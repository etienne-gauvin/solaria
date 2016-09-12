const colors = require('./colors')
const Chance = require('chance')
const game = {}
 
/**
 * Création de la scène
 */
game.createScene = function () {
	
	// Get the width and the height of the screen,
	// use them to set up the aspect ratio of the camera 
	// and the size of the renderer.
	this.height = window.innerHeight
	this.width = window.innerWidth

	// Loader
	this.loader = new THREE.JSONLoader()

	// Create the scene
	this.scene = new THREE.Scene()
	
	// Random
	this.chance = new Chance('4536453')
	
	// Add a fog effect to the scene same color as the
	// background color used in the style sheet
	// this.scene.fog = new THREE.Fog(new THREE.Color("#5DBDE5"), 150, 300)
	
	// Create the renderer
	this.renderer = new THREE.WebGLRenderer({ 
		// Allow transparency to show the gradient background
		// we defined in the CSS
		alpha: true, 

		// Activate the anti-aliasing this is less performant,
		// but, as our project is low-poly based, it should be fine :)
		antialias: true 
	})

	// Define the size of the renderer in this case,
	// it will fill the entire screen
	this.renderer.setSize(this.width, this.height)
	
	// Enable shadow rendering
	this.renderer.shadowMap.enabled = true
	
	// Add the DOM element of the renderer to the 
	// container we created in the HTML
	let container = document.querySelector('main')
	container.appendChild(this.renderer.domElement)
	
	// Listen to the screen: if the user resizes it
	// we have to update the camera and the renderer size
	window.addEventListener('resize', () => {
		
		this.height = window.innerHeight
		this.width = window.innerWidth
		
		this.renderer.setSize(this.width, this.height)
		
		this.camera.aspect = this.width / this.height
		this.camera.updateProjectionMatrix()
		
	}, false)
	
}

/**
 * Création des lumières
 */
game.createLights = function () {
	
	// A hemisphere light is a gradient colored light; 
	// the first parameter is the sky color, the second parameter is the ground color, 
	// the third parameter is the intensity of the light
	let hemisphereLight = new THREE.HemisphereLight(
		new THREE.Color("#FFFFFF"),
		new THREE.Color("#E6E6E6"),
		1
	)
	
	
	// A directional light shines from a specific direction. 
	// It acts like the sun, that means that all the rays produced are parallel. 
	let shadowLight = new THREE.DirectionalLight(0xffffff, 1)

	// Set the direction of the light  
	shadowLight.position.set(150, 350, 350)
	
	// Allow shadow casting 
	shadowLight.castShadow = true

	// define the visible area of the projected shadow
	shadowLight.shadow.camera.left = -400
	shadowLight.shadow.camera.right = 400
	shadowLight.shadow.camera.top = 400
	shadowLight.shadow.camera.bottom = -400
	shadowLight.shadow.camera.near = 1
	shadowLight.shadow.camera.far = 1000

	// define the resolution of the shadow; the higher the better, 
	// but also the more expensive and less performant
	shadowLight.shadow.mapSize.width = 2048
	shadowLight.shadow.mapSize.height = 2048
	
	// to activate the lights, just add them to the scene
	this.scene.add(shadowLight)
	
	this.scene.add(hemisphereLight)
}

/**
 * Création du sol
 */
game.createObjects = function () {
	
	const Planet = require('./planet.js')
	const Player = require('./player.js')
	const PlayerCamera = require('./player-camera.js')
	
	this.planet = new Planet
	this.player = new Player
	
	// Create the camera
	this.camera = new PlayerCamera
	
}

game.line = function (a, b, color, dashed = false) {
	
	color = new THREE.Color(color || `hsl(${this.chance.integer({min: 0, max: 360})}, 100%, 50%)`)
	
	let material
	
	if (dashed) {
		material = THREE.LineDashedMaterial({
			color: color,
			dashSize: 2,
			gapSize: 3
		})
	}
	
	else {
		material = new THREE.LineBasicMaterial({
			color: color
		})
	}
	
    var geometry = new THREE.Geometry()
    geometry.vertices.push(a)
    geometry.vertices.push(b)
	
    const line = new THREE.Line(geometry, material)
    line.name = "Line " + this.chance.string()
    
    return line
    
}

/**
 * Boucle du jeu
 */
const event = {
	delta: 0,
	time: 0
}

game.loop = function (time = 0) {
	
	time /= 1000
	
	event.delta = time - event.time
	event.time = time
	
	// Mise à jour des boutons des gamepads
	navigator.getGamepads()
	
	// Mise à jour des objets
	this.scene.traverseVisible((child) => {
		
		if (child.name && child.name.match(/^Line/)) {
			child.geometry.verticesNeedUpdate = true
		}
		
		child.update && child.update(event)
		
	})
	
	// Mise à jour de la caméra
	this.camera.update(event)
	
	// Affichage
	this.renderer.render(this.scene, this.camera)
	
	// Prochaine frame
	window.requestAnimationFrame(this.loop.bind(this))
}



module.exports = game