import game from '../game'

export default class ItemSpaceUI {

	/**
	 */
	constructor() {
		
		// Attached item
		this.item = null

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
		
			const droppedItem = game.items[uuid]
			
			if (droppedItem) {
				
		 		event.preventDefault()
		 		
		 		const remoteSpace = droppedItem.ui.space

		 		if (!this.isEmpty && remoteSpace) {
		 			
		 			remoteSpace.removeItem()
		 			remoteSpace.appendItem(this.item, 'translate')

		 		}
		 		
	 			this.appendItem(droppedItem)
		 		
			}
			
			else throw new Error("Impossible to find an item with this UUID", uuid)
		
		}
	
		else console.log("This isn't an item")
		
	}

	/**
	 * @param <Item> item
	 * @param <String> animation = drop|translate
	 */
	appendItem(newItem, animation = 'drop') {
		
		// Fill with an item
		if (!this.locked) {
			
			const remoteSpace = newItem.ui.space

			switch (animation) {

				case 'translate':

					if (!remoteSpace) throw new Error("Can't translate from non existant space")

					else {

						const {
							offsetWidth,
							offsetHeight,
							offsetLeft,
							offsetTop
						} = newItem.ui.$

						remoteSpace.removeItem()

						newItem.ui
						
					}


					break

				case 'drop':
				default:
					
					if (remoteSpace) remoteSpace.removeItem()

					break

			}
			
			this.$.appendChild(newItem.ui.$)
			this.item = newItem
			newItem.ui.space = this
			
		}
		
		else if (this.locked) throw Error("ItemSpace is locked")
		
	}

	removeItem() {
		
		if (!this.isEmpty) {
			
			const removedItem = this.item

			this.$.removeChild(this.item.ui.$)
			this.item.ui.space = null
			this.item = null

			return removedItem
			
		}

		else throw new Error('ItemSpace is already empty')
		
	}
	
	get isEmpty() {
		
		return !this.item
		
	}
	
}