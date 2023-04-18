import { AtmosphereCommon } from "./AtmosphereCommon.js";

export const InscatterShader = {
	name: 'sky_inscatter',
	defines: {},
	uniforms: {
		_Transmittance: null,
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
        uniform sampler2D _Transmittance;

        varying vec2 v_Uv;

        ${AtmosphereCommon}
        
        const float RES_R = 4.; 	// 3D texture depth
        const float RES_MU = 128.; 	// height of the texture
        const float RES_MU_S = 32.; // width per table
        const float RES_NU = 8.;	// table per texture depth

        const float epsion = 0.000000001;
        
        //----------------------------------------------------------------------------------------------------
        
        void GetMuMuSNu(vec2 coord, float r, vec4 dhdH, out float mu, out float muS, out float nu) { 
            float x = coord.x * float(RES_MU_S * RES_NU) - 0.5;
            float y = coord.y * float(RES_MU) - 0.5;
        
            #ifdef INSCATTER_NON_LINEAR 
                if (y < float(RES_MU) / 2.0) { // bottom half
                    float d = 1.0 - y / (float(RES_MU) / 2.0 - 1.0); 
                    d = min(max(dhdH.z, d * dhdH.w), dhdH.w * 0.999); 
                    mu = (Rg * Rg - r * r - d * d) / (2.0 * r * d); 
                    mu = min(mu, -sqrt(1.0 - (Rg / r) * (Rg / r)) - 0.001); 
                } else { 
                    float d = (y - float(RES_MU) / 2.0) / (float(RES_MU) / 2.0 - 1.0); 
                    d = min(max(dhdH.x, d * dhdH.y), dhdH.y * 0.999); 
                    mu = (Rt * Rt - r * r - d * d) / (2.0 * r * d); 
                } 
                muS = mod(x, float(RES_MU_S)) / (float(RES_MU_S) - 1.0);
                // paper formula 
                // muS = -(0.6 + log(1.0 - muS * (1.0 -  exp(-3.6)))) / 3.0; 
                // better formula 
                muS = tan((2.0 * muS - 1.0 + 0.26) * 0.75) / tan(1.26 * 0.75); 
                nu = -1.0 + floor(x / float(RES_MU_S)) / (float(RES_NU) - 1.0) * 2.0; 
            #else 
                mu = -1.0 + 2.0 * y / (float(RES_MU) - 1.0); 
                muS = mod(x, float(RES_MU_S)) / (float(RES_MU_S) - 1.0); 
                muS = -0.2 + muS * 1.2; 
                nu = -1.0 + floor(x / float(RES_MU_S)) / (float(RES_NU) - 1.0) * 2.0;
            #endif 
        }
        
        // UE4 AtmosphereRendering.cpp
        void GetLayer(float layer, out float r, out vec4 dhdH) {
            // Assign the total depth constant for "RES_R" altitude layer setting.
            const float RES_R_TOTAL = 32.;
            
            r = float(layer) / max((RES_R_TOTAL - 1.0), 1.0);
            r = r * r;
            r = sqrt(Rg * Rg + r * (Rt * Rt - Rg * Rg)) + (abs(layer - 0.) < epsion ? 0.01 : (abs(layer - RES_R_TOTAL + 1.) < epsion ? -0.001 : 0.0));
            
            float dmin = Rt - r;
            float dmax = sqrt(r * r - Rg * Rg) + sqrt(Rt * Rt - Rg * Rg);
            float dminp = r - Rg;
            float dmaxp = sqrt(r * r - Rg * Rg);
        
            dhdH = vec4(dmin, dmax, dminp, dmaxp);	
        }

        // ---------------------------------------------------------------------------- 
        // TRANSMITTANCE FUNCTIONS
        // ---------------------------------------------------------------------------- 

        // transmittance(=transparency) of atmosphere for infinite ray (r, mu)
        // (mu = cos(view zenith angle)), intersections with ground ignored        
        vec3 Transmittance(float r, float mu) {
            float uR, uMu;
            #ifdef TRANSMITTANCE_NON_LINEAR
                uR = sqrt((r - Rg) / (Rt - Rg));
                uMu = atan((mu + 0.15) / (1.0 + 0.15) * tan(1.5)) / 1.5;
            #else
                uR = (r - Rg) / (Rt - Rg);
                uMu = (mu + 0.15) / (1.0 + 0.15);
            #endif    
            return texture2D(_Transmittance, vec2(uMu, uR)).rgb;
        }

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
            vec3 ray;
            float mie; // only calc the red channel
            vec4 dhdH;
            float mu, muS, nu, r;
        
            vec2 coords = v_Uv; // range 0 ~ 1.

            vec3 uvLayer;

            if (RES_R > 3.) {
                // hard coded to split the depth to 4 layer
                // Texture size = 256 x 512
                uvLayer = coords.y > 0.75 ? vec3(coords.x, coords.y * RES_R - 3., 8.) : // 16. ? atmosphere level layer
                    coords.y > 0.5 ? vec3(coords.x, coords.y * RES_R - 2., 4.) :
                    coords.y > 0.25 ? vec3(coords.x, coords.y * RES_R - 1., 2.) :
                                    vec3(coords.x, coords.y * RES_R, 0.); // ground level layer
            } else {
                // One layer only, Texture size is 256 x 128
                uvLayer = vec3(coords, 1.); // 2. ?
            } 
        
            GetLayer(uvLayer.z, r, dhdH); 
            GetMuMuSNu(uvLayer.xy, r, dhdH, mu, muS, nu); 
        
            Inscatter(r, mu, muS, nu, ray, mie); 
            
            // store only red component of single Mie scattering (cf. 'Angular precision')
            gl_FragColor = vec4(ray, mie);
        }
    `
};