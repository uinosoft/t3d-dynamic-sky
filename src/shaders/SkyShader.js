import { AtmosphereCommon } from './chunks/AtmosphereCommon.js';
import { TransmittanceLookup } from './chunks/TransmittanceLookup.js';
import { InscatterLookup } from './chunks/InscatterLookup.js';

export const SkyShader = {
	name: 'sky_bg',
	defines: {
		TRANSMITTANCE_MAPPING: 1,
		INSCATTER_MAPPING: 1,
		INSCATTER_3D: false,
		ALTITUDE_LAYERS: 4,

		BACKGROUND: false,

		NIGHT_SKY: true,

		SKY_SUNDISK: true
	},
	uniforms: {
		betaR: [5.8e-3, 1.35e-2, 3.31e-2, 1],

		cameraHeight: 0, // camera height to sealevel

		miePhaseG: 0.8,
		miePhaseScale: 1,

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

		_SkyExposure: 1.0
	},
	vertexShader: `
        #define PI 3.14159265359

        attribute vec3 a_Position;

		uniform mat4 u_Projection;
		uniform mat4 u_View;
		uniform mat4 u_Model;

        uniform float cameraHeight;

        uniform float miePhaseG;
        uniform float miePhaseScale;

        uniform vec4 _SunDirSize;
        uniform vec4 _MoonDirSize;

        uniform float _SkyExposure;

        uniform mat4 _SpaceRotationMatrix;

        varying vec4 vWorldPosAndCamY;

        varying vec3 vMiePhase_g;
        varying vec3 vSun_g;

        varying vec2 vMoonTC;
        varying vec3 vSpaceTC;

        // Mie phase G function and Mie scattering scale, (compute this function in Vertex program for optimization)
        vec3 PhaseFunctionG(float g, float scale) {
            float g2 = g * g;
            return vec3(
				scale * 3.0 / (8.0 * PI) * (1.0 - g2) / (2.0 + g2), 
				1.0 + g2, 
				2.0 * g
			);
        }

		mat4 clearMat4Translate(mat4 m) {
			mat4 outMatrix = m;
			outMatrix[3].xyz = vec3(0., 0., 0.);
			return outMatrix;
		}
        
        void main() {
			mat4 modelMatrix = clearMat4Translate(u_Model);
			mat4 viewMatrix = clearMat4Translate(u_View);

            vWorldPosAndCamY.xyz = (modelMatrix * vec4(a_Position, 0.0)).xyz;

			#ifdef BACKGROUND
				vWorldPosAndCamY.xyz = (modelMatrix * vec4(a_Position, 0.0)).xyz;
			#else
				vWorldPosAndCamY.xyz = a_Position;
			#endif

			vWorldPosAndCamY.w = max(cameraHeight, 10.0); // no lower than sealevel

			gl_Position = u_Projection * viewMatrix * modelMatrix * vec4(a_Position, 1.0);
			gl_Position.z = gl_Position.w;

            vMiePhase_g = PhaseFunctionG(miePhaseG, miePhaseScale);

            #ifdef SKY_SUNDISK
                vSun_g = PhaseFunctionG(.99 , _SunDirSize.w * 0.004 * _SkyExposure);
            #else
                vSun_g = vec3(0., 0., 0.);
            #endif

            vec3 right = normalize(cross(_MoonDirSize.xyz, vec3(0., 0., 1.)));
            vec3 up = cross(_MoonDirSize.xyz, right);
            vMoonTC = vec2(dot(right, normalize(a_Position)), dot(up, normalize(a_Position))) * _MoonDirSize.w + 0.5;
            vSpaceTC = (_SpaceRotationMatrix * vec4(a_Position, 0.0)).xyz;

            
        }
    `,
	fragmentShader: `
        uniform vec4 _SunDirSize;

        uniform float _SkyboxOcean;

		#ifdef INSCATTER_3D
			 uniform highp sampler3D _Inscatter;
		#else
			 uniform sampler2D _Inscatter;
		#endif
       
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

        varying vec4 vWorldPosAndCamY;
        varying vec3 vMiePhase_g;
        varying vec3 vSun_g;
        varying vec2 vMoonTC;
        varying vec3 vSpaceTC;

        const float Rg = 6360000.0;
        const float Rt = 6420000.0;
        const float RL = 6421000.0;

		const float SUN_BRIGHTNESS = 40.0;

		${AtmosphereCommon}
		${TransmittanceLookup}
		${InscatterLookup}

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

        vec3 SkyRadiance(vec3 camera, vec3 viewdir, float nu, vec3 MiePhase_g, out vec3 transmittance) {
            float r = length(camera);
            float rMu = dot(camera, viewdir);

            float din = -rMu - sqrt(rMu * rMu - r * r + Rt * Rt);
            
            if (din > 0.0) {
                camera += din * viewdir;
                rMu += din;
                r = Rt;
            } else if (r > Rt) {
			 	transmittance = vec3(1., 1., 1.);
				return vec3(0., 0., 0.);
			}

			float mu = rMu / r;
			float muS = dot(camera, _SunDirSize.xyz) / r;
            // float nu = dot(viewdir, _SunDirSize.xyz); // nu value is from function input

            transmittance = GetTransmittanceToTopAtmosphereBoundary(r, mu);

			vec4 scattering = GetScattering(r, rMu / r, muS, nu);
			vec3 scatteringM = GetMie(scattering);

			float phaseR = PhaseFunctionR();
			float phaseM = PhaseFunctionM(nu, MiePhase_g);

            return (scattering.rgb * phaseR + scatteringM * phaseM) * (1.0 + nu * nu) * SUN_BRIGHTNESS;
        }

        vec3 hdr(vec3 L) {
            L.r = mix(1.0 - exp(-L.r), pow(L.r * 0.38317, 1.0 / 2.2), step(L.r, 1.413));
            L.g = mix(1.0 - exp(-L.g), pow(L.g * 0.38317, 1.0 / 2.2), step(L.g, 1.413));
            L.b = mix(1.0 - exp(-L.b), pow(L.b * 0.38317, 1.0 / 2.2), step(L.b, 1.413));
            return L;
        }

        // switch different tonemapping methods between day and night
        vec3 hdr2(vec3 L) {
            L = mix(hdr(L), 1.0 - exp(-L), _uSkyNightParams.x);
            return L;
        }

        void main() {
            vec3 dir = normalize(vWorldPosAndCamY.xyz);
            float nu = dot(dir, _SunDirSize.xyz);

            vec3 extinction = vec3(0.0);
            vec3 col = SkyRadiance(vec3(0.0, vWorldPosAndCamY.w + Rg, 0.0), dir, nu, vMiePhase_g, extinction);

            #ifdef NIGHT_SKY
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

				col += nightSkyColor;
			#endif
            
            col = hdr2(col * _SkyExposure);

            #ifdef SKY_SUNDISK
                float sun = PhaseFunctionM(nu, vSun_g) * (1.0 + nu * nu); 
		        col += sun * extinction;

                // TODO new sun disk?
                // float sun = step(0.9999 - _SunDirSize.w * 1e-4, nu) * sign(_LightColor0.w);
				// col += (sun * SUN_BRIGHTNESS) * extinction ;
            #endif

            // float alpha = mix(1.0, max(1e-3, moonMask + (1. - gr)), _uSkyNightParams.x);
            // gl_FragColor = vec4(col, alpha);

            gl_FragColor = vec4(col, 1.);
        }
    `
};