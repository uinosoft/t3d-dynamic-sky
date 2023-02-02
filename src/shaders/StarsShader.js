export const StarsShader = {
	name: 'sky_stars',
	defines: {},
	uniforms: {
		_CameraFar: 1000,
		_StarIntensity: 40,
		_StarSize: 10,
		_Time: 0,
		_StarRotationMatrix: [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		],
	},
	vertexShader: `
        attribute vec3 a_Position;
		attribute vec4 a_Color;
		attribute vec2 a_Uv;

		uniform mat4 u_ProjectionView;
		uniform mat4 u_Model;
		uniform vec3 u_CameraPosition;

		uniform float _CameraFar;
		uniform float _StarIntensity;
		uniform float _StarSize;
		uniform float _Time;
		uniform mat4 _StarRotationMatrix;

		varying vec4 vColor;

		float GetFlickerAmount(vec2 pos) {
			vec2 tab[8];

			tab[0] = vec2(0.897907815, -0.347608525);
			tab[1] = vec2(0.550299290, 0.273586675);
			tab[2] = vec2(0.823885965, 0.098853070);
			tab[3] = vec2(0.922739035, -0.122108860);
			tab[4] = vec2(0.800630175, -0.088956800);
			tab[5] = vec2(0.711673375, 0.158864420);
			tab[6] = vec2(0.870537795, 0.085484560);
			tab[7] = vec2(0.956022355, -0.058114540);
		
			vec2 hash = fract(pos.xy * 256.);
			float index = fract(hash.x + (hash.y + 1.) * _Time); // flickering
			index *= 8.;
	
			float f = fract(index) * 2.5;
			highp int i = int(index);

			return tab[i].x + f * tab[i].y;
		} 

		void main() {
			vec3 t = (_StarRotationMatrix * vec4(a_Position.xyz, 1.0)).xyz * _CameraFar + u_CameraPosition.xyz;
			vec4 transformed = vec4(t, 1.0);

			gl_Position = u_ProjectionView * u_Model * transformed;

			float appMag = 6.5 + a_Color.w * (-1.44 - 1.5);
			float brightness = GetFlickerAmount(a_Position.xy) * pow(5.0, (-appMag - 1.44) / 2.5);

			vColor = (t.y > 0.0 ? _StarIntensity : 0.0) * vec4(brightness * a_Color.xyz, brightness);
			
			gl_PointSize = _StarSize;
		}
    `,
	fragmentShader: `
        varying vec4 vColor;

        void main() {
            vec2 distCenter = 6.5 * gl_PointCoord - 6.5 * vec2(0.5, 0.5);
            float scale = exp(-dot(distCenter, distCenter));
            vec3 col = vColor.xyz * scale + 5. * vColor.w * pow(scale, 10.);

			// col = col * col * 2.;

            gl_FragColor = vec4(col, 1.);
        }
    `
}