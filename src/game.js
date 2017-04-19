import EventEmitter from 'events'
import Chance from 'chance'
import InventoryUI from './ui/inventory-ui'
import colors from './colors'
import Ground from './ground'
import Player from './player'
import Camera from './camera'
import Controls from './solaria-controls'
import WoodenChairItem from './items/wooden-chair-item'

class Game extends EventEmitter {

	constructor() {

		super()
		
		// Fichiers à charger
		this.data = {
			models: {
				player: {
					path: '../models/player.json'
				}
			}
		}

		// Évènement de mise à jour
		this.event = {
			delta: 0,
			time: 0
		}
		
		// Liste de tous les items
		this.items = {}

	}

	/**
	 * Charger les fichiers
	 */
	load(callback) {

		return this.loadModels().then(callback)

	}

	/**
	 * Charger les fichiers
	 */
	loadModels(callback) {

		return new Promise((resolve, reject) => {

			const models = this.data.models

			// Loader
			const loader = new THREE.JSONLoader()
			
			// Vérifier qu'un fichier est chargé
			const isLoaded = file => file.geometry !== undefined || file.materials !== undefined

			// Charger chaque fichier
			for (let f in models) {
				
				let file = models[f]
				
				if (! isLoaded(file)) {
					
					loader.load(file.path, (geometry, materials) => {
						
						file.geometry = geometry
						file.materials = materials
						
						console.info(`Loaded: ${file.path}`)
						
						let allLoaded = true
						
						for (let ff in models) {

							allLoaded = allLoaded && isLoaded(models[ff])
						
						}
						
						if (allLoaded) resolve()
						
					})
					
				}
				
			}

		})

	}

	/**
	 * Initialisation
	 */
	init() {
		
		// dat.gui
		this.datgui = new dat.GUI()
		
		// Contrôles
		this.controls = new Controls
		
	}

	/**
	 * Create UI
	 */
	createUI() {

		this.ui = Object.create(null)

		this.ui.inventory = new InventoryUI

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
		this.datgui.add(this.scene, 'visible').name('Scene Visible')
		
		// Random
		this.chance = new Chance('4536453')
		
		// Add a fog effect to the scene same color as the
		// background color used in the style sheet
		// this.scene.fog = new THREE.Fog(new THREE.Color("#5DBDE5"), 150, 300)
		
		// Create the renderer
		const renderer = this.renderer = new THREE.WebGLRenderer({ 
			// Allow transparency to show the gradient background
			// we defined in the CSS
			alpha: true, 

			// Activate the anti-aliasing this is less performant,
			// but, as our project is low-poly based, it should be fine :)
			antialias: true 
		})

		// Define the size of the renderer in this case,
		// it will fill the entire screen
		renderer.setSize(this.width, this.height)
		
		// Enable shadow rendering
		renderer.shadowMap.enabled = true
		renderer.shadowMap.type = THREE.PCFSoftShadowMap
		
		// Add the DOM element of the renderer to the 
		// container we created in the HTML
		const container = document.querySelector('main')
		container.appendChild(renderer.domElement)

		// Listen to the screen: if the user resizes it
		// we have to update the camera and the renderer size
		window.addEventListener('resize', () => {
			
			this.height = window.innerHeight
			this.width = window.innerWidth
			
			renderer.setSize(this.width, this.height)
			
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
		const hemisphereLight = new THREE.HemisphereLight(
			new THREE.Color("#FFFFFF"),
			new THREE.Color("#FFFFFF"),
			1
		)
		
		
		// A directional light shines from a specific direction. 
		// It acts like the sun, that means that all the rays produced are parallel. 
		const shadowLight = new THREE.DirectionalLight(0xffffff, 0.3)
		
		// Set the direction of the light  
		shadowLight.position.set(0, 0, 10)
		
		// Allow shadow casting 
		shadowLight.castShadow = true
		// shadowLight.shadowCameraVisible = true

		// // define the visible area of the projected shadow
		shadowLight.shadow.camera.left = -20
		shadowLight.shadow.camera.right = 20
		shadowLight.shadow.camera.top = 20
		shadowLight.shadow.camera.bottom = -20
		shadowLight.shadow.camera.near = 1
		shadowLight.shadow.camera.far = 1000

		// define the resolution of the shadow; the higher the better, 
		// but also the more expensive and less performant
		shadowLight.shadow.mapSize.width = 2048
		shadowLight.shadow.mapSize.height = 2048
		this.shadowLight = shadowLight

		this.scene.add(shadowLight)
		this.scene.add(hemisphereLight)
	}

	/**
	 * Création du sol
	 */
	createObjects() {

		this.ground = new Ground

		// Create the player
		this.player = new Player

		// Attach the InventoryUI to the player's inventory
		this.ui.inventory.attach(this.player.inventory)

		// Adding an object ot the player's inventory
		this.player.inventory.add(new WoodenChairItem)
		this.player.inventory.add(new WoodenChairItem)
		
		// Create the camera
		this.camera = new Camera
		
	}

	line(a, b, color, dashed = false) {
		
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
	loop(time = 0) {

		const event = this.event
		
		time /= 1000
		
		event.delta = time - event.time
		event.time = time
		
		// Mise à jour des contrôles
		this.controls.update(event)
		
		// Mise à jour des objets
		this.scene.traverseVisible((child) => {
			
			if (child.name && child.name.match(/^Line/)) {
				child.geometry.verticesNeedUpdate = true
			}
			
			child.update && child.update(event)
			
		})

		// Diffusion de l'event "update"
		this.emit('update', event)
		
		// Mise à jour de la caméra
		this.camera.update(event)
		
		// Affichage
		this.renderer.render(this.scene, this.camera)
		
		// Prochaine frame
		window.requestAnimationFrame(this.loop.bind(this))

	}

}



export default new Game