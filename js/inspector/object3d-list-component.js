const React = require('react')
const ReactDOM = require('react-dom')

const Object3DComponent = require('./object3d-component')

class Object3DListComponent extends React.Component {
	
	constructor() {
		
		super()
		
	}
	
	render() {
		let objects = this.props.objects
		
		if (objects.length > 0) {

			return (
				<div className="object3DList">
					<span>{objects.length} children</span>
					<ul>
						{this.props.objects.map((object) => {
							return <Object3DComponent object={object} key={object.id} />
				        })}
					</ul>
				</div>
			)
		}
		
		else {
			
			return (
				
				<div className="object3DList">
					<span>No children</span>
				</div>
				
			)
			
		}
	}
}

module.exports = Object3DListComponent