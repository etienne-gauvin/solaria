import game from './game'
import Ground from './ground'

export abstract class Map {

	protected grounds: Array<Ground>

}

export abstract class Exterior extends Map {



}

export abstract class Interior extends Map {



}