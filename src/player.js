const game = require('./game')
const PI = Math.PI
const Character = require('./character')

/**
 * Class Player
 */
class Player extends Character {
	
	/**
	 * Player constructor
	 */
	constructor() {
		
		const geometry = game.data.models.player.geometry
		
		const materials = game.data.models.player.materials
		const material = new THREE.MeshLambertMaterial({
			color: new THREE.Color('#F6C357'),
			skinning: true
		})
		
		super(geometry, material)
		
		this.name = "Player"
		
		game.scene.add(this)

		// dat.GUI
		const playerPosFolder = game.gui.addFolder('Player')
		playerPosFolder.add(this.position, 'x').name('Position X').listen()
		playerPosFolder.add(this.position, 'y').name('Position Y').listen()
		playerPosFolder.add(this.position, 'z').name('Position Z').listen()
		playerPosFolder.add(this.velocity, 'x').name('Rotation X').listen()
		playerPosFolder.add(this.velocity, 'y').name('Rotation Y').listen()
		playerPosFolder.add(this.velocity, 'z').name('Rotation Z').listen()

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
		
		this.updateMovement(event, control)

	}

}

module.exports = Player

