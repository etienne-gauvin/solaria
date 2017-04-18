import game from '../game'
import ItemUI from './item-ui'
import ItemSpaceUI from './item-space-ui'

export default class InventoryUI {

	constructor() {

		this.inventory = null
		
		this.spaces = []
		
		this.$container = document.querySelector('.inventory')
		this.$items = this.$container.querySelector('.items')

		this.createElements()

		this.onItemAdded = this.onItemAdded.bind(this)
		this.onItemRemoved = this.onItemRemoved.bind(this)

		this.onInventoryButtonPressed = this.onInventoryButtonPressed.bind(this)

	}
	
	createElements() {
		
		for (let i = 0; i < 15; i++) {
			
			const space = new ItemSpaceUI
			
			this.spaces.push(space)
			this.$items.appendChild(space.$)
			
		}
		
	}
	
	onDropOnSpace(event) {
		
		console.log(event)
		
	}

	attach(inventory) {
		
		this.inventory = inventory

		this.inventory.addListener('item-added', this.onItemAdded)
		this.inventory.addListener('item-removed', this.onItemRemoved)

		this.inventory.items.forEach(item => this.addItem(item))

		// Open/close the inventory listener
		game.controls.actions.inventory.addListener('pressed', this.onInventoryButtonPressed)

	}

	detach() {

		this.inventory.removeListener('item-added', this.onItemAdded)
		this.inventory.removeListener('item-removed', this.onItemRemoved)
		
		game.controls.actions.inventory.removeListener('pressed', this.onInventoryButtonPressed)

		this.inventory = null

	}

	onItemAdded(item) {

		this.addItem(item)

	}

	addItem(item, space = null) {
		
		if (!space) space = this.findFreeSpace()
		
		if (space) space.item = item
		
		else throw new Error('No space available in inventory for this item')
		
	}

	onItemRemoved(item) {

		this.removeItem(item)

	}

	removeItem(item) {

		const index = this.itemUIs.findIndex(itemUI => itemUI.item === item)

		this.itemUIs.splice(index, 1)
		
		this.$items.removeChild(item.ui.$)

	}

	onInventoryButtonPressed(controller, event) {

		this.open = !this.open
		
	}
	
	/**
	 * Return a free space or undefined
	 * @return <ItemSpace>
	 */
	 
	findFreeSpace() {
		
		return this.spaces.find(space => space.isEmpty)
		
	}
	
	get open() {
		
		return this.$container.classList.contains('open')
		
	}
	
	set open(open) {
		
		if (open)
			this.$container.classList.add('open')
		
		else
			this.$container.classList.remove('open')
		
	}
	
}