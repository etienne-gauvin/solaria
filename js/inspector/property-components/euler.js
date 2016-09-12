const React = require('react')
const ReactDOM = require('react-dom')
const inspector = require('../../inspector').instance

class EulerProperty extends React.Component {
	
	constructor() {
		
		super()
		
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
		
		const euler = this.props.object[this.props.name]
		const step = Math.PI / 12
		
		return (
			
			<label className="vector vector3">
				<input
					onChange={this.handleChange}
					type="number"
					name="x"
					value={euler.x}
					step={step}
				/>
				<input
					onChange={this.handleChange}
					type="number"
					name="y"
					value={euler.y}
					step={step}
				/>
				<input
					onChange={this.handleChange}
					type="number"
					name="z"
					value={euler.z}
					step={step}
				/>
			</label>
			
		)
		
	}
	
}

module.exports = EulerProperty