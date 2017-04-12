import game from './game'
import colors from './colors'

window.addEventListener('load', function () {
	
	game.load().then(() => {
		
		game.createScene()
		game.createLights()
		game.createObjects()

		window.game = game
		
		game.loop()
		
	})
	
}, false)