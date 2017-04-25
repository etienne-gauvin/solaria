import game from '../game'
import Item from '../item'
import ItemSpaceUI from './item-space-ui'

export default class ItemUI {

	public item: Item

	public space: ItemSpaceUI

	public $: HTMLElement

	/**
	 */
	constructor(item: Item) {

		this.item = item
		
		this.$ = document.createElement('div')
		this.$.classList.add('item')
		this.$.innerHTML = item.toString()
		
		this.$.setAttribute('data-uuid', this.item.uuid)
		this.$.setAttribute('draggable', 'true')
		
		//this.$.style.backgroundColor = `hsl(${game.chance.integer({min: 0, max: 360})}, 100%, 50%)`
		
		this.$.addEventListener('dragstart', event => this.onDragStart(event))
		this.$.addEventListener('dragend', event => this.onDragEnd(event))

		this.$.addEventListener('animationend', (event: AnimationEvent) => {
			
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

	animateTranslationTo(space: ItemSpaceUI) {



	}
	
}