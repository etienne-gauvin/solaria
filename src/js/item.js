import game from './game'
import ItemUI from './ui/item-ui'
import UUID from 'uuid'

export default class Item {

	constructor(name = '?') {
		
		this.uuid = UUID.v4()
		this.name = name
		this._ui = null
		
		game.items[this.uuid] = this

	}
	
	get ui() {
		
		if (this._ui === null) this._ui = new ItemUI(this)
		
		return this._ui
		
	}

	toString() {

		return this.name

	}

}