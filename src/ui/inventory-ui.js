import game from '../game'
import ItemUI from './item-ui'

export default class InventoryUI {

	constructor() {

		this.inventory = null

		this.itemUIs = []

		this.onItemAdded = this.onItemAdded.bind(this)
		this.onItemRemoved = this.onItemRemoved.bind(this)

		this.onInventoryButtonPressed = this.onInventoryButtonPressed.bind(this)

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

		// Open the inventory
		game.controls.inventoryButton.addListener('pressed', this.onInventoryButtonPressed)

	}

	detach() {

		this.itemUIs.splice(0, this.itemUIs.length)

		this.inventory.removeListener('item-added', this.onItemAdded)
		this.inventory.removeListener('item-removed', this.onItemRemoved)
		
		game.controls.inventoryButton.removeListener('pressed', this.onInventoryButtonPressed)

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

	onInventoryButtonPressed(controller, event) {

		if (controller === 'keyboard' && event)
			event.preventDefault()

		console.log('Open Inventory', controller, event)

	}

	render() {



	}
	
}