import EventEmitter from 'events'

export default class Inventory extends EventEmitter  {

	/**
	 */
	constructor() {
		
		super()
		
		this.ui = null
		
		this.items = new Array(15)
		
	}

	/**
	 * Add an item in the first free space
	 * @param <Item>
	 */
	add(item) {

		const freeSpace = this.items.findIndex(item => !item)

		if (freeSpace >= 0) {

			this.items[freeSpace] = item
			
			this.emit('item-added', {
				item: item,
				index: freeSpace
			})

		}

	}

}