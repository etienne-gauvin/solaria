import game from './game'
import colors from './colors'

window.addEventListener('load', function () {
	
	game.load().then(() => {
		
		game.init()
		game.createUI()
		game.createScene()
		game.createLights()
		game.createObjects()

		window.game = game
		
		game.loop()

		game.scene.visible = false
		
	})
	
}, false)