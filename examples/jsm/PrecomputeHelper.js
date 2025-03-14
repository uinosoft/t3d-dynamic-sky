import { Attribute, Buffer, Mesh, PlaneGeometry, ShaderMaterial } from 't3d';

export class PrecomputeHelper extends Mesh {

	constructor(texture) {
		const geometry = new PlaneGeometry(1, 1);

		const layers = texture.isTexture3D ? texture.image.depth : 1;

		if (layers > 1) {
			const layerArray = new Float32Array(layers).fill(0).map((_, i) => i);
			const layerAttribute = new Attribute(new Buffer(layerArray, 1));
			layerAttribute.divisor = 1;
			geometry.addAttribute('layer', layerAttribute);
			geometry.instanceCount = layers;
		}

		const material = new ShaderMaterial(shader);
		material.defines.TEXTURE_3D = layers > 1;
		material.uniforms.uTexture = texture;

		super(geometry, material);

		this.euler.x = Math.PI / 2;

		this.frustumCulled = false;
	}

}

const shader = {
	name: 'sky_precompute_helper',
	defines: {
		TEXTURE_3D: false
	},
	uniforms: {
		uTexture: null
	},
	vertexShader: `
		attribute vec3 a_Position;
		attribute vec2 a_Uv;
			
		uniform mat4 u_ProjectionView;
		uniform mat4 u_Model;

		varying vec2 v_Uv;

		#ifdef TEXTURE_3D
			varying float layer;
		#endif

		void main() {
			v_Uv = a_Uv;

			vec3 position = a_Position;

			#ifdef TEXTURE_3D
				position.y -= float(gl_InstanceID);
				layer = float(gl_InstanceID) / 31.;
			#endif

			gl_Position = u_ProjectionView * u_Model * vec4(position, 1.0);
		}
	`,
	fragmentShader: `
		varying vec2 v_Uv;
		
		#ifdef TEXTURE_3D
			varying float layer;
		#endif

		#ifdef TEXTURE_3D
			uniform highp sampler3D uTexture;
		#else
			uniform sampler2D uTexture;
		#endif

		void main() {
            #ifdef TEXTURE_3D
				gl_FragColor = texture(uTexture, vec3(v_Uv, layer));
			#else
				gl_FragColor = texture2D(uTexture, v_Uv);
			#endif
        }
	`
};