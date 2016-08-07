const React = require('react')
const ReactDOM = require('react-dom')

let inspector

class ColorProperty extends React.Component {
	
	constructor() {
		
		super()
		
		inspector = require('../../inspector').instance
		
		this.handleColorChange = this.handleColorChange.bind(this)
		
	}
	
	handleColorChange(event) {
		
		event.preventDefault()
		
		this.props.object[this.props.name] = new THREE.Color(event.target.value)
		
		inspector.update()
		
		return false
		
	}
	
	render() {
		
		const color = this.props.object[this.props.name]
		
		return (
			
			<div className="editor">
				<label className="color">
					<input
						onChange={this.handleColorChange}
						type="color"
						value={"#" + color.getHexString()}
					/>
				</label>
			</div>
		)
		
	}
	
}

module.exports = ColorProperty