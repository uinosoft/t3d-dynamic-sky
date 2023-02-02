import { AtmosphereCommon } from "./AtmosphereCommon.js";

export const TransmittanceShader = {
	name: 'sky_transmittance',
	defines: {},
	uniforms: {
		betaR: [5.8e-3, 1.35e-2, 3.31e-2, 1],
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
        varying vec2 v_Uv;
        
        ${AtmosphereCommon}
        
        // pixel shader entry point
        // ---------------------------------------------------------------------------- 
        // TRANSMITTANCE FUNCTIONS   equ 2-6
        // ----------------------------------------------------------------------------

        float OpticalDepth(float H, float r, float mu) { 
            float result = 0.0; 
            float dx = Limit(r, mu) / float(TRANSMITTANCE_INTEGRAL_SAMPLES); 
            float xi = 0.0; 
            float yi = exp(-(r - Rg) / H); 
            
            for (int i = 1; i <= TRANSMITTANCE_INTEGRAL_SAMPLES; ++i) { 
                float i_float = float(i);
                float xj = i_float * dx; 
                float yj = exp(-(sqrt(r * r + xj * xj + 2.0 * xj * r * mu) - Rg) / H);
                result += (yi + yj) / 2.0 * dx;
                xi = xj;
                yi = yj; 
            }
            
            return mu < -sqrt(1.0 - (Rg / r) * (Rg / r)) ? 1e9 : result; 
        } 
        
        void GetTransmittanceRMu(vec2 coord, out float r, out float muS) { 
            r = coord.y; 
            muS = coord.x;
            #ifdef TRANSMITTANCE_NON_LINEAR 
                r = Rg + (r * r) * (Rt - Rg); 
                muS = -0.15 + tan(1.5 * muS) / tan(1.5) * (1.0 + 0.15); 
            #else
                r = Rg + r * (Rt - Rg); 
                muS = -0.15 + muS * (1.0 + 0.15);
            #endif
        }
        
        void main() {
            float r, muS;
            GetTransmittanceRMu(v_Uv, r, muS); 
        
            vec3 depth = betaR.xyz * OpticalDepth(HR, r, muS) + betaMEx * OpticalDepth(HM, r, muS); 
            gl_FragColor = vec4(exp(-depth), 1.0); // Eq (5)
        }
    `
};