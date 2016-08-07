const React = require('react')
const ReactDOM = require('react-dom')
const util = require('./util')

let inspector

class BreadcrumbItemComponent extends React.Component {
	
	constructor() {
		
		super()
		
		inspector = require('../inspector').instance
		this.handleClick = this.handleClick.bind(this)
		
	}
	
	handleClick(event) {
		
		event.preventDefault()
		
		inspector.focused = this.ancestor
		inspector.update()
		
		return false
		
	}
	
	render() {
		
		this.ancestors = this.props.ancestors
		this.ancestor = this.ancestors.splice(0, 1)[0]
		
		if (this.ancestors.length > 0) {
			
			return (
				<div className="item">
					<a href="#" onClick={this.handleClick}>
						{util.getObject3DDisplayName(this.ancestor)}
					</a>
					
					<BreadcrumbItemComponent ancestors={this.ancestors} />
				</div>
			)
			
		}
		
		// Dernier ancêtre
		else {
			
			return (
				<div className="item">
					<span>{util.getObject3DDisplayName(this.ancestor)}</span>
				</div>
			)
			
		}
		
		
	}
	
}

class BreadcrumbComponent extends React.Component {
	
	constructor() {
		
		super()
		
	}
	
	render() {
		
		const object = this.props.object		
		let ancestor = object
		
		const ancestors = []
		
		do {
			
			// Insertion au début
			ancestors.splice(0, 0, ancestor)
			ancestor = ancestor.parent
			
		}
		while (ancestor !== null)
		
		
		return (
			<div className="breadcrumb">
				<BreadcrumbItemComponent ancestors={ancestors} />
			</div>
		)
	}
}

module.exports = BreadcrumbComponent