import game from '../game'
import ItemUI from './item-ui'
import ItemSpaceUI from './item-space-ui'

export default class InventoryUI {

	constructor() {

		this.inventory = null

		this.spaces = null
		
		this.$ = document.querySelector('.inventory')
		this.$spaces = this.$.querySelector('.items')

		this.onItemAddedInInventory = this.onItemAddedInInventory.bind(this)
		this.onItemRemovedFromInventory = this.onItemRemovedFromInventory.bind(this)

		this.onInventoryButtonPressed = this.onInventoryButtonPressed.bind(this)

	}
	
	onDropOnSpace(event) {
		
		console.log(event)
		
	}

	/**
	 * Attach to an inventory
	 * @param <Inventory>
	 */
	attach(inventory) {
		
		this.inventory = inventory

		const itemCount = this.inventory.items.length

		this.spaces = new Array(itemCount)
		
		for (let i = 0; i < itemCount; i++) {

			const space = new ItemSpaceUI

			this.spaces[i] = space

			this.$spaces.appendChild(space.$)

		}
		
		this.inventory.addListener('item-added', this.onItemAddedInInventory)
		this.inventory.addListener('item-removed', this.onItemRemovedFromInventory)

		// Open/close the inventory listener
		game.controls.actions.inventory.addListener('pressed', this.onInventoryButtonPressed)

	}

	/**
	 * Detach the inventory
	 */
	detach() {

		this.inventory = null

		this.spaces = null

		this.inventory.removeListener('item-added', this.onItemAddedInInventory)
		this.inventory.removeListener('item-removed', this.onItemRemovedFromInventory)
		
		game.controls.actions.inventory.removeListener('pressed', this.onInventoryButtonPressed)

	}

	/**
	 * @param <Item> item
	 */
	onItemAddedInInventory({ item, index }) {

		this.addItem({
			item: item,
			space: this.spaces[index]
		})

	}

	/**
	 * @param <Item> item
	 * @param <Item> ItemSpaceUI
	 */
	addItem({ item, space }) {
		
		space.appendItem(item)
		
	}

	/**
	 * @param <Item> item
	 */
	onItemRemovedFromInventory(item) {

		this.removeItem(item)

	}

	/**
	 * @param <Item> item
	 */
	removeItem(item) {

		const space = this.spaces.find(space => space.item === item)

		if (space) space.removeItem()

		else throw new Error("Can't remove inexistant item.")

	}

	onInventoryButtonPressed(controller, event) {

		this.open = !this.open
		
	}
	
	/**
	 * @return <Boolean>
	 */
	get open() {
		
		return this.$.classList.contains('open')
		
	}
	
	/**
	 * @param <Boolean> open
	 */
	set open(open) {
		
		if (open) this.$.classList.add('open')
		
		else this.$.classList.remove('open')
		
	}
	
}