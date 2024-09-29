import * as t3d from 't3d';
import { StarsShader } from './shaders/StarsShader.js';

/**
 * Stars is a mesh that represents the stars in the sky.
 */
export class Stars extends t3d.Mesh {

	/**
	 * Creates a new Stars instance.
	 * @param {Array} starsArray - The stars array. Each star is represented by 6 values: x, y, z, r, g, b.
	 * @param {Object|Number} [options] - The options object or the threshold value.
	 * @param {Number} [options.brightThreshold=0.06225] - The threshold to remove less important stars.
	 * @param {Number} [options.brightMax=0.8] - The maximum brightness value.
	 * @param {Boolean} [options.zUp=true] - Whether the z coordinate is up in the stars array.
	 */
	constructor(starsArray, options = {}) {
		if (typeof options === 'number') options = { brightThreshold: options };

		// Default options values are compatible with the real stars data `StarsData.bytes` provided in examples.
		// Note: To improve performance, we check stars by brightness and remove less important stars.
		// 6.225e-2f  0.06225 	 // 1024 predefined stars.
		// 3.613e-2f  0.03613	 // 2047 predefined stars.
		// 2.0344e-2f  0.020344	 // 4096 predefined stars.
		options.brightThreshold = options.brightThreshold !== undefined ? options.brightThreshold : 0.06225;
		options.brightMax = options.brightMax !== undefined ? options.brightMax : 0.8;
		options.zUp = options.zUp !== undefined ? options.zUp : true;

		const geometry = new StarsGeometry();
		geometry.setPoints(starsArray, options);

		const material = new t3d.ShaderMaterial(StarsShader);
		material.transparent = true;
		material.blending = t3d.BLEND_TYPE.ADD;
		material.depthWrite = false;
		material.drawMode = t3d.DRAW_MODE.POINTS;

		super(geometry, material);

		this.frustumCulled = false;
	}

}

const _vec3_1 = new t3d.Vector3();
const _vec3_2 = new t3d.Vector3();
const _vec4_1 = new t3d.Vector4();

function copyToVector3ZUp(array, index, vector) {
	vector.x = array[index];
	vector.y = array[index + 2];
	vector.z = array[index + 1];
}

class StarsGeometry extends t3d.Geometry {

	setPoints(starsArray, { brightThreshold = 0.06225, brightMax = 0.8, zUp = false } = {}) {
		const starsNumber = starsArray.length / 6;

		const positions = [];
		const colors = [];

		for (let i = 0; i < starsNumber; i++) {
			zUp ? copyToVector3ZUp(starsArray, i * 6, _vec3_1) : _vec3_1.fromArray(starsArray, i * 6);

			_vec3_2.fromArray(starsArray, i * 6 + 3);
			let magnitude = _vec3_2.getLength(); // Using Vector3.getLength term to sort the brightness of star magnitude

			if (magnitude < brightThreshold) continue;

			if (magnitude > brightMax) { // clamp over bright stars
				_vec3_2.multiplyScalar(brightMax / magnitude);
				magnitude = brightMax;
			}

			_vec4_1.set(_vec3_2.x, _vec3_2.y, _vec3_2.z, magnitude);

			positions.push(_vec3_1.x, _vec3_1.y, _vec3_1.z);
			colors.push(_vec4_1.x, _vec4_1.y, _vec4_1.z, _vec4_1.w);
		}

		const positionAttribute = new t3d.Attribute(new t3d.Buffer(new Float32Array(positions), 3));
		this.addAttribute('a_Position', positionAttribute);
		const colorAttribute = new t3d.Attribute(new t3d.Buffer(new Float32Array(colors), 4));
		this.addAttribute('a_Color', colorAttribute);

		this.version++;

		// We don't need to compute bounding box and sphere for stars.
		// this.computeBoundingBox();
		// this.computeBoundingSphere();
	}

}