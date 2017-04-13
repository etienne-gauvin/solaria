export default class ItemUI {

	/**
	 * @param <Item> item
	 */
	constructor(item) {
		
		// Prevent the item to be moved by the user
		this.locked = false

		// Attached item
		this.item = item

		this.$container = document.createElement('div')
		this.$container.innerHTML = item.toString()
		
	}

}