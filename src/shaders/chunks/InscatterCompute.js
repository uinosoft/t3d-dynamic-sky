export const InscatterCompute = `
void GetRMuMuSNuFromScatteringUvwz(vec4 uvwz, out float r, out float mu, out float muS, out float nu, out bool rayIntersectsGround) {
	float xMuS = GetUnitRangeFromTextureCoord(uvwz.y, RES_MU_S);

	float H = sqrt(Rt * Rt - Rg * Rg);
	float rho = H * GetUnitRangeFromTextureCoord(uvwz.w, RES_R_TOTAL);
	r = sqrt(rho * rho + Rg * Rg);

	#if INSCATTER_MAPPING == 1
		if (uvwz.z < 0.5) { // bottom half
			float dmin = r - Rg;
			float dmax = rho;
			float d = dmin + (dmax - dmin) * GetUnitRangeFromTextureCoord(1. - 2. * uvwz.z, RES_MU / 2.0);
			mu = d == 0.0 ? -1.0 : ClampCosine(-(rho * rho + d * d) / (2.0 * r * d));
			rayIntersectsGround = true;
		} else {
			float dmin = Rt - r;
			float dmax = rho + H;
			uvwz.z = clamp(uvwz.z, 0.5, 0.99); // fix jagged bright lines at the horizon, but why ?
			float d = dmin + (dmax - dmin) * GetUnitRangeFromTextureCoord(2. * uvwz.z - 1., RES_MU / 2.0);
			mu = d == 0.0 ? 1.0 : ClampCosine((H * H - rho * rho - d * d) / (2.0 * r * d));
			rayIntersectsGround = false;
		}
	
		// paper formula 
		// muS = -(0.6 + log(1.0 - xMuS * (1.0 -  exp(-3.6)))) / 3.0; 
		// better formula 
		// muS = tan((2.0 * xMuS - 1.0 + 0.26) * 0.75) / tan(1.26 * 0.75);

		float d_min = Rt - Rg;
		float d_max = H;
		float D = DistanceToTopAtmosphereBoundary(Rg, -0.2);
		float A = (D - d_min) / (d_max - d_min);
		float a = (A - xMuS * A) / (1.0 + xMuS * A);
		float d = d_min + min(a, A) * (d_max - d_min);
		muS = d == 0.0 ? 1.0 : ClampCosine((H * H - d * d) / (2.0 * Rg * d));
	#else 
		mu = -1.0 + 2.0 * GetUnitRangeFromTextureCoord(uvwz.z, RES_MU);
		muS = -0.2 + xMuS * 1.2;
	#endif

	nu = ClampCosine(uvwz.x * 2.0 - 1.0);
}

void ComputeSingleScatteringIntegrand(float r, float mu, float muS, float nu, float d, bool rayIntersectsGround, out vec3 rayleigh, out float mie) {
	float ri = ClampRadius(sqrt(r * r + d * d + 2.0 * r * mu * d));
	float muSi = ClampCosine(
		(muS * r + nu * d) / (ri * mix(1.0, betaR.w, max(0.0, muS))) // added betaR.w to fix the Rayleigh Offset artifacts issue
	);

	vec3 transmittance = GetTransmittance(r, mu, d, rayIntersectsGround) *
		GetTransmittanceToSun(ri, muSi);

	rayleigh = exp(-(ri - Rg) / HR) * transmittance;
	mie = exp(-(ri - Rg) / HM) * transmittance.x; // only calc the red channel
}

void ComputeSingleScattering(float r, float mu, float muS, float nu, bool rayIntersectsGround, out vec3 ray, out float mie) {
	ray = vec3(0., 0., 0.);
	mie = 0.0; // single channel only

	float dx = DistanceToNearestAtmosphereBoundary(r, mu, rayIntersectsGround)
		/ float(INSCATTER_INTEGRAL_SAMPLES);

	vec3 rayi;
	float miei;

	ComputeSingleScatteringIntegrand(r, mu, muS, nu, 0.0, rayIntersectsGround, rayi, miei);

	for (int i = 1; i <= INSCATTER_INTEGRAL_SAMPLES; ++i) {
		float xj = float(i) * dx; 

		vec3 rayj;
		float miej;

		ComputeSingleScatteringIntegrand(r, mu, muS, nu, xj, rayIntersectsGround, rayj, miej);
		
		ray += (rayi + rayj) / 2.0 * dx;
		mie += (miei + miej) / 2.0 * dx;

		rayi = rayj;
		miei = miej;
	}
	
	ray *= betaR.xyz;
	mie *= betaMSca.x;
}
`;