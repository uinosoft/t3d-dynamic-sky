export const InscatterLookup = `
float GetTextureCoordFromUnitRange(float x, float textureSize) {
	return 0.5 / textureSize + x * (1.0 - 1.0 / textureSize);
}

vec4 GetScattering(float r, float mu, float muS, float nu) {
	#ifdef INSCATTER_3D
		float resR = RES_R_TOTAL;
	#else
		float resR = RES_R;
	#endif
	float H = sqrt(Rt * Rt - Rg * Rg);
	float rho = sqrt(r * r - Rg * Rg);
	float uR = GetTextureCoordFromUnitRange(rho / H, resR);
	#if INSCATTER_MAPPING == 1
		float rmu = r * mu;
		float discriminant = rmu * rmu - r * r + Rg * Rg;
		float uMu;
		if (rmu < 0.0 && discriminant > 0.0) {
			float d = -rmu - sqrt(discriminant);
			float d_min = r - Rg;
			float d_max = rho;
			uMu = 0.5 - 0.5 * GetTextureCoordFromUnitRange(d_max == d_min ? 0.0 : (d - d_min) / (d_max - d_min), RES_MU / 2.);
		} else {
			float d = -rmu + sqrt(discriminant + H * H);
			float d_min = Rt - r;
			float d_max = rho + H;
			uMu = 0.5 + 0.5 * GetTextureCoordFromUnitRange((d - d_min) / (d_max - d_min), RES_MU / 2.);
		}

		// paper formula
		// float uMuS = GetTextureCoordFromUnitRange(max((1.0 - exp(-3.0 * muS - 0.6)) / (1.0 - exp(-3.6)), 0.0), RES_MU_S);
		// better formula
		float uMuS = GetTextureCoordFromUnitRange((atan(max(muS, -0.1975) * tan(1.26 * 0.75)) / 0.75 + (1.0 - 0.26)) * 0.5, RES_MU_S);

		if (_SkyboxOcean < 0.5) {
			uMu = rmu < 0.0 && discriminant > 0.0 ? 0.975 : uMu * 0.975 + 0.015 * uMuS; // 0.975 to fix the horizion seam. 0.015 to fix zenith artifact
		}
	#else
		float uMu = GetTextureCoordFromUnitRange((mu + 1.0) / 2.0, RES_MU);
		float uMuS = GetTextureCoordFromUnitRange(max(muS + 0.2, 0.0) / 1.2, RES_MU_S);
	#endif

	float lep = (nu + 1.0) / 2.0 * (RES_NU - 1.0);
	float uNu = floor(lep);
	lep = lep - uNu;

	float uNu_uMuS = uNu + uMuS;

	#ifdef INSCATTER_3D
		return texture(_Inscatter, vec3(uNu_uMuS / RES_NU, uMu, uR)) * (1.0 - lep) + texture(_Inscatter, vec3((uNu_uMuS + 1.0) / RES_NU, uMu, uR)) * lep;
	#else
		#ifdef SKY_MULTISAMPLE  
			// new 2D lookup
			float u_0 = floor(uR * RES_R) / RES_R;
			float u_1 = floor(uR * RES_R + 1.0) / RES_R;
			float u_frac = fract(uR * RES_R);

			// pre-calculate uv
			float uv_0X = uNu_uMuS / RES_NU;
			float uv_1X = (uNu_uMuS + 1.0) / RES_NU;
			float uv_0Y = uMu / RES_R + u_0;
			float uv_1Y = uMu / RES_R + u_1;
			float OneMinusLep = 1.0 - lep;

			#ifdef FIX_INSCATTER_SAMPLE
				uv_0X = fixU(uv_0X);
				uv_1X = fixU(uv_1X);
			#endif

			vec4 A = texture2D(_Inscatter, vec2(uv_0X, uv_0Y)) * OneMinusLep + texture2D(_Inscatter, vec2(uv_1X, uv_0Y)) * lep;	
			vec4 B = texture2D(_Inscatter, vec2(uv_0X, uv_1Y)) * OneMinusLep + texture2D(_Inscatter, vec2(uv_1X, uv_1Y)) * lep;	

			return A * (1.0 - u_frac) + B * u_frac;

		#else	
			return texture2D(_Inscatter, vec2(uNu_uMuS / RES_NU, uMu)) * (1.0 - lep) + texture2D(_Inscatter, vec2((uNu_uMuS + 1.0) / RES_NU, uMu)) * lep;	
		#endif
	#endif 
}
`;