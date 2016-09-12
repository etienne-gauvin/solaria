const React = require('react')
const ReactDOM = require('react-dom')
const util = require('./util')

const ColorProperty = require('./property-components/color.js')
const BooleanProperty = require('./property-components/boolean.js')
const Vector3Property = require('./property-components/vector3.js')
const EulerProperty = require('./property-components/euler.js')

const inspector = require('../inspector').instance

class PropertyComponent extends React.Component {
	
	constructor() {
		
		super()
		
		this.handleConsoleLogClick = this.handleConsoleLogClick.bind(this)
		
	}
	
	handleConsoleLogClick(event) {
		
		event.preventDefault()
		
		console.log(this.props.name, this.props.object[this.props.name])
		
		return false
		
	}
	
	render() {
		const object = this.props.object
		const name = this.props.name
		const value = object[name]
		let type
		
		if (value !== null && value instanceof THREE.Object3D) {
			
			type = value.type
			
		}
		
		else {
			
			type = typeof value
			
		}
		
		let editor
		
		if (value instanceof THREE.Color) {
			
			editor = <ColorProperty object={object} name={name} />
			
		}
		
		else if (value instanceof THREE.Vector3) {
			
			editor = <Vector3Property object={object} name={name} />
			
		}
		
		else if (value instanceof THREE.Euler) {
			
			editor = <EulerProperty object={object} name={name} />
			
		}
		
		else if (typeof value === "boolean") {
			
			editor = <BooleanProperty object={object} name={name} />
			
		}
		
		return (
			<li>
				<header>
					<a
						href="#"
						onClick={this.handleConsoleLogClick}
						title="console.log"
						className="console-log"
					>
						🔎
					</a>
					
					<span className="name">{name}</span>
					
					{editor}
					
				</header>
			</li>
		)
	}
}

module.exports = PropertyComponent