import game from '../game'
import Item from '../item'
import ItemIconSpace from './item-icon-space'

export default class ItemIcon {

	public item: Item

	public space: ItemIconSpace

	public $: HTMLElement

	/**
	 */
	constructor(item: Item) {

		this.item = item
		
	}

	createHTMLElement() {

		if (!this.$) {

			const $ = document.createElement('div')
			$.classList.add('item')
			$.innerHTML = this.item.toString()
			
			$.setAttribute('data-uuid', this.item.uuid)
			$.setAttribute('data-name', this.item.name)
			$.setAttribute('draggable', 'true')
			
			//$.style.backgroundColor = `hsl(${game.chance.integer({min: 0, max: 360})}, 100%, 50%)`
			
			$.addEventListener('dragstart', event => this.onDragStart(event))
			$.addEventListener('dragend', event => this.onDragEnd(event))

			$.addEventListener('animationend', (event: AnimationEvent) => {
				
				if (event.animationName === 'appears') {

					$.classList.remove(event.animationName)
					
				}

			})

			this.$ = $

		}
		
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

	animateTranslationTo(space: ItemIconSpace) {

		

	}
	
}