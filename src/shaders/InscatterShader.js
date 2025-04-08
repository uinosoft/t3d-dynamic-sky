import { AtmosphereCommon } from './chunks/AtmosphereCommon.js';
import { PrecomputeCommon } from './chunks/PrecomputeCommon.js';
import { InscatterCompute } from './chunks/InscatterCompute.js';
import { TransmittanceLookup } from './chunks/TransmittanceLookup.js';

export const InscatterShader = {
	name: 'sky_inscatter',
	defines: {},
	uniforms: {
		_Transmittance: null,
		betaR: [5.8e-3, 1.35e-2, 3.31e-2, 1],
		layer: 0
	},
	vertexShader: `
        attribute vec3 a_Position;
        attribute vec2 a_Uv;
           
        uniform mat4 u_ProjectionView;
        uniform mat4 u_Model;

        varying vec2 v_Uv;

        void main() {
            v_Uv = a_Uv;
            gl_Position = u_ProjectionView * u_Model * vec4(a_Position, 1.0);
        }
    `,
	fragmentShader: `
		${PrecomputeCommon}
        ${AtmosphereCommon}

		uniform sampler2D _Transmittance;

		#ifdef INSCATTER_3D
			uniform float layer;
		#endif

        varying vec2 v_Uv;

		${TransmittanceLookup}
		${InscatterCompute} 
        
        void main() {
			vec2 uv = v_Uv;

			const vec4 SCATTERING_TEXTURE_SIZE = vec4(
				RES_NU - 1.,
				RES_MU_S,
				RES_MU,
				RES_R_TOTAL
			);

			float fragCoordNu = floor(gl_FragCoord.x / RES_MU_S);
			float fragCoordMuS = mod(gl_FragCoord.x, RES_MU_S);

			#ifdef INSCATTER_3D
				float fragCoordY = gl_FragCoord.y;
			#else
				#if ALTITUDE_LAYERS > 1
					float layerIndex = floor(gl_FragCoord.y / RES_MU);
					float layer = pow(2., layerIndex) - 1.0;
					float fragCoordY = mod(gl_FragCoord.y, RES_MU);
				#else
					float layer = 1.0;
					float fragCoordY = gl_FragCoord.y;
				#endif
			#endif

			float fragCoordZ = GetTextureCoordFromUnitRange(layer, RES_R_TOTAL);

			vec4 uvwz = vec4(fragCoordNu, fragCoordMuS, fragCoordY, fragCoordZ) / SCATTERING_TEXTURE_SIZE;
			
            float r, mu, muS, nu;
            GetRMuMuSNuFromScatteringUvwz(uvwz, r, mu, muS, nu);

			vec3 ray;
            float mie; // only calc the red channel
            ComputeSingleScattering(r, mu, muS, nu, ray, mie);
            
            // store only red component of single Mie scattering (cf. 'Angular precision')
            gl_FragColor = vec4(ray, mie);
        }
    `
};