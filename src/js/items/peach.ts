import game from '../game'
import Item from '../item'
import Eatable from './interfaces/eatable'

export default class Peach extends Item implements Eatable {

	public readonly name: string = 'Peach'

	constructor() {
		
		super(
			game.data.models.peach.geometry,
			game.data.models.peach.materials
		)

	}

}