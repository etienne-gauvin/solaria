import * as EventEmitter from 'events'

class Action extends EventEmitter {
	
	public name: string
	public keys: Array<string|number>
	public buttons: Array<number>
	
	constructor(name: string, keys: Array<string|number> = [], buttons: Array<number> = []) {

		super()

		// Name
		this.name = name

		// Codes
		this.keys = keys
		this.buttons = buttons

	}

}

interface GamepadInputs {
	buttons: Array<{
		pressed: boolean
		value: number
	}>
	axes: Array<{
		value: number
	}>
}

interface Inputs {
	keyboard: object
	gamepad: GamepadInputs
}

/**
 * Gère les contrôles (clavier/souris et manette) du joueur
 */
export default class Controls {
	
	private gamepad: Gamepad
	
	protected deadzone: number = 0.2
	
	// Contrôleur actuellement utilisé ('gamepad' ou 'keyboard')
	protected controller: string = 'keyboard'
	
	// Valeurs sauvegardées
	protected values: Inputs = {
		keyboard: {},
		gamepad: null
	}
	
	// Valeurs précédentes
	protected previous: Inputs = {
		keyboard: {},
		gamepad: null
	}
	
	public readonly GAMEPAD = {
		A: 0,
		B: 1,
		X: 2,
		Y: 3,
		LB: 4,
		RB: 5,
		LT: 6,
		RT: 7,
		BACK: 8,
		START: 9,
		UP: 12,
		DOWN: 13,
		LEFT: 14,
		RIGHT: 15,
		
		LEFT_X: 0,
		LEFT_Y: 1,
		RIGHT_X: 2,
		RIGHT_Y: 3
	}
	
	public readonly actions: { [key: string]: Action } = {}
	
	public readonly actionsArray: Array<Action> = new Array
	
	constructor() {

		/**
		 * Branchement d'une manette
		 */
		window.addEventListener('gamepadconnected', (event: GamepadEvent) => {
			
			const gp = event.gamepad
			
			console.log("Contrôleur n°%d connecté : %s. %d boutons, %d axes.",
				gp.index, gp.id,
				gp.buttons.length, gp.axes.length)
			
			this.gamepad = gp
			this.controller = 'gamepad'

		})
		
		/**
		 * Appui sur une touche
		 */
		window.addEventListener('keydown', event => {
			
			if (!event.defaultPrevented && !event.repeat) {

				this.values.keyboard[event.key] = true
				this.controller = 'keyboard'
				
				// Avoid to block ALL keys, to keep the browser shortcuts
				let exec = false
				
				this.actionsArray
					.filter(action => action.keys.find(key => key === event.key))
					.forEach(action => exec = true && action.emit('pressed'))
				
				if (exec) event.preventDefault()
				
			}

		})
		
		/**
		 * Appui sur une touche
		 */
		window.addEventListener('keyup', event => {
			
			if (!event.defaultPrevented && !event.repeat) {

				this.values.keyboard[event.key] = false
				this.controller = 'keyboard'
				
				// Avoid to block ALL keys, to keep the browser shortcuts
				let exec = false
				
				this.actionsArray
					.filter(action => action.keys.find(key => key === event.key))
					.forEach(action => exec = true && action.emit('released'))
					
				if (exec) event.preventDefault()
				
			}

		})
		
	}

	/**
	 * Mise à jour
	 */
	update(event): void {
		
		let gamepads = navigator.getGamepads()
		this.gamepad = gamepads[0]
		
		if (this.gamepad) {
			
			const previous = this.previous.gamepad
			const current = this.values.gamepad = this.copyGamepadInputs(this.gamepad)
			
			if (previous) {

				let i
				
				for (i = 0; i < current.buttons.length; i++) {
					
					if (previous.buttons[i].pressed !== current.buttons[i].pressed) {
						
						this.controller = 'gamepad'
						
						this.actionsArray
							.filter(action => action.buttons.find(button => button === i))
							.forEach(action => action.emit(current.buttons[i].pressed ? 'pressed' : 'released'), this.controller)

					}
					
				}
			
				for (i = 0; i < current.axes.length; i++) {
					
					if (previous.axes[i] !== current.axes[i]) {
						
						this.controller = 'gamepad'
						
					}
					
				}
			
			}
		
			this.previous.gamepad = this.values.gamepad
			
		}
		
	}
	
	/**
	 * Transforme un axe de joystick pour prendre en compte la zone morte.
	 */
	applyDeadzone(x: number): number {
		
		let deadzone = this.deadzone
		
		x = x < 0 ? Math.min(x, -deadzone) : Math.max(x, deadzone)
		
		return (Math.abs(x) - deadzone) / (1 - deadzone) * Math.sign(x)
		
	}
	
	/**
	 * Axe X principal (joystick ou souris)
	 */
	getAxis(gamepadAxisIndex: number, keyboardKeys: { positive: string, negative: string }): number {

		let axis: number = 0
		
		switch (this.controller) {
			
			case 'gamepad':
				
				if (this.values.gamepad !== null) {

					axis = this.values.gamepad.axes[gamepadAxisIndex].value

				}
				
				break
			
			default:
			case 'keyboard':
			
				const positive = this.values.keyboard[keyboardKeys.positive] ? +1 : 0
				const negative = this.values.keyboard[keyboardKeys.negative] ? -1 : 0
				
				axis = positive + negative
			
		}

		return axis
		
	}

	/**
	 * Copie toutes les valeurs du gamepad dans un objet
	 * @param <Gamepad>
	 * @return <Object>
	 */
	copyGamepadInputs(gamepad: Gamepad): GamepadInputs {
		
		const inputs: GamepadInputs = {
			buttons: new Array,
			axes: new Array
		}
		
		for (let i = 0; i < gamepad.buttons.length; i++) {
			
			inputs.buttons[i] = {
				value: gamepad.buttons[i].value,
				pressed: gamepad.buttons[i].pressed
			}
						
		}
		
		for (let i = 0; i < gamepad.axes.length; i++) {
			
			inputs.axes[i] = {
				value: this.applyDeadzone(gamepad.axes[i])
			}
			
		}
		
		return inputs
		
	}
	
	/**
	 * Create an action and a shortcut
	 */
	createAction(name: string, keys: Array<string|number>, buttons: Array<number>): void {

		const action = new Action(name, keys, buttons)

		this.actions[action.name] = action
		this.actionsArray.push(action)

	}

}