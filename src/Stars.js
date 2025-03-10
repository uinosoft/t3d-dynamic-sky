import { Mesh, ShaderMaterial, BLEND_TYPE, DRAW_MODE, Vector3, Vector4, Geometry, Attribute, Buffer } from 't3d';

/**
 * Stars is a class to create a star field.
 */
export class Stars extends Mesh {

	/**
	 * Creates a new Stars instance.
	 * @param {Array} starsArray - The stars array. Each star is represented by 6 values: x, y, z, r, g, b.
	 * @param {Object|Number} [options={}] - The options object or the threshold value.
	 * @param {Number} [options.brightMax=0.8] - The maximum brightness value.
	 */
	constructor(starsArray, options = {}) {
		if (typeof options === 'number') options = {};
		options.brightMax = options.brightMax !== undefined ? options.brightMax : 0.8;

		const geometry = new StarsGeometry();
		geometry.setPoints(starsArray, options);

		const material = new ShaderMaterial(starsShader);
		material.transparent = true;
		material.blending = BLEND_TYPE.ADD;
		material.depthWrite = false;
		material.drawMode = DRAW_MODE.POINTS;

		super(geometry, material);

		this.frustumCulled = false;
	}

}

const _vec3_1 = new Vector3();
const _vec3_2 = new Vector3();
const _vec4_1 = new Vector4();

class StarsGeometry extends Geometry {

	setPoints(starsArray, { brightMax = 0.8 } = {}) {
		const starsNumber = starsArray.length / 6;

		const positions = new Float32Array(starsNumber * 3);
		const colors = new Float32Array(starsNumber * 4);

		for (let i = 0; i < starsNumber; i++) {
			_vec3_1.fromArray(starsArray, i * 6);
			_vec3_2.fromArray(starsArray, i * 6 + 3);

			let magnitude = _vec3_2.getLength(); // Using Vector3.getLength term to sort the brightness of star magnitude

			if (magnitude > brightMax) { // clamp over bright stars
				_vec3_2.multiplyScalar(brightMax / magnitude);
				magnitude = brightMax;
			}

			_vec4_1.set(_vec3_2.x, _vec3_2.y, _vec3_2.z, magnitude);

			_vec3_1.toArray(positions, i * 3);
			_vec4_1.toArray(colors, i * 4);
		}

		this.addAttribute('a_Position', new Attribute(new Buffer(positions, 3)));
		this.addAttribute('a_Color', new Attribute(new Buffer(colors, 4)));

		this.version++;

		// We don't need to compute bounding box and sphere for stars.
		// this.computeBoundingBox();
		// this.computeBoundingSphere();
	}

}

const starsShader = {
	name: 'sky_stars',
	uniforms: {
		starDistance: 1000,
		starIntensity: 40,
		heightFalloff: 0.5,
		starSize: 10,
		time: 0,
		radiusFactor: 0.4
	},
	vertexShader: `
        attribute vec3 a_Position;
		attribute vec4 a_Color;

		uniform mat4 u_ProjectionView;
		uniform mat4 u_Model;
		uniform vec3 u_CameraPosition;

		uniform float starDistance;
		uniform float starIntensity;
		uniform float heightFalloff;
		uniform float starSize;
		uniform float time;

		varying vec4 vColor;

		const vec2 tab[8] = vec2[8](
			vec2(0.897907815, -0.347608525),
			vec2(0.550299290, 0.273586675),
			vec2(0.823885965, 0.098853070),
			vec2(0.922739035, -0.122108860),
			vec2(0.800630175, -0.088956800),
			vec2(0.711673375, 0.158864420),
			vec2(0.870537795, 0.085484560),
			vec2(0.956022355, -0.058114540)
		);

		float GetFlickerAmount(vec2 pos) {
			vec2 hash = fract(pos.xy * 256.0);
			float index = fract(hash.x + (hash.y + 1.0) * time); // flickering
			index *= 8.0;
	
			float f = fract(index) * 2.5;
			int i = int(index);

			return tab[i].x + f * tab[i].y;
		}

		void main() {
			vec3 worldDirection = normalize((u_Model * vec4(a_Position.xyz, 1.0)).xyz);

			gl_Position = u_ProjectionView * vec4(worldDirection * starDistance + u_CameraPosition.xyz, 1.0);

			float appMag = 6.5 + a_Color.w * (-1.44 - 1.5);
			float brightness = GetFlickerAmount(a_Position.xy) * pow(5.0, (-appMag - 1.44) / 2.5);

			vColor = smoothstep(0.0, heightFalloff, worldDirection.y) * starIntensity * brightness * vec4(a_Color.xyz, 1.0);
			
			gl_PointSize = starSize;
		}
    `,
	fragmentShader: `
		uniform float radiusFactor;

        varying vec4 vColor;

        void main() {
            vec2 distCenter = 2.0 * gl_PointCoord - vec2(1.0);
            float scale = exp(-dot(distCenter, distCenter) * 10.24 * radiusFactor);

            vec3 col = vColor.xyz * scale + 5.0 * vColor.w * pow(scale, 10.0);

            gl_FragColor = vec4(col, 1.0);
        }
    `
};