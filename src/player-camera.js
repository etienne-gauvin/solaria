import game from './game'
import Pivot from './pivot'

class PlayerCamera extends THREE.PerspectiveCamera {
	
	constructor() {
		
		const aspectRatio = game.width / game.height
		const fieldOfView = 40
		const nearPlane = 1
		const farPlane = 10000
		
		super(
			fieldOfView,
			aspectRatio,
			nearPlane,
			farPlane
		)
		
		game.scene.add(this)
		this.position.set(0, 0, 100)
		
		// Vitesse de déplacement de la caméra
		this.speed = 0.5
		
		// Anchor est un point fixe à 
		this.anchor = new THREE.Object3D
		game.player.add(this.anchor)
		this.anchor.position.set(0, 15, 0)
		
	}
	
	update(event) {
		
		// Adoucissement du déplacement de la caméra
		const anchorPosition = this.anchor.getWorldPosition()
		this.position.x += (anchorPosition.x - this.position.x) / this.speed * event.delta
		this.position.y += (anchorPosition.y - this.position.y) / this.speed * event.delta
		this.position.z += (anchorPosition.z - this.position.z) / this.speed * event.delta
		
		// Redéfinir le "haut" pour la caméra
		// this.up.copy(game.player.getWorldPosition().normalize())
		
		// Regarder le joueur
		this.lookAt(game.player.getWorldPosition())
		
	}
}

export default PlayerCamera