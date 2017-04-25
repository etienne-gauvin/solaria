import * as EventEmitter from 'events'
import Item from './item'
import InventoryUI from './ui/inventory-ui'

export default class Inventory extends EventEmitter {

	public ui: InventoryUI
	
	public items: Array<Item>

	/**
	 */
	constructor() {
		
		super()
		
		this.items = new Array(15)
		
	}

	/**
	 * Add an item in the first free space
	 */
	add(item: Item) {

		const freeSpace = this.items.findIndex(item => !item)

		if (freeSpace >= 0) {

			this.items[freeSpace] = item
			
			this.emit('item-added', item, freeSpace)

		}

	}

}