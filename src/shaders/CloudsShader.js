export const CloudsShader = {
	name: 'sky_clouds',
	defines: {},
	uniforms: {
		_CameraFar: 1000,
		_Rotation: 0,
		_HeightOffset: 0,

		_MoonDirSize: [0.97, -0.24, 0.0],
		_SunDirSize: [-0.97, 0.24, 0.0],
		_uSkyNightParams: [.25, 1.],

		_StepSize: 0.004, // "Step size", Range(0.001, 0.02)

		_NightZenithColor: [51 / 255., 72 / 255., 102 / 255.],
		_SkyColor: [28. / 255., 32. / 255., 40. / 255.],
		_SkyLightColor: [85 / 255, 99 / 255, 112 / 255],

		_LightColorMultiplier: 4, // "Light Color multiplier", Range(0, 10)
		_SkyColorMultiplier: 1.5, // "Sky Color multiplier", Range(0, 10)
		_ScatterMultiplier: 1.33,
		_SkyMieG: 0.76,

		_CloudSampler: null,
		_Mask: 1., // "Clouds Density", Range (0, 4)
		_AlphaSaturation: 2.0, // "Alpha saturation", Range(1, 10)
		_Attenuation: 0.6, // "Attenuation", Range(0, 5)
	},
	vertexShader: `
        attribute vec3 a_Position;
		attribute vec3 a_Normal;
		attribute vec4 a_Tangent;
		attribute vec2 a_Uv;

        uniform mat4 u_ProjectionView;
		uniform mat4 u_Model;
        uniform vec3 u_CameraPosition;

        uniform float _CameraFar;

        uniform float _Rotation;
        uniform float _HeightOffset;

        uniform vec3 _MoonDirSize, _SunDirSize;
        uniform vec2 _uSkyNightParams;

        uniform float _StepSize;

		uniform vec3 _SkyLightColor, _NightZenithColor, _SkyColor;
		uniform float _LightColorMultiplier, _SkyColorMultiplier;
		uniform float _ScatterMultiplier;
		
		uniform float _SkyMieG;
		
		varying vec2 v_Uv;
		varying vec3 v_lightDir;
        varying vec2 v_toSun;
        varying vec3 v_skyColor;
		varying vec3 v_lightColor;
		varying vec3 v_miePhase_g;
		varying vec3 v_worldPos;
		
		const float PI = 3.1415926;
		const float OuterSpaceIntensity = 0.25;
		#define GAMMA_OUT(color) pow(color, 0.454545)
		#define ColorSpaceLuminance vec4(0.22, 0.707, 0.071, 0.0)
		#define SkyMieScale vec3(0.004)

		vec3 RotateAroundYInDegrees(vec3 vertex, float degrees) {
			float alpha = degrees * (PI / 180.0);
			float sina, cosa;
			sina = sin(alpha);
			cosa = cos(alpha);
			mat2 m = mat2(cosa, -sina, sina, cosa);
			return vec3((m * vertex.xz), vertex.y).xzy;
		}

		// Converts color to luminance (grayscale)
		float Luminance(vec3 rgb) {
			return dot(rgb, ColorSpaceLuminance.rgb);
		}

		vec3 PhaseFunctionG(float g, float scale) {
			// Mie phase G function and Mie scattering scale, (compute this function in Vertex program)
			float g2 = g * g;
			return vec3(scale * 1.5 * (1.0 / (4.0 * PI)) * ((1.0 - g2) / (2.0 + g2)), 1.0 + g2, 2.0 * g);
		}

		void main() {
			vec3 t = RotateAroundYInDegrees(a_Position.xyz, _Rotation).xyz; //  animate rotation
            t = t * _CameraFar + u_CameraPosition; // scale with camera's far plane and following camera position.
			t.y += _HeightOffset;

			vec3 dir = mix(_SunDirSize.xyz, _MoonDirSize.xyz, clamp(_uSkyNightParams.y, 0., 1.)); // switching between the sun and moon direction, avoids the poping issue between lights
			dir = RotateAroundYInDegrees(dir, -_Rotation);
			v_lightDir = dir;
			vec3 binormal = cross(a_Normal.xyz, a_Tangent.xyz) * a_Tangent.w; 
			mat3 rotation = mat3(a_Tangent.x, binormal.x, a_Normal.x, a_Tangent.y, binormal.y, a_Normal.y, a_Tangent.z, binormal.z, a_Normal.z);
			v_toSun = (rotation * dir).xy * _StepSize;

			v_Uv = a_Uv;

			// fix the night sky brightness
			float brightnessScale = max(max(Luminance(_NightZenithColor.rgb) * 4., OuterSpaceIntensity), 1.0 - _uSkyNightParams.x); 

			// Shade Color
			v_skyColor = _SkyColor * (GAMMA_OUT(_SkyColorMultiplier) * brightnessScale);
			v_lightColor = max(_SkyLightColor.xyz * _LightColorMultiplier, v_skyColor);

			// scatter term (precomputed Mie-G term)
			vec3 mie = SkyMieScale;
			mie.x *= GAMMA_OUT(_ScatterMultiplier);
			v_miePhase_g = PhaseFunctionG(_SkyMieG, mie.x);

			v_worldPos.xyz = (u_Model * vec4(a_Position, 1.0)).xyz;
			gl_Position = u_ProjectionView * u_Model * vec4(t, 1.0);
		}
    `,
	fragmentShader: `
        uniform sampler2D _CloudSampler;

        uniform vec2 _uSkyNightParams;

		uniform float _Attenuation, _AlphaSaturation, _Mask, _ScatterMultiplier;
		
		varying vec2 v_Uv;
		varying vec3 v_lightDir;
        varying vec2 v_toSun;
        varying vec3 v_skyColor;
		varying vec3 v_lightColor;
		varying vec3 v_miePhase_g;
		varying vec3 v_worldPos;
		
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
		
		void main() {
			const int c_numSamples = 8;
			vec3 dir = normalize(v_worldPos.xyz);
			float nu = dot(dir, v_lightDir.xyz);
			
			// only use red channel as clouds density 
			float opacity = texture2D(_CloudSampler, v_Uv).r;
			// user define opacity level (need to clamp to 1 for HDR Camera)
			opacity = min(opacity * _Mask, 1.0); 
			// Increase the "Alpha Opacity" during the night time for better masking out the background moon and stars
			opacity = mix(opacity, min(opacity * 1.15, 1.0), _uSkyNightParams.x);
		
			float density = 0.;
			
			if(opacity > 0.01) { // bypass sampling any transparent pixels
                vec2 sampleDir = v_toSun.xy;
				for(int i = 0; i < c_numSamples; i++) {
					float i_float = float(i);
					vec2 sampleUV = v_Uv + sampleDir * i_float;
					float t = texture2D(_CloudSampler, sampleUV).r;
					density += t;
				}
			}
		
			// scatter term
			float phase = PhaseFunctionR() * _ScatterMultiplier;
			float phaseM = PhaseFunctionM(nu, v_miePhase_g);
			float scatter = (phase + phaseM) * (1.0 + nu * nu);
		
			float c = exp2(-_Attenuation * density + scatter);
			float a = pow(opacity, _AlphaSaturation);
			vec3 col = mix(v_skyColor, v_lightColor, c);
		
			gl_FragColor = vec4(col, a);
		}
    `
};