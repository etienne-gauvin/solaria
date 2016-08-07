const React = require('react')
const ReactDOM = require('react-dom')
const util = require('./util')

let inspector

class Object3DComponent extends React.Component {
	
	constructor() {
		
		super()
		
		this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
		this.handleClick = this.handleClick.bind(this)
		
		inspector = require('../inspector').instance
		
	}
	
	handleVisibilityChange(event) {
		
		this.props.object.visible = event.target.checked
		
		inspector.update()
		
		
	}
	
	handleClick(event) {
		
		event.preventDefault()
		
		inspector.focused = this.props.object
		inspector.update()
		
		return false
		
	}
	
	render() {
		let obj = this.props.object
		let displayName = util.getObject3DDisplayName(obj)
		
		return (
			<li data-id={obj.id}>
				<header>
					<label className="visible">
						<input
							type="checkbox"
							onChange={this.handleVisibilityChange}
							checked={obj.visible ? 'checked' : ''}
						/>
						<span></span>
					</label>
					
					<a href="#" onClick={this.handleClick}>
						<span className="name">
							{displayName}
						</span>
						<small className="type">
							{obj.type}
						</small>
					</a>
				</header>
			</li>
		)
	}
}

module.exports = Object3DComponent