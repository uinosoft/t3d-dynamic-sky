import * as t3d from 't3d';
import { SkyShader } from "./shaders/SkyShader.js";

export class Sky extends t3d.Mesh {

	constructor() {
		const material = new t3d.ShaderMaterial(SkyShader);
		material.depthWrite = false;
		material.side = t3d.DRAW_SIDE.BACK;

		super(new t3d.SphereGeometry(1, 100, 100), material);

		this.frustumCulled = false;
	}

}