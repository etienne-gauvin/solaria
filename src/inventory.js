import React, { Component } from 'react';

class ItemComponent extends Component {

	constructor(item) {
		
		super()

		this.item = item
		
	}

	render() {

		return (

			<li>{item.name}</li>

		)

	}

}

class Inventory extends Component {

	constructor() {

		super()

		this.itemComponents = []

	}

	addItem(item) {

		return this.itemComponents.push(new ItemComponent(item))

	}

	render() {

		return (

			<ul>
				{itemComponents}
			</ul>

		)

	}
	
}

export default Inventory