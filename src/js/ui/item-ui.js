import game from '../game'

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
		this.space = null

		this.$ = document.createElement('div')
		this.$.classList.add('item')
		this.$.innerHTML = item.toString()
		
		this.$.setAttribute('data-uuid', this.item.uuid)
		this.$.setAttribute('draggable', 'true')
		
		//this.$.style.backgroundColor = `hsl(${game.chance.integer({min: 0, max: 360})}, 100%, 50%)`
		
		this.$.addEventListener('dragstart', event => this.onDragStart(event))
		this.$.addEventListener('dragend', event => this.onDragEnd(event))

		this.$.addEventListener('animationend', event => {
			
			if (event.animationName === 'appears') {

				this.$.classList.remove(event.animationName)
				
			}

		})
		
	}
	
	onDragStart(event) {
		
		const image = new Image
		image.src = '../images/leaf.svg'
		
		event.dataTransfer.dropEffect = 'move'
		event.dataTransfer.effectAllowed = 'move'
		event.dataTransfer.setDragImage(image, 30, 30)
		
		event.dataTransfer.setData('application/x-solaria-item', this.item.uuid)
		
		this.$.classList.add('dragged')
		
	}
	
	onDragEnd(event) {
		
		this.$.classList.remove('dragged')
		
	}

	appears() {

		this.$.classList.add('appears')

	}

	/**
	 * @param <ItemSpaceUI> space
	 */
	animateTranslationTo(space) {



	}
	
}