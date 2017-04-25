import game from '../game'
import ItemUI from './item-ui'
import ItemSpaceUI from './item-space-ui'
import Inventory from '../inventory'
import Item from '../item'
import Controls from '../controls'

export default class InventoryUI {
	
	private inventory: Inventory
	
	private spaces: Array<ItemSpaceUI>
	
	private $: Element
	
	private $spaces: Element
	
	constructor() {

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
	attach(inventory: Inventory) {
		
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
	onItemAddedInInventory(item: Item, index: number) {

		this.addItem(item, this.spaces[index])

	}

	addItem(item: Item, space: ItemSpaceUI) {
		
		space.appendItem(item)
		
	}

	/**
	 * @param <Item> item
	 */
	onItemRemovedFromInventory(item: Item) {

		this.removeItem(item)

	}

	removeItem(item: Item) {

		const space = this.spaces.find(space => space.item === item)

		if (space) space.removeItem()

		else throw new Error("Can't remove inexistant item.")

	}

	onInventoryButtonPressed(controls: Controls, event: Event) {

		this.open = !this.open
		
	}
	
	get open(): boolean {
		
		return this.$.classList.contains('open')
		
	}
	
	set open(open: boolean) {
		
		if (open) this.$.classList.add('open')
		
		else this.$.classList.remove('open')
		
	}
	
}