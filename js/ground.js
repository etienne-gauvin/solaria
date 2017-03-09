const game = require('./game')

/**
 * Class Ground
 */
class Ground extends THREE.Mesh {
	
	/**
	 * Ground constructor
	 */
	constructor() {
		
		super()
		
		this.name = "Ground"
	
		this.geometry = new THREE.PlaneGeometry(20, 20)
		
		this.material = new THREE.MeshLambertMaterial({
			color: new THREE.Color('#9DDD87'),
			side: THREE.DoubleSide
		})
		
		this.castShadow = false
		this.receiveShadow = true
		
		game.scene.add(this)
		
	}
	
	/**
	 * Mise à jour
	 */
	update(delta, time) {
		
	}
	
}

module.exports = Ground