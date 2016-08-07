const React = require('react')
const ReactDOM = require('react-dom')

const PropertyComponent = require('./property-component')

let inspector

class PropertiesComponent extends React.Component {
	
	constructor() {
		
		super()
		
		inspector = require('../inspector').instance
		
		this.handleFilterChange = this.handleFilterChange.bind(this)
		
		this.filterSource = ""
		this.filter = new RegExp(this.filterSource, 'i')
		
	}
	
	handleFilterChange(event) {
		
		this.filterSource = event.target.value
		
		try {
			
			this.filter = new RegExp(this.filterSource)
			this.validFilter = true
			
		}
		
		catch (e) {
			
			this.validFilter = false
			
		}
		
		inspector.update()
		
	}
	
	render() {
		
		const object = this.props.object
		const properties = []
		
		for (let name in object) {
			
			const value = object[name]
			let ok = true
			
			ok = ok && !name.match(/^children|name|uuid|type|parent$/)
			ok = ok && (typeof(value) !== "function")
			
			if (this.filter) {
				
				let filterOk = false
				
				filterOk = filterOk || name.match(this.filter)
				
				if (value !== null) {
					
					if (value instanceof THREE.Object3D) {
						
						filterOk = filterOk || value.type.match(this.filter)
						
					}
					
					filterOk = filterOk || (typeof value).match(this.filter)
					
				}
				
				ok = ok && filterOk
				
			}
			
			
			if (ok) {
				
				properties.push(name)
				
			}
			
		}
		
		
		return (
			<div className="properties">
				<span>Properties</span>
				
				<label className="filter">
					<input
						type="text"
						placeholder="Filter (RegExp)"
						onChange={this.handleFilterChange}
						value={this.filterSource}
						className={this.validFilter ? "valid" : "invalid"}
					/>
				</label>
				
				<ul>
					{properties.map((propertyName) => {
						return (
							<PropertyComponent
								object={object}
								name={propertyName}
								key={object.id+propertyName}
							/>
						)
			        })}
				</ul>
			</div>
		)
		
	}
	
}

module.exports = PropertiesComponent