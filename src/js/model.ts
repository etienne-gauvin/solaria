import * as THREE from 'three'

interface Model {
	
	src: string

	geometry?: THREE.Geometry

	materials?: Array<THREE.Material>

}

export default Model