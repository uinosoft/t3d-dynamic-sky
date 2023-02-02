export const SkyShader = {
	name: 'sky_bg',
	defines: {
		SKY_MULTISAMPLE: true,
		SKY_SUNDISK: true,
		COLORSPACE_GAMMA: false,
		SKY_HDR_MODE: false
	},
	uniforms: {
		_CameraFar: 1000,

		_SkyAltitudeScale: 1,
		_SkyGroundOffset: 0,

		_SkyMieG: 0.76,
		_SkyMieScale: 1,

		_MoonDirSize: [0, -1, 0, 8],

		_SpaceRotationMatrix: [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		],

		_SunDirSize: [0, 1, 0, 1],

		_SkyboxOcean: 0,

		_Inscatter: null,
		_Transmittance: null,

		_NightHorizonColor: [51 / 255, 74 / 255, 102 / 255, 0.5],
		_NightZenithColor: [72 / 255, 100 / 255, 128 / 255, 0.5],

		_MoonSampler: null,

		_uSkyNightParams: [0.25, 0.5, 0.5],

		_OuterSpaceCube: null,

		_MoonInnerCorona: [0 / 255, 0 / 255, 0 / 255, 0.5],
		_MoonOuterCorona: [65 / 255, 88 / 255, 128 / 255, 0.5],

		_SkyExposure: 1.0,

		betaR: [5.8e-3, 1.35e-2, 3.31e-2, 1]
	},
	vertexShader: `
        #define PI 3.14159

        attribute vec3 a_Position;

        uniform mat4 u_ProjectionView;
		uniform mat4 u_Model;
        uniform vec3 u_CameraPosition;

        uniform float _CameraFar;

        uniform float _SkyAltitudeScale;
        uniform float _SkyGroundOffset;

        uniform float _SkyMieG;
        uniform float _SkyMieScale;

        uniform vec4 _SunDirSize;
        uniform vec4 _MoonDirSize;

        uniform float _SkyExposure;

        uniform mat4 _SpaceRotationMatrix;

        varying vec4 vWorldPosAndCamY;
        varying vec3 vMiePhase_g;
        varying vec3 vSun_g;
        varying vec2 vMoonTC;
        varying vec3 vSpaceTC;

        // Mie phase G function and Mie scattering scale, (compute this function in Vertex program)
        vec3 PhaseFunctionG(float g, float scale) {
            float g2 = g * g;
            return vec3(scale * 1.5 * (1.0 / (4.0 * PI)) * ((1.0 - g2) / (2.0 + g2)), 1.0 + g2, 2.0 * g);
        }
        
        void main() {
            vWorldPosAndCamY.xyz = (u_Model * vec4(a_Position, 0.0)).xyz;
            // if the camera height is outside atmospheric precomputed buffer range, it will occur rendering artifacts
            vWorldPosAndCamY.w = max(u_CameraPosition.y * _SkyAltitudeScale + _SkyGroundOffset, 0.0); // no lower than sealevel
            vMiePhase_g = PhaseFunctionG(_SkyMieG, _SkyMieScale);

            #ifdef SKY_SUNDISK
                float scale = 8e-3;
                #ifdef COLORSPACE_GAMMA
                    scale = 4e-3;
                #endif
                vSun_g = PhaseFunctionG(.99 , _SunDirSize.w * scale * _SkyExposure);
            #else
                vSun_g = vec3(0., 0., 0.);
            #endif

            vec3 right = normalize(cross(_MoonDirSize.xyz, vec3(0., 0., 1.)));
            vec3 up = cross(_MoonDirSize.xyz, right);
            vMoonTC = vec2(dot(right, normalize(a_Position)), dot(up, normalize(a_Position))) * _MoonDirSize.w + 0.5;
            vSpaceTC = (_SpaceRotationMatrix * vec4(a_Position, 0.0)).xyz;

            gl_Position = u_ProjectionView * u_Model * vec4(a_Position * _CameraFar + u_CameraPosition.xyz, 1.0);
        }
    `,
	fragmentShader: `
        uniform vec4 _SunDirSize;

        uniform float _SkyboxOcean;

        uniform sampler2D _Inscatter;
        uniform sampler2D _Transmittance;

        uniform vec4 _NightHorizonColor;
        uniform vec4 _NightZenithColor;

        uniform sampler2D _MoonSampler;

        uniform vec3 _uSkyNightParams;

        uniform samplerCube _OuterSpaceCube;

        uniform vec4 _MoonDirSize;

        uniform vec4 _MoonInnerCorona;
        uniform vec4 _MoonOuterCorona;

        uniform float _SkyExposure;

        uniform vec4 betaR;

        varying vec4 vWorldPosAndCamY;
        varying vec3 vMiePhase_g;
        varying vec3 vSun_g;
        varying vec2 vMoonTC;
        varying vec3 vSpaceTC;

        const float Rg = 6360000.0;
        const float Rt = 6420000.0;
        const float RL = 6421000.0;

        const float RES_R = 4.; 	// 3D texture depth
        const float RES_MU = 128.; 	// height of the texture
        const float RES_MU_S = 32.; // width per table
        const float RES_NU = 8.;	// table per texture depth

        #define TRANSMITTANCE_NON_LINEAR	
        #define INSCATTER_NON_LINEAR

        vec4 Texture4D(sampler2D table, float r, float mu, float muS, float nu) {
            float H = sqrt(Rt * Rt - Rg * Rg);
            float rho = sqrt(r * r - Rg * Rg);
            #ifdef INSCATTER_NON_LINEAR
                float rmu = r * mu;
                float delta = rmu * rmu - r * r + Rg * Rg;
                vec4 cst = rmu < 0.0 && delta > 0.0 ? vec4(1.0, 0.0, 0.0, 0.5 - 0.5 / RES_MU) : vec4(-1.0, H * H, H, 0.5 + 0.5 / RES_MU);     
                float uR = 0.5 / RES_R + rho / H * (1.0 - 1.0 / RES_R);
                float uMu = cst.w + (rmu * cst.x + sqrt(delta + cst.y)) / (rho + cst.z) * (0.5 - 1.0 / float(RES_MU));

                // paper formula
                // float uMuS = 0.5 / RES_MU_S + max((1.0 - exp(-3.0 * muS - 0.6)) / (1.0 - exp(-3.6)), 0.0) * (1.0 - 1.0 / RES_MU_S);
                // better formula
                float uMuS = 0.5 / RES_MU_S + (atan(max(muS, -0.1975) * tan(1.26 * 1.1)) / 1.1 + (1.0 - 0.26)) * 0.5 * (1.0 - 1.0 / RES_MU_S);

                if (_SkyboxOcean < 0.5) {
                    uMu = rmu < 0.0 && delta > 0.0 ? 0.975 : uMu * 0.975 + 0.015 * uMuS; // 0.975 to fix the horizion seam. 0.015 to fix zenith artifact
                }
            #else
                float uR = 0.5 / RES_R + rho / H * (1.0 - 1.0 / RES_R);
                float uMu = 0.5 / RES_MU + (mu + 1.0) / 2.0 * (1.0 - 1.0 / RES_MU);
                float uMuS = 0.5 / RES_MU_S + max(muS + 0.2, 0.0) / 1.2 * (1.0 - 1.0 / RES_MU_S);
            #endif
            float lep = (nu + 1.0) / 2.0 * (RES_NU - 1.0);
            float uNu = floor(lep);
            lep = lep - uNu;

            // Original 3D lookup
            // return tex3D(table, float3((uNu + uMuS) / RES_NU, uMu, uR)) * (1.0 - lep) + tex3D(table, float3((uNu + uMuS + 1.0) / RES_NU, uMu, uR)) * lep;

            float uNu_uMuS = uNu + uMuS;

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

                vec4 A = texture2D(table, vec2(uv_0X, uv_0Y)) * OneMinusLep + texture2D(table, vec2(uv_1X, uv_0Y)) * lep;	
                vec4 B = texture2D(table, vec2(uv_0X, uv_1Y)) * OneMinusLep + texture2D(table, vec2(uv_1X, uv_1Y)) * lep;	

                return A * (1.0 - u_frac) + B * u_frac;

            #else	
                return texture2D(table, vec2(uNu_uMuS / RES_NU, uMu)) * (1.0 - lep) + texture2D(table, vec2((uNu_uMuS + 1.0) / RES_NU, uMu)) * lep;	
            #endif
        }

        vec3 GetMie(vec4 rayMie) {	
            // approximated single Mie scattering (cf. approximate Cm in paragraph "Angular precision")
            // rayMie.rgb = C*, rayMie.w = Cm, r
            return rayMie.rgb * rayMie.w / max(rayMie.r, 1e-4) * (betaR.r / betaR.xyz);
        }

        float PhaseFunctionR() {
			// Rayleigh phase function without multiply (1.0 + mu * mu)
			// We will multiply (1.0 + mu * mu) together with Mie phase later.
			return 3.0 / (16.0 * PI);
		}

        float PhaseFunctionM(float mu, vec3 miePhase_g) {
			// Mie phase function (optimized)
			// Precomputed PhaseFunctionG() with constant values in vertex program and pass them in here
			// we will multiply (1.0 + mu * mu) together with Rayleigh phase later.
			return miePhase_g.x / pow(miePhase_g.y - miePhase_g.z * mu, 1.5);
		}

        vec3 Transmittance(float r, float mu) {
            float uR, uMu;
            #ifdef TRANSMITTANCE_NON_LINEAR
                uR = sqrt((r - Rg) / (Rt - Rg));
                uMu = atan((mu + 0.15) / (1.0 + 0.15) * tan(1.5)) / 1.5;
            #else
                uR = (r - Rg) / (Rt - Rg);
                uMu = (mu + 0.15) / (1.0 + 0.15);
            #endif    
            return texture2D(_Transmittance, vec2(uMu, uR)).rgb;
        }

        const vec3 EARTH_POS = vec3(0.0, 6360010.0, 0.0);
        const float SUN_BRIGHTNESS = 40.0;

        vec3 SkyRadiance(vec3 camera, vec3 viewdir, float nu, vec3 MiePhase_g, out vec3 extinction) {
            camera += EARTH_POS;

            vec3 result = vec3(0., 0., 0.);
            float r = length(camera);
            float rMu = dot(camera, viewdir);
            float mu = rMu / r;

            float deltaSq = sqrt(rMu * rMu - r * r + Rt * Rt);
            float din = max(-rMu - deltaSq, 0.0);
            
            if (din > 0.0) {
                camera += din * viewdir;
                rMu += din;
                mu = rMu / Rt;
                r = Rt;
            }
            
            // float nu = dot(viewdir, _SunDirSize.xyz); // nu value is from function input
            float muS = dot(camera, _SunDirSize.xyz) / r;

            vec4 inScatter = Texture4D(_Inscatter, r, rMu / r, muS, nu);

            extinction = Transmittance(r, mu);

            if(r <= Rt) {
                vec3 inScatterM = GetMie(inScatter);
                float phase = PhaseFunctionR();
                float phaseM = PhaseFunctionM(nu, MiePhase_g);
                result = (inScatter.rgb * phase + inScatterM * phaseM) * (1.0 + nu * nu);
            } else {
                result = vec3(0., 0., 0.);
                extinction = vec3(1., 1., 1.);
            }

            return result * SUN_BRIGHTNESS;
        }

        vec3 hdr(vec3 L) {
            L.r = L.r < 1.413 ? pow(L.r * 0.38317, 1.0 / 2.2) : 1.0 - exp(-L.r);
            L.g = L.g < 1.413 ? pow(L.g * 0.38317, 1.0 / 2.2) : 1.0 - exp(-L.g);
            L.b = L.b < 1.413 ? pow(L.b * 0.38317, 1.0 / 2.2) : 1.0 - exp(-L.b);
            return L;
        }

        // switch different tonemapping methods between day and night
        vec3 hdr2(vec3 L) {
            L = mix(hdr(L), 1.0 - exp(-L), _uSkyNightParams.x);
            return L;
        }

        #if defined(COLORSPACE_GAMMA)
            #define COLOR_2_LINEAR(color) color * (0.4672 * color + 0.266)
            #define GAMMA_2_OUTPUT(color) color
            #define HDR_OUTPUT(color)  pow(color * 1.265, 0.735)
        #else
            #define COLOR_2_LINEAR(color) color * color
            #define GAMMA_2_OUTPUT(color) color * color
            #define HDR_OUTPUT(color) color * 0.6129
        #endif

        void main() {
            vec3 dir = normalize(vWorldPosAndCamY.xyz);
            float nu = dot(dir, _SunDirSize.xyz);

            vec3 extinction = vec3(0.0);
            vec3 col = SkyRadiance(vec3(0.0, vWorldPosAndCamY.w, 0.0), dir, nu, vMiePhase_g, extinction);

            // ------------------

            // night sky
            vec3 nightSkyColor = vec3(0., 0., 0.);
            float moonMask = 0.0;
            float gr = 1.0;

            if (_SunDirSize.y < 0.25) {
                // add horizontal night sky gradient
                gr = clamp(extinction.z * .25 / _NightHorizonColor.w, 0., 1.);
                gr *= 2. - gr;

                nightSkyColor = mix(_NightHorizonColor.xyz, _NightZenithColor.xyz, gr);
                // add moon and outer space
                vec4 moonAlbedo = texture2D(_MoonSampler, vMoonTC.xy);
		        moonMask = moonAlbedo.a * _uSkyNightParams.y;

                vec4 spaceAlbedo = textureCube(_OuterSpaceCube, vSpaceTC);
                // TODO _uSkyNightParams.x * OuterSpaceIntensity or _uSkyNightParams.z
                nightSkyColor += (moonAlbedo.rgb * _uSkyNightParams.y + spaceAlbedo.rgb * (max(1. - moonMask, gr) * _uSkyNightParams.z)) * gr;

                // moon corona
                float m = 1. - dot(dir, _MoonDirSize.xyz);
                nightSkyColor += _MoonInnerCorona.xyz * (1.0 / (1.05 + m * _MoonInnerCorona.w));
		        nightSkyColor += _MoonOuterCorona.xyz * (1.0 / (1.05 + m * _MoonOuterCorona.w));
            }

            // ------------------

            #ifndef SKY_HDR_MODE
                col += nightSkyColor;
                col = GAMMA_2_OUTPUT(hdr2(col * _SkyExposure));
            #else
                col += COLOR_2_LINEAR(nightSkyColor);
                col = HDR_OUTPUT(col * _SkyExposure);
            #endif

            #ifdef SKY_SUNDISK
                float sun = PhaseFunctionM(nu, vSun_g) * (1.0 + nu * nu); 
		        col += sun * extinction;

                // TODO new sun disk?
                // float sun = step(0.9999 - _SunDirSize.w * 1e-4, nu) * sign(_LightColor0.w);
				// col += (sun * SUN_BRIGHTNESS) * extinction ;
            #endif

            float alpha = mix(1.0, max(1e-3, moonMask + (1. - gr)), _uSkyNightParams.x);

            gl_FragColor = vec4(col, alpha);
            // gl_FragColor = vec4(col, 1.);
        }
    `
};