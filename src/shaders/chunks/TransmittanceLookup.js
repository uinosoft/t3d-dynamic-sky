// ref https://ebruneton.github.io/precomputed_atmospheric_scattering
export const TransmittanceLookup = `
vec2 GetTransmittanceUvFromRMu_new17(float r, float mu) {
	float H = sqrt(Rt * Rt - Rg * Rg);
	float rho = sqrt(r * r - Rg * Rg);
	float d = Limit(r, mu);
	float d_min = Rt - r;
	float d_max = rho + H;
	float x_mu = (d - d_min) / (d_max - d_min);
	float x_r = rho / H;
	return vec2(x_mu, x_r);
}

vec2 GetTransmittanceUvFromRMu_original08(float r, float mu) {
	float u = atan((mu + 0.15) / (1.0 + 0.15) * tan(1.5)) / 1.5;
	float v = sqrt((r - Rg) / (Rt - Rg));
	return vec2(u, v);
}

vec2 GetRMuFromTransmittanceUv_linear(float r, float mu) {
	float u = (mu + 0.15) / (1.0 + 0.15);
	float v = (r - Rg) / (Rt - Rg);
	return vec2(u, v);
}

// transmittance(=transparency) of atmosphere for infinite ray (r, mu)
// (mu = cos(view zenith angle)), intersections with ground ignored
vec3 Transmittance(float r, float mu) {
	#if TRANSMITTANCE_MAPPING == 0
		vec2 uv = GetRMuFromTransmittanceUv_linear(r, mu);
	#elif TRANSMITTANCE_MAPPING == 1
		vec2 uv = GetTransmittanceUvFromRMu_original08(r, mu);
	#else
		vec2 uv = GetTransmittanceUvFromRMu_new17(r, mu);
	#endif
	return texture2D(_Transmittance, uv).rgb;
}
`;