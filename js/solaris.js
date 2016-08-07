const game = require('./game').instance
const inspector = require('./inspector').instance
const colors = require('./colors')

window.addEventListener('load', init, false)
	
function init() {
	
	game.createScene()
	game.createLights()
	game.createGround()
	
	window.scene = game.scene
	
	inspector.focused = game.scene
	
	game.loop()
	inspector.loop()
	
	console.log(game.scene)
	
}
