const React = require('react')
const ReactDOM = require('react-dom')

// Clé unique du singleton
const INSPECTOR_KEY = Symbol.for("inspector")

const game = require('./game').instance
const Object3DListComponent = require('./inspector/object3d-list-component')
const BreadcrumbComponent = require('./inspector/breadcrumb-component')
const PropertiesComponent = require('./inspector/properties-component')

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
		if (Object.getOwnPropertySymbols(global).includes(INSPECTOR_KEY)) {
			
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
	
	/**
	 * Mettre à jour à intervalles régulier
	 */
	loop(time) {
		
		this.time = time
		
		if (this.time - this.lastUpdateTime > this.updateInterval) {
			
			this.update()
			
		}
		
		window.requestAnimationFrame(this.loop.bind(this))
		
	}
	
	
	/**
	 * Mise à jour de l'arbre
	 */
	update() {
		
		this.lastUpdateTime = this.time
		
		const object = this.focused
		const children = (object == null) ? [] : object.children
		
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
	
}



// On regarde si cette clé existe dans l'objet global
if (! Object.getOwnPropertySymbols(global).includes(INSPECTOR_KEY)) {
	
	// Si non, on crée la seule instance de Inspector
	global[INSPECTOR_KEY] = new Inspector

}

// Inspector.instance permet de récupérer l'instance du jeu
Object.defineProperty(Inspector, "instance", {
  get: () => global[INSPECTOR_KEY]
})


// Empêche la modification de Inspector
Object.freeze(Inspector)

module.exports = Inspector