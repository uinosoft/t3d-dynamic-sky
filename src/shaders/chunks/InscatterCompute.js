export const InscatterCompute = `
void GetRMuMuSNuFromScatteringUvwz(vec4 uvwz, out float r, out float mu, out float muS, out float nu) {
	float xMuS = GetUnitRangeFromTextureCoord(uvwz.y, RES_MU_S);

	float H = sqrt(Rt * Rt - Rg * Rg);
	float rho = H * GetUnitRangeFromTextureCoord(uvwz.w, RES_R_TOTAL);
	r = sqrt(rho * rho + Rg * Rg);

	#if INSCATTER_MAPPING == 1
		if (uvwz.z < 0.5) { // bottom half
			float dmin = r - Rg;
			float dmax = rho;
			float d = dmin + (dmax - dmin) * GetUnitRangeFromTextureCoord(1. - 2. * uvwz.z, RES_MU / 2.0);
			mu = -(rho * rho + d * d) / (2.0 * r * d);
			// clamp
			// mu = d == 0.0 ? -1.0 : clamp(mu, -1.0, 1.0);
			mu = min(mu, -sqrt(1.0 - (Rg / r) * (Rg / r)) - 0.001); 
		} else {
			float dmin = Rt - r;
			float dmax = rho + H;
			float d = dmin + (dmax - dmin) * GetUnitRangeFromTextureCoord(2. * uvwz.z - 1., RES_MU / 2.0);
			mu = (H * H - rho * rho - d * d) / (2.0 * r * d);
			mu = d == 0.0 ? 1.0 : clamp(mu, -1.0, 1.0); 
		}
		// paper formula 
		// muS = -(0.6 + log(1.0 - xMuS * (1.0 -  exp(-3.6)))) / 3.0; 
		// better formula 
		muS = tan((2.0 * xMuS - 1.0 + 0.26) * 0.75) / tan(1.26 * 0.75);
	#else 
		mu = -1.0 + 2.0 * GetUnitRangeFromTextureCoord(uvwz.z, RES_MU);
		muS = -0.2 + xMuS * 1.2;
	#endif

	nu = uvwz.x * 2.0 - 1.0;
}

void ComputeSingleScatteringIntegrand(float r, float mu, float muS, float nu, float d, out vec3 rayleigh, out float mie) { 
	rayleigh = vec3(0.,0.,0.); 
	mie = 0.0; // single channel only
	float ri = sqrt(r * r + d * d + 2.0 * r * mu * d); 
	float muSi = (nu * d + muS * r) / (ri * mix(1.0, betaR.w, max(0.0, muS))); // added betaR.w to fix the Rayleigh Offset artifacts issue
	ri = max(Rg, ri);
	if (muSi >= -sqrt(1.0 - Rg * Rg / (ri * ri))) { 
		vec3 transmittance = GetTransmittance(r, mu, d) * GetTransmittanceToTopAtmosphereBoundary(ri, muSi); 
		rayleigh = exp(-(ri - Rg) / HR) * transmittance; 
		mie = exp(-(ri - Rg) / HM) * transmittance.x; // only calc the red channel
	}
}

void ComputeSingleScattering(float r, float mu, float muS, float nu, out vec3 ray, out float mie) {
	ray = vec3(0., 0., 0.);
	mie = 0.0; // single channel only

	float dx = Limit(r, mu) / float(INSCATTER_INTEGRAL_SAMPLES);

	vec3 rayi;
	float miei;

	ComputeSingleScatteringIntegrand(r, mu, muS, nu, 0.0, rayi, miei);

	for (int i = 1; i <= INSCATTER_INTEGRAL_SAMPLES; ++i) {
		float xj = float(i) * dx; 

		vec3 rayj;
		float miej;

		ComputeSingleScatteringIntegrand(r, mu, muS, nu, xj, rayj, miej);
		
		ray += (rayi + rayj) / 2.0 * dx;
		mie += (miei + miej) / 2.0 * dx;

		rayi = rayj;
		miei = miej;
	}
	
	ray *= betaR.xyz;
	mie *= betaMSca.x;
}
`;