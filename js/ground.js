const game = require('./game').instance
const LatLng = require('./latlng')

/**
 * Class Ground
 */
class Ground {
	
	/**
	 * Ground constructor
	 */
	constructor() {
		
		this.radius = 25
		
		const loader = new THREE.JSONLoader()
	
		loader.load('../models/planet.json', (geometry, materials) => {
			
			this.geometry = geometry
			this.material = new THREE.MeshFaceMaterial(materials)
			
			this.mesh = new THREE.Mesh(
				this.geometry,
				this.material
			)
			
			this.mesh.name = "Ground"
		
			game.scene.add(this.mesh)
			
			
			this.mesh2 = this.mesh.clone()
			game.scene.add(this.mesh2)
			this.mesh2.rotation.y = Math.PI / 2
			
		})
		
	}
	
	/**
	 * Mise à jour
	 */
	update(delta, time) {
		
	}
	
}

module.exports = Ground