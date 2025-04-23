// ref https://ebruneton.github.io/precomputed_atmospheric_scattering
// ref https://www.shadertoy.com/view/DsBGWG
export const TransmittanceCompute = `
// total optical length of rayleigh or mie
float OpticalDepth(float H, float r, float mu) {
	float dx = DistanceToTopAtmosphereBoundary(r, mu) / float(TRANSMITTANCE_INTEGRAL_SAMPLES);
	
	float xi = 0.0;
	float yi = exp(-(r - Rg) / H);
	float result = 0.0; 
	for (int i = 1; i <= TRANSMITTANCE_INTEGRAL_SAMPLES; ++i) {
		float xj = float(i) * dx; 
		float yj = exp(-(sqrt(r * r + xj * xj + 2.0 * xj * r * mu) - Rg) / H);
		result += (yi + yj) / 2.0 * dx;
		xi = xj;
		yi = yj;
	}
	
	return mu < -sqrt(1.0 - (Rg / r) * (Rg / r)) ? 1e9 : result; 
}

// total optical length of Ozone
float OpticalDepth_O3(float r, float mu) {
	float dx = DistanceToTopAtmosphereBoundary(r, mu) / float(TRANSMITTANCE_INTEGRAL_SAMPLES);

	float result = 0.0;
	for (int i = 0; i <= TRANSMITTANCE_INTEGRAL_SAMPLES; ++i) {
		float d_i = float(i) * dx;
		float r_i = sqrt(d_i * d_i + 2.0 * r * mu * d_i + r * r);
		float height = r_i - Rg;
		float linear_term = 0.0, constant_term = 0.0;
		// 2 Ozone layers
		linear_term = height < 25.0 ? 0.066667 : -0.066667;
		constant_term = height < 25.0 ? -0.66667 : 2.666667;
		float y_i = linear_term * height + constant_term;
		y_i = clamp(y_i, 0.0, 1.0);
		result += y_i * dx;
	}
	return result;
}

#if TRANSMITTANCE_MAPPING == 0
	void GetRMuFromTransmittanceUv(vec2 uv, out float r, out float mu) {
		mu = -0.15 + uv.x * (1.0 + 0.15);
		r = Rg + uv.y * (Rt - Rg);
	}
#elif TRANSMITTANCE_MAPPING == 1
	void GetRMuFromTransmittanceUv(vec2 uv, out float r, out float mu) {
		mu = -0.15 + tan(1.5 * uv.x) / tan(1.5) * (1.0 + 0.15);
		r = Rg + (uv.y * uv.y) * (Rt - Rg);
	}
#else
	void GetRMuFromTransmittanceUv(vec2 uv, out float r, out float mu) {
		float H = sqrt(Rt * Rt - Rg * Rg);
		uv = gl_FragCoord.xy / TRANSMISSION_SIZE;
		float x_mu = GetUnitRangeFromTextureCoord(uv.x, TRANSMISSION_SIZE.x);
		float x_r = GetUnitRangeFromTextureCoord(uv.y, TRANSMISSION_SIZE.y);
		float rho = H * x_r;
		r = sqrt(rho * rho + Rg * Rg);
		float d_min = Rt - r;
		float d_max = rho + H;
		float d = d_min + x_mu * (d_max - d_min);
		mu = d <= 0.0 ? 1.0 : (H * H - rho * rho - d * d) / (2.0 * r * d);
		mu = ClampCosine(mu);
	}
#endif

vec3 ComputeTransmittance(vec2 uv) {
	float r, muS;

	GetRMuFromTransmittanceUv(uv, r, muS);

	vec3 depth = betaR.xyz * OpticalDepth(HR, r, muS) + betaMEx * OpticalDepth(HM, r, muS);

	#if TRANSMITTANCE_MAPPING == 2
		depth += betaOzone * OpticalDepth_O3(r, muS);
	#endif

	return exp(-depth);
}
`;