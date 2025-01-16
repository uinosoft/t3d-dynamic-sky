import {
	BoxGeometry,
	DRAW_SIDE,
	Mesh,
	ShaderMaterial
} from 't3d';
import { NoiseCloudsShader } from './shaders/NoiseCloudsShader.js';

export class NoiseClouds extends Mesh {

	constructor() {
		const geometry = new BoxGeometry(1, 1, 1);

		const material = new ShaderMaterial(NoiseCloudsShader);
		material.side = DRAW_SIDE.BACK;
		material.transparent = true;

		super(geometry, material);

		this.frustumCulled = false;
	}

}