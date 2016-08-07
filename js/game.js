// Clé unique du singleton
const GAME_KEY = Symbol.for("game")

/**
 * Class Game
 */
class Game {
	
	/**
	 * Game constructor
	 * @throw Error
	 */
	constructor() {
		
		// Il est interdit de créer une autre instance du jeu
		if (Object.getOwnPropertySymbols(global).includes(GAME_KEY)) {
			
			throw new Error('A Game instance already exists!')
		
		}
		
		this.width = null
		this.height = null
		
		this.scene = null
		
	}
	
	/**
	 * Création de la scène
	 */
	createScene() {
		
		// Get the width and the height of the screen,
		// use them to set up the aspect ratio of the camera 
		// and the size of the renderer.
		this.height = window.innerHeight
		this.width = window.innerWidth

		// Create the scene
		this.scene = new THREE.Scene()

		// Add a fog effect to the scene same color as the
		// background color used in the style sheet
		this.scene.fog = new THREE.Fog(0x5DBDE5, 100, 950)
		
		// Create the camera
		let aspectRatio = this.width / this.height
		let fieldOfView = 60
		let nearPlane = 1
		let farPlane = 10000
		
		this.camera = new THREE.PerspectiveCamera(
			fieldOfView,
			aspectRatio,
			nearPlane,
			farPlane
		)
		
		// Set the position of the camera
		this.camera.position.x = 0
		this.camera.position.z = 100
		this.camera.position.y = 100
		
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
	createLights() {
		
		// A hemisphere light is a gradient colored light; 
		// the first parameter is the sky color, the second parameter is the ground color, 
		// the third parameter is the intensity of the light
		let hemisphereLight = new THREE.HemisphereLight(0xE5FF0D, 0x72F89B, 1)
		
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
		this.scene.add(hemisphereLight)
		this.scene.add(shadowLight)
	}
	
	/**
	 * Création du sol
	 */
	createGround() {
		
		const loader = new THREE.JSONLoader()
		
		loader.load('../models/ground.json', (geometry, materials) => {
			
			const mesh = new THREE.Mesh(
				geometry,
				new THREE.MeshFaceMaterial(materials)
			)
			
			mesh.name = "Ground"
		
			this.scene.add(mesh)
			
		})
		
	}
	
	
	/**
	 * Boucle du jeu
	 */
	loop(time) {
		
		
		
		this.renderer.render(this.scene, this.camera)
		requestAnimationFrame(this.loop.bind(this))
		
	}
	
}



// On regarde si cette clé existe dans l'objet global
if (! Object.getOwnPropertySymbols(global).includes(GAME_KEY)) {
	
	// Si non, on crée la seule instance de Game
	global[GAME_KEY] = new Game

}

// Game.instance permet de récupérer l'instance du jeu
Object.defineProperty(Game, "instance", {
  get: () => global[GAME_KEY]
})

// Empêche la modification de Game
Object.freeze(Game)

module.exports = Game