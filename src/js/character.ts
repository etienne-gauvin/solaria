import game from './game'
import * as THREE from 'three'
const PI = Math.PI

/**
 * Class Player
 */
class Character extends THREE.SkinnedMesh {
	
	// Gestionnaire des animations
	public readonly mixer: THREE.AnimationMixer = new THREE.AnimationMixer(this)
	
	// Vitesse de déplacement
	public readonly velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0)

	// Vitesse de déplacement maximale
	public readonly maxVelocity = 0.1

	// Animations
	public readonly actions: {[key: string]: THREE.AnimationAction} = {}
	
	// Geometry
	public geometry: THREE.Geometry

	/**
	 * Player constructor
	 */
	constructor(geometry, material) {
		
		super(geometry, material)
		
		this.castShadow = true
		this.receiveShadow = false
		
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
			
		}
		
	}
	
	/**
	 * Mise à jour
	 */
	updateMovement(event, control: THREE.Vector2) {
		
		// Force appliquée sur le joystick
		const force = control.length()
		
		// Changement de vitesse
		this.velocity.x += (control.x - this.velocity.x) / 0.1 * event.delta
		this.velocity.y += (control.y - this.velocity.y) / 0.1 * event.delta
		
		// Vitesse du personnage en fonction de la force d'appui sur le joystick
		if (force > 0) this.velocity.multiplyScalar(force)
		
		// Limitation de la vitesse
		if (this.velocity.length() > 0) this.velocity.clampLength(0, +this.maxVelocity)
		
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
	playA(animName, weight = 1) {
		return this.mixer
			.clipAction(animName)
			.setEffectiveWeight(weight)
			.play()
	}
	
}

export default Character

