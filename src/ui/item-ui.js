export default class ItemUI {

	/**
	 * @param <Item> item
	 */
	constructor(item) {
		
		// Prevent the item to be moved by the user
		this.locked = false

		// Attached item
		this.item = item
		
		// Space filled with this item
		this._space = null

		this.$ = document.createElement('div')
		this.$.classList.add('item')
		this.$.innerHTML = item.toString()
		
		this.$.setAttribute('draggable', 'true')
		
		this.$.addEventListener('dragstart', event => this.onDragStart(event))
		this.$.addEventListener('dragend', event => this.onDragEnd(event))
		
	}
	
	onDragStart(event) {
		
		const image = new Image
		image.src = './images/leaf.svg'
		
		event.dataTransfer.dropEffect = 'move'
		event.dataTransfer.effectAllowed = 'move'
		event.dataTransfer.setDragImage(image, 30, 30)
		
		event.dataTransfer.setData('application/x-solaria-item', this.item.uuid)
		
		this.$.classList.add('dragged')
		
	}
	
	onDragEnd(event) {
		
		this.$.classList.remove('dragged')
		
	}
	
	/**
	 * @param <ItemSpaceUI> newSpace
	 */
	set space(newSpace) {
		
		const oldSpace = this._space
		
		if (oldSpace !== null && oldSpace !== newSpace) {
			
			oldSpace.item = null
			
			// TODO move item visually
			
		}
		
		this._space = newSpace
		
	} 
	
}