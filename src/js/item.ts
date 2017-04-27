import game from './game'
import ItemIcon from './ui/item-icon'
import * as UUID from 'uuid'
import * as THREE from 'three'

abstract class Item extends THREE.SkinnedMesh {
	
	private static items: { [key: string]: Item } = {}

	public readonly uuid: string = UUID.v4()

	public readonly name: string = 'Item'

	public readonly icon: ItemIcon = new ItemIcon(this)

	constructor(data: { name: string, geometry: THREE.Geometry, materials: Array<THREE.Material> }) {
		
		super(data.geometry, new THREE.MultiMaterial(data.materials))

		Item.items[this.uuid] = this

	}
	
	public toString() {

		return this.name

	}
	
	public static getByUUID(uuid: string): Item {
		
		return this.items[uuid]
		
	}

}

export default Item