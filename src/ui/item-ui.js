export default class ItemUI {

	/**
	 * @param <Item> item
	 */
	constructor(item) {
		
		// Prevent the item to be moved by the user
		this.locked = false

		// Attached item
		this.item = item

		this.$ = document.createElement('div')
		this.$.classList.add('item')
		this.$.setAttribute('draggable', 'true')
		this.$.innerHTML = item.toString()
		
	}

}