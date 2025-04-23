export const AtmosphereCommon = `
uniform vec4 betaR;

const float RES_R_TOTAL = 32.; // all altitude layer
const float RES_MU = 128.; 	// height of the texture
const float RES_MU_S = 32.; // width per table
const float RES_NU = 8.;	// table per texture depth

const vec2 TRANSMISSION_SIZE = vec2(256., 64.); // 256x64

// ---------------------------------------------------------------------------- 
// UTILITY FUNCTIONS
// ---------------------------------------------------------------------------- 

float GetTextureCoordFromUnitRange(float x, float textureSize) {
	return 0.5 / textureSize + x * (1.0 - 1.0 / textureSize);
}

float GetUnitRangeFromTextureCoord(float u, float textureSize) {
	return (u - 0.5 / textureSize) / (1.0 - 1.0 / textureSize);
}

float ClampCosine(float mu) {
	return clamp(mu, -1.0, 1.0);
}

float ClampDistance(float d) {
	return max(d, 0.0);
}

float ClampRadius(float r) {
	return clamp(r, Rg, Rt);
}

float SafeSqrt(float a) {
	return sqrt(max(a, 0.0));
}

float DistanceToTopAtmosphereBoundary(float r, float mu) {
	float discriminant = r * r * (mu * mu - 1.0) + Rt * Rt;
	return ClampDistance(-r * mu + SafeSqrt(discriminant));
}

float DistanceToBottomAtmosphereBoundary(float r, float mu) {
	float discriminant = r * r * (mu * mu - 1.0) + Rg * Rg;
	return ClampDistance(-r * mu - SafeSqrt(discriminant));
}

float DistanceToNearestAtmosphereBoundary(float r, float mu, bool rayIntersectsGround) {
	if (rayIntersectsGround) {
		return DistanceToBottomAtmosphereBoundary(r, mu);
	} else {
		return DistanceToTopAtmosphereBoundary(r, mu);
	}
}
`;