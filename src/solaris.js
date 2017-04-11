const game = require('./game')
const colors = require('./colors')

window.addEventListener('load', function () {
	
	game.load().then(() => {
		
		game.createScene()
		game.createLights()
		game.createObjects()

		console.log(game)
		
		window.game = game
		
		game.loop()
		
	})
	
}, false)