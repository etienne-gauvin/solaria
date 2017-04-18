import game from './game'
import Controls from './controls'

/**
 * Gère les contrôles (clavier/souris et manette) du joueur
 */
class SolariaControls extends Controls {
	
	constructor() {
		
		super()

		// Open/close the inventory
		this.createAction('inventory', { keys: [ 'Tab' ], buttons: [ this.GAMEPAD.Y ] })

		// dat.GUI
		const controlsFolder = game.datgui.addFolder('Controls')
		controlsFolder.add(this, 'mainAxisX', -1, 1).name('Direction X').step(0.01).listen()
		controlsFolder.add(this, 'mainAxisY', -1, 1).name('Direction Y').step(0.01).listen()
		controlsFolder.add(this, 'controller').name('Device').listen()
		
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

export default SolariaControls