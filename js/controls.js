/**
 * Gère les contrôles (clavier/souris et manette) du joueur
 */
class Controls {
	
	constructor() {
		
		this.gamepad = null
		this.deadzone = 0.2
		
		// Contrôleur actuellement utilisé ('gamepad' ou 'keyboard')
		this.controller = 'keyboard'
		
		// Valeurs sauvegardées
		this.values = {
			keyboard: {},
			gamepad: null
		}
		
		// Valeurs précédentes
		this.previous = {
			keyboard: {},
			gamepad: null
		}
		
		// Constantes
		this.GAMEPAD = {
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
		
		/**
		 * Branchement d'une manette
		 */
		window.addEventListener("gamepadconnected", (event) => {
			
			let gp = event.gamepad
			
			console.log("Contrôleur n°%d connecté : %s. %d boutons, %d axes.",
				gp.index, gp.id,
				gp.buttons.length, gp.axes.length)
			
			this.gamepad = gp
			this.controller = 'gamepad'

		})
		
		/**
		 * Appui sur une touche
		 */
		window.addEventListener("keydown", (event) => {
			
			this.values.keyboard[event.key] = true
			this.controller = 'keyboard'
			
		})
		
		/**
		 * Appui sur une touche
		 */
		window.addEventListener("keyup", (event) => {
			
			this.values.keyboard[event.key] = false
			this.controller = 'keyboard'
			
		})
		
	}
	
	/**
	 * Mise à jour
	 */
	update(event) {
		
		let gamepads = navigator.getGamepads()
		this.gamepad = gamepads[0]
		
		if (this.gamepad) {
			
			const previous = this.previous.gamepad
			const current = this.copyGamepadValues(this.gamepad)
			
			if (previous) {
				
				for (let i = 0; i < current.buttons.length; i++) {
					
					if (previous.buttons[i].pressed !== current.buttons[i].pressed) {
						
						this.controller = 'gamepad'
						
					}
					
				}
			
				for (let i = 0; i < current.axes.length; i++) {
					
					if (previous.axes[i] !== current.axes[i]) {
						
						this.controller = 'gamepad'
						
					}
					
				}
			
			}
		
			this.previous.gamepad = this.values.gamepad
			this.values.gamepad = current
			
		}
		
	}
	
	/**
	 * Transforme un axe de joystick pour prendre en compte la zone morte.
	 * @param <Number> axis
	 * @return <Number>
	 */
	applyDeadzone(x) {
		
		let deadzone = this.deadzone
				
		x = x < 0 ? Math.min(x, -deadzone) : Math.max(x, deadzone)
		
		return (Math.abs(x) - deadzone) / (1 - deadzone) * Math.sign(x)
		
	}
	
	/**
	 * Axe X principal (joystick ou souris)
	 * @param <Number> gamepadAxisIndex
	 * @param <Object> keyboardKeys : { positive: <String>, negative: <String> }
	 */
	getAxis(gamepadAxisIndex, keyboardKeys) {
		
		switch (this.controller) {
			
			case 'gamepad':
				
				if (this.values.gamepad === null) return 0
				
				return this.values.gamepad.axes[gamepadAxisIndex]
				
				break
			
			default:
			case 'keyboard':
			
				let positive = this.values.keyboard[keyboardKeys.positive] ? +1 : 0
				let negative = this.values.keyboard[keyboardKeys.negative] ? -1 : 0
				
				return positive + negative
				
				break
			
		}
		
	}
	
	/**
	 * Copie toutes les valeurs du gamepad dans un objet
	 * @param <Gamepad>
	 * @return <Object>
	 */
	copyGamepadValues(gamepad) {
		
		let axes = []
		let buttons = []
		
		for (let i = 0; i < gamepad.buttons.length; i++) {
			
			buttons[i] = {
				value: gamepad.buttons[i].value,
				pressed: gamepad.buttons[i].pressed
			}
			
		}
		
		for (let i = 0; i < gamepad.axes.length; i++) {
			
			axes[i] = this.applyDeadzone(gamepad.axes[i])
			
		}
		
		return {
			axes: axes,
			buttons: buttons
		}
		
	}
	
}

module.exports = Controls

