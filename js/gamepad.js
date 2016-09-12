
window.addEventListener("gamepadconnected", function(e) {

	console.log("Contrôleur n°%d connecté : %s. %d boutons, %d axes.",
		event.gamepad.index, event.gamepad.id,
		event.gamepad.buttons.length, event.gamepad.axes.length)
	
})

module.exports = (index = 0) => navigator.getGamepads()[index]