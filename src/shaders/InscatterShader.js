import { AtmosphereCommon } from './chunks/AtmosphereCommon.js';
import { PrecomputeCommon } from './chunks/PrecomputeCommon.js';
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
        
        //----------------------------------------------------------------------------------------------------

		float GetUnitRangeFromTextureCoord(float u, float textureSize) {
			return (u - 0.5 / textureSize) / (1.0 - 1.0 / textureSize);
		}
        
        void GetRMuMuSNuFromScatteringUvw(vec3 uvw, out float r, out float mu, out float muS, out float nu) { 
            float x = uvw.x * RES_MU_S * RES_NU - 0.5;

            float xNu = floor(x / RES_MU_S) / (RES_NU - 1.0);
            float xMuS = mod(x, RES_MU_S) / (RES_MU_S - 1.0);

			float H = sqrt(Rt * Rt - Rg * Rg);
			float rho = H * GetUnitRangeFromTextureCoord(uvw.z, RES_R_TOTAL);
			r = sqrt(rho * rho + Rg * Rg);
        
            #if INSCATTER_MAPPING == 1
                if (uvw.y < 0.5) { // bottom half
					float dmin = r - Rg;
					float dmax = rho;
					float d = dmin + (dmax - dmin) * GetUnitRangeFromTextureCoord(1. - 2. * uvw.y, RES_MU / 2.0);
					mu = -(rho * rho + d * d) / (2.0 * r * d);
					// clamp
					// mu = d == 0.0 ? -1.0 : clamp(mu, -1.0, 1.0);
                    mu = min(mu, -sqrt(1.0 - (Rg / r) * (Rg / r)) - 0.001); 
                } else {
				 	float dmin = Rt - r;
					float dmax = rho + H;
					float d = dmin + (dmax - dmin) * GetUnitRangeFromTextureCoord(2. * uvw.y - 1., RES_MU / 2.0);
					mu = (H * H - rho * rho - d * d) / (2.0 * r * d);
					mu = d == 0.0 ? 1.0 : clamp(mu, -1.0, 1.0); 
                }
                // paper formula 
                // muS = -(0.6 + log(1.0 - xMuS * (1.0 -  exp(-3.6)))) / 3.0; 
                // better formula 
                muS = tan((2.0 * xMuS - 1.0 + 0.26) * 0.75) / tan(1.26 * 0.75);
            #else 
                mu = -1.0 + 2.0 * GetUnitRangeFromTextureCoord(uvw.y, RES_MU);
                muS = -0.2 + xMuS * 1.2;
            #endif

            nu = -1.0 + xNu * 2.0;
        }

        // ---------------------------------------------------------------------------- 
        // TRANSMITTANCE FUNCTIONS
        // ----------------------------------------------------------------------------
		
		${TransmittanceLookup}

        // transmittance(=transparency) of atmosphere between x and x0
        // assume segment x, x0 not intersecting ground 
        // d = distance between x and x0, mu = cos(zenith angle of [x,x0) ray at x) 
        vec3 Transmittance(float r, float mu, float d) { 
            vec3 result; 
            float r1 = sqrt(r * r + d * d + 2.0 * r * mu * d); 
            float mu1 = (r * mu + d) / r1;
            if (mu > 0.0) { 
                result = min(Transmittance(r, mu) / Transmittance(r1, mu1), 1.0); 
            } else { 
                result = min(Transmittance(r1, -mu1) / Transmittance(r, -mu), 1.0); 
            } 
        
            return result;
        }

        // ---------------------------------------------------------------------------- 
        // INSCATTER FUNCTIONS 
        // ---------------------------------------------------------------------------- 

        void Integrand(float r, float mu, float muS, float nu, float t, out vec3 ray, out float mie) { 
            ray = vec3(0.,0.,0.); 
            mie = 0.0; // single channel only
            float ri = sqrt(r * r + t * t + 2.0 * r * mu * t); 
            float muSi = (nu * t + muS * r) / (ri * mix(1.0, betaR.w, max(0.0, muS))); // added betaR.w to fix the Rayleigh Offset artifacts issue
            ri = max(Rg, ri);
            if (muSi >= -sqrt(1.0 - Rg * Rg / (ri * ri))) 
            { 
                vec3 ti = Transmittance(r, mu, t) * Transmittance(ri, muSi); 
                ray = exp(-(ri - Rg) / HR) * ti; 
                mie = exp(-(ri - Rg) / HM) * ti.x; // only calc the red channel
            }
        } 
        
        void Inscatter(float r, float mu, float muS, float nu, out vec3 ray, out float mie) { 
            ray = vec3(0., 0., 0.); 
            mie = 0.0; // single channel only
            float dx = Limit(r, mu) / float(INSCATTER_INTEGRAL_SAMPLES);
            float xi = 0.0;
            vec3 rayi;
            float miei;
            Integrand(r, mu, muS, nu, 0.0, rayi, miei);
        
            for (int i = 1; i <= INSCATTER_INTEGRAL_SAMPLES; ++i) { 
                float xj = float(i) * dx; 
                vec3 rayj; 
                float miej; 
                Integrand(r, mu, muS, nu, xj, rayj, miej); 
                
                ray += (rayi + rayj) / 2.0 * dx; 
                mie += (miei + miej) / 2.0 * dx; 
                xi = xj; 
                rayi = rayj; 
                miei = miej; 
            } 
            
            ray *= betaR.xyz; 
            mie *= betaMSca.x;
        } 
        
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
            Inscatter(r, mu, muS, nu, ray, mie); 
            
            // store only red component of single Mie scattering (cf. 'Angular precision')
            gl_FragColor = vec4(ray, mie);
        }
    `
};