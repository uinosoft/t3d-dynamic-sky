export const NoiseCloudsShader = {
	name: 'noise_clouds',
	uniforms: {
		noiseTexture: null,
		noiseTextureSize: [256, 256],

		time: 0.,

		cloudColor: [1, 1, 1],
		cloudDensity: [0.9, 0.0],
		cloudRange: [0.5, 0.8],
		cloudHeight: [0.0, 0.4],
		cloudScale: 1.0,
		cloudSpeed: [2.0, 2.0]
	},
	vertexShader: `
		#include <common_vert>

		varying vec3 vDir;

		mat4 clearMat4Translate(mat4 m) {
			mat4 outMatrix = m;
			outMatrix[3].xyz = vec3(0., 0., 0.);
			return outMatrix;
		}

		void main() {
			mat4 modelMatrix = clearMat4Translate(u_Model);
			mat4 viewMatrix = clearMat4Translate(u_View);

			vDir = normalize((modelMatrix * vec4(a_Position, 0.0)).xyz);

			gl_Position = u_Projection * viewMatrix * modelMatrix * vec4(a_Position, 1.0);
			gl_Position.z = gl_Position.w;
		}
	`,
	fragmentShader: `
		varying vec3 vDir;

		uniform sampler2D noiseTexture;
		uniform vec2 noiseTextureSize;

		uniform float time;

		uniform vec3 cloudColor;
		uniform vec2 cloudDensity;
		uniform vec2 cloudRange;
		uniform vec2 cloudHeight;
		uniform float cloudScale;
        uniform vec2 cloudSpeed;

		const mat2 m2 = mat2(0.60, -0.80, 0.80, 0.60);

		float clouds(vec3 rd) {
			float t = time * 0.01 * cloudSpeed.x;
			vec2 p = rd.xz / rd.y;

			float f = 0.;
			float s = 1.;
			float w = 0.;

			for(int i = 0; i < 5; i++) {
            	p += t;
                t *= cloudSpeed.y;

                f += s * texture2D(noiseTexture, p / noiseTextureSize * cloudScale).x;
				w += s;

                p *= m2 * 2.02;
                s *= 0.6;
            }
			
            float val = (f / w) * cloudDensity.x + cloudDensity.y;

            val = smoothstep(cloudRange.x, cloudRange.y, val);

            return val * smoothstep(cloudHeight.x, cloudHeight.y, rd.y);
		}

		void main() {
    		float cloudAlpha = clouds(normalize(vDir));
			gl_FragColor = vec4(cloudColor, cloudAlpha);
		}
	`
};