import game from './game'
import ItemUI from './ui/item-ui'
import * as UUID from 'uuid'

export default class Item {

	public readonly uuid: string

	public readonly name: string

	private _ui: ItemUI

	constructor(name: string = '?') {
		
		this.uuid = UUID.v4()
		this.name = name
		this._ui = null
		
		game.items[this.uuid] = this

	}
	
	public get ui() {
		
		if (this._ui === null) this._ui = new ItemUI(this)
		
		return this._ui
		
	}

	public toString() {

		return this.name

	}

}