export const AtmosphereCommon = `
// const vec3 betaR = vec3(5.8e-3, 1.35e-2, 3.31e-2);
uniform vec4 betaR;

const float RES_R_TOTAL = 32.; // all altitude layer
const float RES_R = 4.; 	// 3D texture depth
const float RES_MU = 128.; 	// height of the texture
const float RES_MU_S = 32.; // width per table
const float RES_NU = 8.;	// table per texture depth

// ---------------------------------------------------------------------------- 
// PARAMETERIZATION OPTIONS 
// ----------------------------------------------------------------------------

// Transmittance mapping
// 0 - linear implementation
// 1 - original implementation in 2008
// 2 - new implementation in 2017
#define TRANSMITTANCE_MAPPING 1

#define INSCATTER_NON_LINEAR

// ---------------------------------------------------------------------------- 
// UTILITY FUNCTIONS
// ---------------------------------------------------------------------------- 

// nearest intersection of ray r, mu with ground or top atmosphere boundary 
// mu = cos(ray zenith angle at ray origin) 
float Limit(float r, float mu) { 
    float dout = -r * mu + sqrt(r * r * (mu * mu - 1.0) + RL * RL);

    float delta2 = r * r * (mu * mu - 1.0) + Rg * Rg;
    if (delta2 >= 0.0) { 
        float din = -r * mu - sqrt(delta2);
        if (din >= 0.0) { 
            dout = min(dout, din); 
        } 
    }
    
    return dout; 
}
`;