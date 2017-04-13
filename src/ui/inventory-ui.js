import ItemUI from './item-ui'

export default class InventoryUI {

	constructor() {

		this.inventory = null

		this.itemUIs = []

		this.onItemAdded = this.onItemAdded.bind(this)
		this.onItemRemoved = this.onItemRemoved.bind(this)

		this.$ul = document.createElement('ul')

		this.$container = document.createElement('div')
		this.$container.className = 'inventory'
		this.$container.append(this.$ul)

	}

	attach(inventory) {
		
		this.inventory = inventory

		this.inventory.addListener('item-added', this.onItemAdded)
		this.inventory.addListener('item-removed', this.onItemRemoved)

		this.itemUIs = this.inventory.items.map(item => this.addItem(item))

	}

	detach() {

		this.itemUIs.splice(0, this.itemUIs.length)

		this.inventory.removeListener('item-added', this.onItemAdded)
		this.inventory.removeListener('item-removed', this.onItemRemoved)

		this.inventory = null

	}

	onItemAdded(item) {

		this.addItem(item)

	}

	addItem(item) {

		this.itemUIs.push(new ItemUI(item))

	}

	onItemRemoved(item) {

		this.removeItem(item)

	}

	removeItem(item) {

		const index = this.itemUIs.findIndex(itemUI => itemUI.item === item)

		this.itemUIs.splice(index, 1)

	}

	render() {



	}
	
}