import game from './game'
import Sky from './sky'
import * as THREE from 'three'

export abstract class Scene extends THREE.Scene {

	public constructor() {

		super()

	}

	public load() {



	}


	public update(event) {

	}

}

export abstract class ExteriorScene extends Scene {

	protected readonly sky: Sky = new Sky

	public constructor() {

		super()

		this.background = this.sky.color

	}


	public update(event) {

		super.update(event)
		
		this.sky.update(event)

	}

}

export abstract class InteriorScene extends Scene {



}