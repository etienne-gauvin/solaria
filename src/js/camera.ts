import game from './game'
import * as THREE from 'three'

export default class Camera extends THREE.PerspectiveCamera {
	
	private distanceToPlayer: THREE.Vector3
	
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
		
		// Redéfinir le haut
		this.up.copy(new THREE.Vector3(0, 0, 1))
		
		// Position de la caméra par rapport au joueur
		this.distanceToPlayer = new THREE.Vector3(0, 10, 5)

	}
	
	update(event) {
		
		// Adoucissement du déplacement de la caméra
		const speed = 0.5
		const target = game.player.position.clone().add(this.distanceToPlayer)
		const position = this.position
		
		position.x += (target.x - position.x) / speed * event.delta
		position.y += (target.y - position.y) / speed * event.delta
		position.z += (target.z - position.z) / speed * event.delta
		
		// Regarder le joueur
		this.lookAt(game.player.getWorldPosition())
		
	}
}