const React = require('react')
const ReactDOM = require('react-dom')

// Clé unique du singleton
const KEY = Symbol.for("inspector")

/**
 * Class Inspector
 */
class Inspector {
	
	/**
	 * Game constructor
	 * @throw Error
	 */
	constructor() {
		
		// Il est interdit de créer une autre instance de l'inspector
		if (Object.getOwnPropertySymbols(global).includes(KEY)) {
			
			throw new Error('An Inspector instance already exists!')
		
		}
		
		this.container = document.getElementById('inspector')
		
		// Variables concernant le rafraîchissement de l'inspecteur
		this.time = 0
		this.lastUpdateTime = - Infinity
		this.updateInterval = 200
		
		// Objet ayant le focus
		this.focused = null
		
	}

}

/**
 * Pattern Singleton
 */
if (! Object.getOwnPropertySymbols(global).includes(KEY)) { global[KEY] = new Inspector }
Object.defineProperty(Inspector, "instance", { get: () => global[KEY] })
module.exports = Inspector

/**
 * Requires ayant besoin de ce singleton
 */
const game = require('./game').instance
const Object3DListComponent = require('./inspector/object3d-list-component')
const BreadcrumbComponent = require('./inspector/breadcrumb-component')
const PropertiesComponent = require('./inspector/properties-component')

/**
 * Mettre à jour à intervales régulier
 */
Inspector.prototype.loop = function (time) {
		
	this.time = time
	
	if (this.time - this.lastUpdateTime > this.updateInterval) {
		
		this.update()
		
	}
	
	if (this.controls) {
		
		this.controls.update()
		
	}
	
	window.requestAnimationFrame(this.loop.bind(this))
	
}
	
	
/**
 * Mise à jour de l'arbre
 */
Inspector.prototype.update = function () {
	
	this.lastUpdateTime = this.time
	
	const object = this.focused
	const children = (object == null) ? [] : object.children
	
	this.controls.target = object.position
	
	ReactDOM.render(
	  	<BreadcrumbComponent object={object} />,
	 	this.container.querySelector('.content > .breadcrumbContainer')
	)

	ReactDOM.render(
	  	<Object3DListComponent objects={children} />,
	 	this.container.querySelector('.content > .object3DListContainer')
	)
	
	ReactDOM.render(
	  	<PropertiesComponent object={object} />,
	 	this.container.querySelector('.content > .propertiesContainer')
	)
	
}


/**
 * Trackball
 */
Inspector.prototype.createControls = function () {
	
	const controls = this.controls = new THREE.TrackballControls( game.camera )

	controls.rotateSpeed = 10.0
	controls.zoomSpeed = 1.2
	controls.panSpeed = 0.8

	controls.noZoom = false
	controls.noPan = false

	controls.staticMoving = true
	controls.dynamicDampingFactor = 0.3

	controls.keys = [ 65, 83, 68 ]

	// controls.addEventListener( 'change', render )

}