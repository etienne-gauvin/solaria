const React = require('react')
const ReactDOM = require('react-dom')

let inspector

class BooleanProperty extends React.Component {
	
	constructor() {
		
		super()
		
		inspector = require('../../inspector').instance
		
		this.handleBooleanChange = this.handleBooleanChange.bind(this)
		
	}
	
	handleBooleanChange(event) {
		
		event.preventDefault()
		
		this.props.object[this.props.name] = !!event.target.checked
		
		inspector.update()
		
		return false
		
	}
	
	render() {
		
		let checked = this.props.object[this.props.name]
		
		return (
			
			<label className="boolean">
				<input
					onChange={this.handleBooleanChange}
					type="checkbox"
					checked={checked ? "checked" : ""}
				/>
			</label>
			
		)
		
	}
	
}

module.exports = BooleanProperty