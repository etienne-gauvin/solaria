import game from '../game'
import UUID from 'uuid'

export default class ItemSpaceUI {

	/**
	 */
	constructor() {
		
		this.uuid = UUID.v4()
		
		// Prevent the space to be filled
		this.locked = false

		// Attached item
		this.item = null

		this.$ = document.createElement('div')
		this.$.classList.add('space')
		
		this.$.setAttribute('data-uuid', this.uuid)

		this.onDragOver = this.onDragOver.bind(this)
		this.onDrop = this.onDrop.bind(this)
		
		this.$.addEventListener('dragover', event => this.onDragOver(event))
		this.$.addEventListener('drop', event => this.onDrop(event))
		
	}
	
	onDragOver(event) {
		
		if (!this.locked) {
			
			event.preventDefault()
 			event.dataTransfer.dropEffect = 'move'
		
		}
		
	}
	
	onDrop(event) {
		
		const uuid = event.dataTransfer.getData('application/x-solaria-item')
		
		if (uuid) {
		
			const item = game.items[uuid]
			
			if (item && !this.locked) {
				
		 		event.preventDefault()
		 		
		 		console.log(this.item, item.ui.space)
		 		
		 		if (this.item && item.ui.space) {
		 			
		 			ItemSpaceUI.exchange(this, item.ui.space)
		 			
		 		}
		 		
		 		else {
		 			
		 			this.fillWith(item)
		 			
		 		}
		 		
			}
			
			else throw new Error("Impossible to find an item with this UUID", uuid)
		
		}
	
		else console.log("This isn't an item")
		
	}

	static exchange(spaceA, spaceB) {
		
		const itemA = spaceA.item
		const itemB = spaceB.item
		
		spaceA.empty()
		spaceB.empty()
		
		spaceA.fillWith(itemB)
		spaceB.fillWith(itemA)
		
	}
	
	fillWith(newItem, allowExchange = true) {
		
		// Fill with an item
		if (!this.locked) {
			
			if (newItem.ui.space) newItem.ui.space.empty()
			
			this.$.appendChild(newItem.ui.$)
			this.item = newItem
			newItem.ui.space = this
			
		}
		
		else throw Error("Can't fill the ItemSpace with the Item")
		
	}

	empty() {
		
		if (!this.isEmpty) {
			
			this.$.removeChild(this.item.ui.$)
			this.item.ui.space = null
			this.item = null
			
			console.log('emptying', this)
			
		}
		
	}
	
	get isEmpty() {
		
		return !this.item
		
	}
	
}