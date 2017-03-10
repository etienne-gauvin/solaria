const game = require('./game')
const PI = Math.PI

/**
 * Class Player
 */
class Player extends THREE.SkinnedMesh {
	
	/**
	 * Player constructor
	 */
	constructor() {
		
		const geometry = game.files.player.geometry
		
		const materials = game.files.player.materials
		const material = new THREE.MeshLambertMaterial({
			color: new THREE.Color('#F6C357'),
			skinning: true
		})
			
		super(geometry, material)
		
		this.name = "Player"
		
		this.castShadow = true
		this.receiveShadow = false
		
		// Gestionnaire des animations
		this.mixer = new THREE.AnimationMixer(this)
		
		// Vitesse de déplacement
		this.velocity = new THREE.Vector3(0, 0, 0)
		
		// Vitesse de déplacement maximale
		this.maxVelocity = 0.1
		
		// Rotation du modèle 3D
		this.geometry.rotateX(Math.PI / 2)
		this.geometry.computeFaceNormals()
		this.geometry.computeVertexNormals()
		this.geometry.computeMorphNormals()
		
		// Chargement des animations
		this.actions = {}
		
		for (let i = 0; i < this.geometry.animations.length; i++) {
			
			const clip = this.geometry.animations[i]
			const action = this.mixer.clipAction(clip)
			
			action.setEffectiveWeight(1).stop()
			
			this.actions[clip.name] = action
			
			console.log(action)
			
		}
		
		
		game.scene.add(this)
	}
	
	/**
	 * Mise à jour
	 */
	update(event) {
		
		// Joystick / clavier
		const control = new THREE.Vector2(
			-game.controls.mainAxisX,
			+game.controls.mainAxisY
		)
		
		// Force appliquée sur le joystick
		const force = control.length()
		
		// Changement de vitesse
		this.velocity.x += (control.x - this.velocity.x) / 0.1 * event.delta
		this.velocity.y += (control.y - this.velocity.y) / 0.1 * event.delta
		
		// Vitesse du personnage en fonction de la force d'appui sur le joystick
		if (force > 0) this.velocity.multiplyScalar(force)
		
		// Limitation de la vitesse
		this.velocity.clampLength(-this.maxVelocity, +this.maxVelocity)
		
		// Application de la vitesse sur la position
		this.position.add(this.velocity)
		
		
		// Rotation du personnage
		const targetRotation = Math.atan2(this.velocity.y, this.velocity.x)
		
		// Différence avec l'angle réel
		let diff = targetRotation - this.rotation.z
		
		// Aller au plus court
		if (Math.abs(diff) > Math.PI) {
			
			this.rotation.z += Math.PI * 2 * Math.sign(diff)
			diff = targetRotation - this.rotation.z
			
		}
		
		// Appliquer la différence de rotation sur la rotation réelle
		this.rotation.z += diff / 0.15 * event.delta
		
		// Mise à jour de l'animation
		this.mixer.update(event.delta)
	}
	
	/**
	 * Jouer une animation
	 */
	play(animName, weight = 1) {
		return this.mixer
			.clipAction(animName)
			.setEffectiveWeight(weight)
			.play()
	}
	
}

module.exports = Player

