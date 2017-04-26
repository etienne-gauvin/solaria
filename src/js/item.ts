import game from './game'
import ItemUI from './ui/item-ui'
import * as UUID from 'uuid'
import * as THREE from 'three'

abstract class Item extends THREE.SkinnedMesh {
	
	private static items: { [key: string]: Item } = {}

	public readonly uuid: string

	public readonly name: string

	private _ui: ItemUI

	constructor() {
		
		super()
		
		this.uuid = UUID.v4()
		this.name = this.name
		this._ui = null
		
		Item.items[this.uuid] = this

	}
	
	public get ui() {
		
		if (this._ui === null) this._ui = new ItemUI(this)
		
		return this._ui
		
	}

	public toString() {

		return this.name

	}
	
	public static getByUUID(uuid: string): Item {
		
		return this.items[uuid]
		
	}

}

export default Item