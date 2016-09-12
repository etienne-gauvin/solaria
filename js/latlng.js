const game = require('./game')
const cos = Math.cos
const sin = Math.sin
const acos = Math.acos
const atan = Math.atan

/**
 * Class LatLng
 */
class LatLng {
	
	/**
	 * Coordonnées sur une sphère
	 * @param <Number> latitude
	 * @param <Number> longitude
	 * @param <Number> niveau
	 */
	constructor(lat, lng) {
		
		this.lat = lat
		this.lng = lng
		
	}
	
	/**
	 * 
	 */
	toWorldPosition(radius = 1) {
		
		const lat = this.lat
		const lng = this.lng
		
		const coslat = cos(lat)
		
		return new THREE.Vector3(
			radius * coslat * cos(lng),
			radius * coslat * sin(lng),
			radius * sin(lat)
		)
		
	}
	
	/**
	 * 
	 */
	static fromWorldPosition(v, radius = 1) {
		
        return new LatLng(
        	acos(v.y / radius),
        	atan(v.x / v.z)
        )
        
	}
	
}

module.exports = LatLng