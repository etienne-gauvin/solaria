import Item from '../item'
import game from '../game'

export default class Peach extends Item {

	name = 'Peach'

	geometry = game.data.models.peach.geometry
	
	materials = game.data.models.peach.materials

}