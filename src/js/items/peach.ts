import game from '../game'
import Item from '../item'
import Eatable from './interfaces/eatable'

export default class Peach extends Item implements Eatable {

	constructor() {
		super({
			name: 'Peach',
			geometry: game.data.models.peach.geometry,
			materials: game.data.models.peach.materials
		})
	}

	//geometry = game.data.models.peach.geometry

	//materials = game.data.models.peach.materials

}