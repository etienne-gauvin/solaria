import * as EventEmitter from 'events'
import Item from './item'
import InventoryUI from './ui/inventory-ui'

export default class Inventory extends EventEmitter {

	public ui: InventoryUI
	
	public items: Array<Item> = new Array(15)

	/**
	 * Add an item in the first free space
	 */
	add(item: Item, specificSpace: number = null) {

		const forceAdd = (item, index) => {

			this.items[index] = item

			item.parent = this
			
			this.emit('item-added', item, index)

		}

		if (specificSpace !== null && !this.items[specificSpace]) {

			forceAdd(item, specificSpace)

		}

		else {

			const freeSpace = this.items.findIndex(item => !item)

			if (freeSpace >= 0) forceAdd(item, freeSpace)

			else throw new Error('No free space in inventory')

		}


	}

}