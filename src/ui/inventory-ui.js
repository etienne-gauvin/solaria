import game from '../game'
import ItemUI from './item-ui'

export default class InventoryUI {

	constructor() {

		this.inventory = null
		
		this.$container = document.querySelector('.inventory')
		this.$items = this.$container.querySelector('.items')

		this.createElements()

		this.onItemAdded = this.onItemAdded.bind(this)
		this.onItemRemoved = this.onItemRemoved.bind(this)

		this.onInventoryButtonPressed = this.onInventoryButtonPressed.bind(this)

	}
	
	createElements() {
		
		const $items = this.$items
		
		for (let i = 0; i < 15; i++) {
			
			const $space = document.createElement('div')
			$space.classList.add('space')
			$items.appendChild($space)
			
		}
		
	}

	attach(inventory) {
		
		this.inventory = inventory

		this.inventory.addListener('item-added', this.onItemAdded)
		this.inventory.addListener('item-removed', this.onItemRemoved)

		this.itemUIs = this.inventory.items.map(item => this.addItem(item))

		// Open/close the inventory listener
		game.controls.actions.inventory.addListener('pressed', this.onInventoryButtonPressed)

	}

	detach() {

		this.itemUIs.splice(0, this.itemUIs.length)

		this.inventory.removeListener('item-added', this.onItemAdded)
		this.inventory.removeListener('item-removed', this.onItemRemoved)
		
		game.controls.actions.inventory.removeListener('pressed', this.onInventoryButtonPressed)

		this.inventory = null

	}

	onItemAdded(item) {

		this.addItem(item)

	}

	addItem(item, $space = null) {
		
		if (!$space) $space = this.findFreeSpace()
			
		if ($space) {
			
			if (!item.ui) item.ui = new ItemUI(item)
			
			this.itemUIs.push(item.ui)
			
			$space.appendChild(item.ui.$element)
			
		}
		
		else {
			
			throw new Error('No space available in inventory for this item')
			
		}
		
	}

	onItemRemoved(item) {

		this.removeItem(item)

	}

	removeItem(item) {

		const index = this.itemUIs.findIndex(itemUI => itemUI.item === item)

		this.itemUIs.splice(index, 1)
		
		this.$items.removeChild(item.ui.$element)

	}

	onInventoryButtonPressed(controller, event) {

		this.open = !this.open
		
	}
	
	/**
	 * Return a free $space of undefined
	 * @return <HTMLElement>
	 */
	 
	findFreeSpace() {
		
		const $spaces = Array.from(this.$items.children)
		
		return $spaces.find($space => $space.children.length < 1)
		
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