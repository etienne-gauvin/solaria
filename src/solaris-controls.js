import game from './game'
import Controls from './controls'

/**
 * Gère les contrôles (clavier/souris et manette) du joueur
 */
class SolarisControls extends Controls {
	
	constructor() {
		
		super()
		
		const controlsFolder = game.datgui.addFolder('Controls')
		controlsFolder.add(this, 'mainAxisX', -1, 1).name('Direction X').step(0.01).listen()
		controlsFolder.add(this, 'mainAxisY', -1, 1).name('Direction Y').step(0.01).listen()
		controlsFolder.add(this, 'controller').name('Device').listen()
		
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

export default SolarisControls