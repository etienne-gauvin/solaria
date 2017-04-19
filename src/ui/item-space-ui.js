import game from '../game'

export default class ItemSpaceUI {

	/**
	 */
	constructor() {
		
		// Prevent the space to be filled
		this.locked = false

		// Attached item
		this._item = null

		this.$ = document.createElement('div')
		this.$.classList.add('space')
		
		this.$.addEventListener('dragover', event => this.onDragOver(event))
		this.$.addEventListener('drop', event => this.onDrop(event))
		
	}
	
	onDragOver(event) {
		
		if (this.isEmpty) {
			
			event.preventDefault()
 			event.dataTransfer.dropEffect = 'move'
		
		}
		
	}
	
	onDrop(event) {
		
		const uuid = event.dataTransfer.getData('application/x-solaria-item')
		
		if (uuid) {
		
			const item = game.items[uuid]
			
			if (item && game.items[uuid] && this.isEmpty && !this.locked) {
				
		 		event.preventDefault()
		 		
		 		this.item = game.items[uuid]
		 		
			}
			
			else throw new Error("Impossible to find an item with this UUID", uuid)
		
		}
	
		else console.log("This isn't an item")
		
	}
	
	set item(newItem) {
		
		const oldItem = this._item
		
		// Empty the space
		if (!newItem) {
			
			if (!this.isEmpty) {
				
				this.$.removeChild(this.item.ui.$)
				this._item = null
				
			}
			
		}
		
		// Fill with an item
		else if (newItem && this.isEmpty && !this.locked) {
			
			newItem.ui.space = this
			
			this.$.appendChild(newItem.ui.$)
			this._item = newItem
			
		}
		
		else throw Error("Can't attach fill the ItemSpace with the Item")
		
	}
	
	empty() {
		
	}
	
	get isEmpty() {
		
		return !this.item
		
	}
	
}