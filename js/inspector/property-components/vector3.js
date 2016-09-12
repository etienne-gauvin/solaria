const React = require('react')
const ReactDOM = require('react-dom')

let inspector

class Vector3Property extends React.Component {
	
	constructor() {
		
		super()
		
		inspector = require('../../inspector').instance
		
		this.handleChange = this.handleChange.bind(this)
		
	}
	
	handleChange(event) {
		
		event.preventDefault()
		
		const input = event.target
		this.props.object[this.props.name][input.name] = (+input.value)
		
		inspector.update()
		
		return false
		
	}
	
	render() {
		
		let vect = this.props.object[this.props.name]
		
		return (
			
			<label className="vector vector3">
				<input
					onChange={this.handleChange}
					type="number"
					name="x"
					value={vect.x}
					step="10"
				/>
				<input
					onChange={this.handleChange}
					type="number"
					name="y"
					value={vect.y}
					step="10"
				/>
				<input
					onChange={this.handleChange}
					type="number"
					name="z"
					value={vect.z}
					step="10"
				/>
			</label>
			
		)
		
	}
	
}

module.exports = Vector3Property