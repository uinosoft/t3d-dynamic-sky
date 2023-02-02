export const AtmosphereCommon = `

// The radius of the planet (Rg), radius of the atmosphere (Rt),  atmosphere limit (RL)
const float Rg = 6360.0;
const float Rt = 6420.0;
const float RL = 6421.0;

// Half heights for the atmosphere air density (HR) and particle density (HM)
// This is the height in km that half the particles are found below
const float HR = 8.0;
const float HM = 1.2;

// const vec3 betaR = vec3(5.8e-3, 1.35e-2, 3.31e-2);
uniform vec4 betaR;
const vec3 betaMSca = vec3(4e-3, 4e-3, 4e-3);
const vec3 betaMEx = betaMSca / 0.9;

// ---------------------------------------------------------------------------- 
// NUMERICAL INTEGRATION PARAMETERS 
// ----------------------------------------------------------------------------

// default Transmittance sample is 500, less then 250 sample will fit in SM 3.0 for dx9,
#define TRANSMITTANCE_INTEGRAL_SAMPLES 50
//default Inscatter sample is 50
#define INSCATTER_INTEGRAL_SAMPLES 25

// ---------------------------------------------------------------------------- 
// PARAMETERIZATION OPTIONS 
// ----------------------------------------------------------------------------

#define TRANSMITTANCE_NON_LINEAR	
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