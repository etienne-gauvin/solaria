const game = require('./game')
const colors = require('./colors')

window.addEventListener('load', init, false)
	
function init() {
	
	game.createScene()
	game.createLights()
	game.createObjects()
	
	window.game = game
	
	game.loop()
	
}
