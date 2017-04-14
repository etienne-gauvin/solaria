import EventEmitter from 'events'

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