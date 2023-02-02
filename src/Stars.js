import * as t3d from 't3d';
import { StarsShader } from "./shaders/StarsShader.js";

export class Stars extends t3d.Mesh {

	// Note: To improve performance, we sort stars by brightness and remove less important stars.
	// 6.225e-2f  0.06225 	 // 1024 predefined stars.
	// 3.613e-2f  0.03613	 // 2047 predefined stars.
	// 2.0344e-2f  0.020344	 // 4096 predefined stars.
	constructor(starsArray, threshold = 0.06225) {
		const material = new t3d.ShaderMaterial(StarsShader);
		material.transparent = true;
		material.blending = t3d.BLEND_TYPE.ADD;
		// material.blending = t3d.BLEND_TYPE.CUSTOM;
		// material.blendDst = t3d.BLEND_FACTOR.ONE_MINUS_DST_ALPHA;
		// material.blendSrc = t3d.BLEND_FACTOR.ONE_MINUS_SRC_ALPHA;
		material.depthWrite = false;
		material.drawMode = t3d.DRAW_MODE.POINTS;

		const starsNumber = 9110;

		const positions = [];
		const colors = [];

		for (let i = 0; i < starsNumber; i++) {
			_vec3_1.x = starsArray[i * 6 + 0];
			_vec3_1.z = starsArray[i * 6 + 1];
			_vec3_1.y = starsArray[i * 6 + 2]; // Z-up to Y-up

			_vec3_2.fromArray(starsArray, i * 6 + 3);
			const magnitude = _vec3_2.getLength(); // Using Vector3.getLength term to sort the brightness of star magnitude

			if (magnitude < threshold) continue;

			if (magnitude > 2.7) { // 5.7 fix an over bright star (Sirius)?
				_vec4_1.set(_vec3_2.x, _vec3_2.y, _vec3_2.z, magnitude).normalize().multiplyScalar(0.5);
			} else {
				_vec4_1.set(_vec3_2.x, _vec3_2.y, _vec3_2.z, magnitude);
			}

			positions.push(_vec3_1.x, _vec3_1.y, _vec3_1.z);
			colors.push(_vec4_1.x, _vec4_1.y, _vec4_1.z, _vec4_1.w);
		}

		const geometry = new t3d.Geometry();
		const positionAttribute = new t3d.Attribute(new t3d.Buffer(new Float32Array(positions), 3));
		geometry.addAttribute('a_Position', positionAttribute);
		const colorAttribute = new t3d.Attribute(new t3d.Buffer(new Float32Array(colors), 4));
		geometry.addAttribute('a_Color', colorAttribute);

		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();

		super(geometry, material);

		this.frustumCulled = false;
	}

}

const _vec3_1 = new t3d.Vector3();
const _vec3_2 = new t3d.Vector3();
const _vec4_1 = new t3d.Vector4();