import game from '../game'
import Item from '../item'

export default class ItemIconSpace {

	public item: Item

	public $: Element

	/**
	 */
	constructor() {
		
		this.$ = document.createElement('div')
		this.$.classList.add('space')
		
		this.onDragOver = this.onDragOver.bind(this)
		this.onDrop = this.onDrop.bind(this)
		
		this.$.addEventListener('dragover', event => this.onDragOver(event))
		this.$.addEventListener('drop', event => this.onDrop(event))
		
	}
	
	onDragOver(event) {
		
		event.preventDefault()
		event.dataTransfer.dropEffect = 'move'
	
	}
	
	onDrop(event) {
		
		const uuid = event.dataTransfer.getData('application/x-solaria-item')
		
		if (uuid) {
		
			const droppedItem = Item.getByUUID(uuid)
			
			if (droppedItem) {
				
		 		event.preventDefault()
		 		
		 		const remoteSpace = droppedItem.icon.space

		 		if (!this.isEmpty && remoteSpace) {
		 			
		 			remoteSpace.removeItem()
		 			remoteSpace.appendItem(this.item, 'translate')

		 		}
		 		
	 			this.appendItem(droppedItem)
		 		
			}
			
			else throw new Error("Impossible to find an item with this UUID: " + uuid)
		
		}
	
		else console.error("This isn't an item")
		
	}

	appendItem(newItem: Item, animation: string = 'drop') {
		
		const remoteSpace = newItem.icon.space

		switch (animation) {

			case 'translate':

				if (!remoteSpace) throw new Error("Can't translate from non existant space")

				else {

					const {
						offsetWidth,
						offsetHeight,
						offsetLeft,
						offsetTop
					} = newItem.icon.$

					remoteSpace.removeItem()

					newItem.icon
					
				}


				break

			case 'drop':
			default:
				
				if (remoteSpace) remoteSpace.removeItem()

				break

		}
		
		this.$.appendChild(newItem.icon.$)
		this.item = newItem
		newItem.icon.space = this
		
	}

	removeItem(): Item {
		
		if (!this.isEmpty) {
			
			const removedItem = this.item

			this.$.removeChild(this.item.icon.$)
			this.item.icon.space = null
			this.item = null

			return removedItem
			
		}

		else throw new Error('ItemSpace is already empty')
		
	}
	
	get isEmpty(): boolean {
		
		return !this.item
		
	}
	
}