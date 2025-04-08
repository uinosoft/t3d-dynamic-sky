export const AtmosphereCommon = `
uniform vec4 betaR;

const float RES_R_TOTAL = 32.; // all altitude layer
const float RES_MU = 128.; 	// height of the texture
const float RES_MU_S = 32.; // width per table
const float RES_NU = 8.;	// table per texture depth

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

float GetTextureCoordFromUnitRange(float x, float textureSize) {
	return 0.5 / textureSize + x * (1.0 - 1.0 / textureSize);
}

float GetUnitRangeFromTextureCoord(float u, float textureSize) {
	return (u - 0.5 / textureSize) / (1.0 - 1.0 / textureSize);
}
`;