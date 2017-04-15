export default class ItemUI {

	/**
	 * @param <Item> item
	 */
	constructor(item) {
		
		// Prevent the item to be moved by the user
		this.locked = false

		// Attached item
		this.item = item

		this.$element = document.createElement('div')
		this.$element.classList.add('item')
		this.$element.innerHTML = item.toString()
		
	}

}