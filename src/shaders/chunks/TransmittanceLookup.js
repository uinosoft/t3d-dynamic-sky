// ref https://ebruneton.github.io/precomputed_atmospheric_scattering
export const TransmittanceLookup = `
#if TRANSMITTANCE_MAPPING == 0
	vec2 GetTransmittanceUvFromRMu(float r, float mu) {
		float u = (mu + 0.15) / (1.0 + 0.15);
		float v = (r - Rg) / (Rt - Rg);
		return vec2(u, v);
	}
#elif TRANSMITTANCE_MAPPING == 1
	vec2 GetTransmittanceUvFromRMu(float r, float mu) {
		float u = atan((mu + 0.15) / (1.0 + 0.15) * tan(1.5)) / 1.5;
		float v = sqrt((r - Rg) / (Rt - Rg));
		return vec2(u, v);
	}
#else
	vec2 GetTransmittanceUvFromRMu(float r, float mu) {
		float H = sqrt(Rt * Rt - Rg * Rg);
		float rho = sqrt(r * r - Rg * Rg);
		float d = Limit(r, mu);
		float d_min = Rt - r;
		float d_max = rho + H;
		float x_mu = (d - d_min) / (d_max - d_min);
		float x_r = rho / H;
		return vec2(
			GetTextureCoordFromUnitRange(x_mu, TRANSMISSION_SIZE.x),
			GetTextureCoordFromUnitRange(x_r, TRANSMISSION_SIZE.y)
		);
	}
#endif

// transmittance(=transparency) of atmosphere for infinite ray (r, mu)
// (mu = cos(view zenith angle)), intersections with ground ignored
vec3 GetTransmittanceToTopAtmosphereBoundary(float r, float mu) {
	vec2 uv = GetTransmittanceUvFromRMu(r, mu);
	return texture2D(_Transmittance, uv).rgb;
}

// transmittance(=transparency) of atmosphere between x and x0
// assume segment x, x0 not intersecting ground 
// d = distance between x and x0, mu = cos(zenith angle of [x,x0) ray at x) 
vec3 GetTransmittance(float r, float mu, float d) {
	float r_d = clamp(sqrt(r * r + d * d + 2.0 * r * mu * d), Rg, Rt);
	float mu_d = clamp((r * mu + d) / r_d, -1.0, 1.0);
	if (mu > 0.0) {
		return min(GetTransmittanceToTopAtmosphereBoundary(r, mu) / GetTransmittanceToTopAtmosphereBoundary(r_d, mu_d), 1.0); 
	} else {
		return min(GetTransmittanceToTopAtmosphereBoundary(r_d, -mu_d) / GetTransmittanceToTopAtmosphereBoundary(r, -mu), 1.0); 
	}
}
`;