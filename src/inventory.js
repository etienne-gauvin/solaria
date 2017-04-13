import EventEmitter from 'events'
import React, { PropTypes } from 'react'

export default class Inventory extends EventEmitter  {

	/**
	 */
	constructor() {
		
		super()

		this.items = []
		
	}

	/**
	 * Add item
	 */
	add(item) {

		this.items.push(item)
		this.emit('item-added', item)

	}

}