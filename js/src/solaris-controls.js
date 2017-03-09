const game = require('./game')
const Controls = require('./controls')

/**
 * Gère les contrôles (clavier/souris et manette) du joueur
 */
class SolarisControls extends Controls {
	
	constructor() {
		
		super()
		
		game.gui.add(this, 'mainAxisX', -1, 1).step(0.01).listen()
		game.gui.add(this, 'mainAxisY', -1, 1).step(0.01).listen()
		game.gui.add(this, 'controller').listen()
		
	}
	
	get actionButton() {
		
		return this.getAxis(
			this.GAMEPAD.LEFT_X,
			{
				positive: 'd',
				negative: 'q'
			}
		)
		
	}
	
	get mainAxisX() {
		
		return this.getAxis(
			this.GAMEPAD.LEFT_X,
			{
				positive: 'd',
				negative: 'q'
			}
		)
		
	}
	
	get mainAxisY() {
		
		return this.getAxis(
			this.GAMEPAD.LEFT_Y,
			{
				positive: 's',
				negative: 'z'
			}
		)
		
	}
	
}

module.exports = SolarisControls