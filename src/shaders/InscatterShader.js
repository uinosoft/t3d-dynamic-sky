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

			#ifndef INSCATTER_3D
				float layer;
				if (RES_R > 1.) {
					float layerIndex = floor(uv.y * RES_R);
					layerIndex = clamp(layerIndex, 0., RES_R - 1.);
					layer = pow(2., layerIndex);

					uv.y = uv.y * RES_R - layerIndex;
					uv.y = clamp(uv.y, 0., 1.);

					if (layerIndex < 0.5) {
						layer = 0.0;
					}
				} else {
					layer = 1.;
				}
			#endif

			float z = layer / max((RES_R_TOTAL - 1.0), 1.0);
			vec3 uvw = vec3(uv, z);
			
            float r, mu, muS, nu;
            GetRMuMuSNuFromScatteringUvw(uvw, r, mu, muS, nu);

			vec3 ray;
            float mie; // only calc the red channel
            ComputeSingleScattering(r, mu, muS, nu, ray, mie);
            
            // store only red component of single Mie scattering (cf. 'Angular precision')
            gl_FragColor = vec4(ray, mie);
        }
    `
};