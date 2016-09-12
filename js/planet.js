const game = require('./game')
const LatLng = require('./latlng')

/**
 * Class Planet
 */
class Planet extends THREE.Mesh {
	
	/**
	 * Planet constructor
	 */
	constructor() {
		
		super()
		
		this.name = "Planet"
		this.radius = 25
		
		game.scene.add(this)
		
		game.loader.load('../models/planet.json', (geometry, materials) => {
			
			this.geometry = geometry
			this.material = new THREE.MeshFaceMaterial(materials)
			
			this.material = new THREE.MeshBasicMaterial({
				wireframe: true,
            	polygonOffset: true,  
            	polygonOffsetUnits: 1,
            	polygonOffsetFactor: 1,
            	color: "yellow",
            	side: THREE.DoubleSide
			})
			
			// let material = game.planet.material.materials[0]
			
			// material.wireframe = true
   //          material.polygonOffset = true,  
   //          material.polygonOffsetUnits = 1,
   //          material.polygonOffsetFactor = 1,
   //          material.color = "yellow",
   //          material.side = THREE.DoubleSide
			
			
		})
		
	}
	
	/**
	 * Mise à jour
	 */
	update(event) {
		
		// console.log(this)
		
	}
	
}

module.exports = Planet