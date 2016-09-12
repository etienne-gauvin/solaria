const game = require('./game')
const LatLng = require('./latlng')

/**
 * Class LatLng
 */
class Pivot extends THREE.Object3D {
	
	/**
	 * Coordonnées sur une sphère
	 * @param <Number> latitude
	 * @param <Number> longitude
	 * @param <Number> niveau
	 */
	constructor(parent, child) {
		
		super()
		
		parent.add(this)
		this.add(child)
		
		this.parent = parent
		this.child = child
		
	}
	
}

class PlanetPivot extends Pivot {
	
	constructor(child, y = 0) {
		
		super(game.planet, child)
		child.position.y = game.planet.radius + y
		
	}
	
	get lat() { return this.rotation.x }
	set lat(value) { this.rotation.x = value }
	
	get lng() { return this.rotation.z }
	set lng(value) { this.rotation.z = value }
	
	update(event) {
		
	}
	
}

Pivot.Planet = PlanetPivot

module.exports = Pivot