import * as t3d from 't3d';
import { SkyDomeData } from "./SkyDomeData.js";
import { CloudsShader } from "./shaders/CloudsShader.js";

export class Clouds extends t3d.Mesh {

	constructor() {
		const material = new t3d.ShaderMaterial(CloudsShader);
		material.transparent = true;
		material.depthWrite = false;

		super(geometry, material);

		this.frustumCulled = false;
	}

}

const geometry = new t3d.Geometry();
geometry.setIndex(new t3d.Attribute(new t3d.Buffer(
	(SkyDomeData.vertices.length / 3) > 65536 ? new Uint32Array(SkyDomeData.triangles) : new Uint16Array(SkyDomeData.triangles), 1
)));
geometry.addAttribute('a_Position', new t3d.Attribute(new t3d.Buffer(new Float32Array(SkyDomeData.vertices), 3)));
geometry.addAttribute('a_Normal', new t3d.Attribute(new t3d.Buffer(new Float32Array(SkyDomeData.normals), 3)));
geometry.addAttribute('a_Tangent', new t3d.Attribute(new t3d.Buffer(new Float32Array(SkyDomeData.tangents), 4)));
geometry.addAttribute('a_Uv', new t3d.Attribute(new t3d.Buffer(new Float32Array(SkyDomeData.UV0), 2)));

geometry.computeBoundingBox();
geometry.computeBoundingSphere();