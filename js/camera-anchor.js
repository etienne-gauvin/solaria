const game = require('./game')
const TWEEN = require('tween.js')

/**
 * Class CameraAnchor
 */
class CameraAnchor extends THREE.Object3D {
	
	/**
	 * CameraAnchor constructor
	 */
	constructor() {
		
		super()
		
		// Objet à centrer (probablement le joueur)
		this.focused = null
		
		// Position réelle de la caméra
		this.camera = null
		
	}
	
	/**
	 * Mise à jour
	 */
	update() {
		
		if (this.focused === null) {
			return
		}
			
		// 	if (this.targetPosition != )
			
			
			
		// 	const focusVector = this.focus.position.clone()
		// 	const focusEuler = this.focus.rotation.clone()
			
		// 	ropeVector.applyEuler(focusEuler)
			
		// 	const cameraVector = this.focus.position.clone().add(ropeVector)
			
		// 	// game.lineGeometry.vertices[0].copy(a)
		// 	// game.lineGeometry.vertices[1].copy(b)
			
		// 	game.camera.position.copy(cameraVector)
		// 	game.camera.lookAt(this.focus.position)
			
		// 	// game.lineGeometry.verticesNeedUpdate = true
		// }
		
		// TWEEN.update()
		
		
		
	}
	
}

module.exports = CameraAnchor