const game = require('./game')
const Pivot = require('./pivot')
const GamepadConstants = require('./gamepad-constants')
const gamepad = navigator.getGamepads()[0]
const PI = Math.PI

/**
 * Class Player
 */
class Player extends THREE.Mesh {
	
	/**
	 * Player constructor
	 */
	constructor() {
		
		super()
		
		this.name = "Player"
		
		this.pivot = new Pivot.Planet(this)
		
		game.loader.load('../models/player.json', (geometry, materials) => {
			
			this.geometry = geometry
			this.material = new THREE.MeshFaceMaterial(materials)
			
		})
		
		// Rotation "visée" par le joueur (quand il bouge le joystick)
		this.targetRotation = 0
		
	}
	
	/**
	 * Mise à jour
	 */
	update(event) {
		
		// console.log(gamepad.buttons[GamepadConstants.A])
		
		if (gamepad) {
			
			var applyDeadZone = (x, deadZone = 0.2) => {
				
				x = x < 0 ? Math.min(x, -deadZone) : Math.max(x, deadZone)
				
				return (Math.abs(x) - deadZone) / (1 - deadZone) * Math.sign(x)
				
			}
			
			const deadzone = 0.2
			
			const left = new THREE.Vector2(
				applyDeadZone(gamepad.axes[GamepadConstants.LEFT_X],  deadzone),
				applyDeadZone(gamepad.axes[GamepadConstants.LEFT_Y],  deadzone)
			)
			
			const moveForward = gamepad.buttons[GamepadConstants.A].value
			
			// let rightX = applyDeadZone(gamepad.axes[GamepadConstants.RIGHT_X], deadzone)
			// let rightY = applyDeadZone(gamepad.axes[GamepadConstants.RIGHT_Y], deadzone)
			
			const diff = (source, target) => {
				
				let diff = target - source
				
				if (diff > PI) {
					
					diff -= PI * 2
					
				} 

				if (diff < - PI) {
					
					diff += PI * 2
					
				} 
				
				return diff
				
			}
			
			this.targetRotation = PI * - left.x
			
			this.rotation.y += this.targetRotation / 3 * event.delta
			
			if (moveForward) {
				this.pivot.lng += Math.cos(this.rotation.y) * event.delta / 2
				this.pivot.lat += Math.sin(this.rotation.y) * event.delta / 2
			}
			// this.pivot.lat += event.delta/* * - Math.sin(this.rotation.y)*/ * 0.5 * left.length()
			// * PI / 6 * -left.x * Math.cos(this.rotation.y)
			// this.pivot.lat += event.delta// * PI / 6 * left.y * Math.sin(this.rotation.y)
			
			// console.log(Math.cos(this.rotation.y), Math.sin(this.rotation.y))
			
			// this.pivot.quaternion.setFromAxisAngle(
			// 	new THREE.Vector3(
			// 		this.pivot.quaternion.x,
			// 		this.pivot.quaternion.y,
			// 		this.pivot.quaternion.z
			// 	),
			// 	Math.atan2(left.y, -left.x)
			// )
		
		}
		
		// this.pivot.lng = event.time % (PI * 2)
		// this.pivot.lng = event.time % (PI * 2)
		
	}
	
}

module.exports = Player

