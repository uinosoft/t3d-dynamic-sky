import { AtmosphereCommon } from './chunks/AtmosphereCommon.js';
import { TransmittanceCompute } from './chunks/TransmittanceCompute.js';

export const TransmittanceShader = {
	name: 'sky_transmittance',
	uniforms: {
		betaR: [5.8e-3, 1.35e-2, 3.31e-2, 1]
	},
	vertexShader: `
        attribute vec3 a_Position;
        attribute vec2 a_Uv;
           
        uniform mat4 u_ProjectionView;
        uniform mat4 u_Model;

        varying vec2 v_Uv;

        void main() {
            v_Uv = a_Uv;
            gl_Position = u_ProjectionView * u_Model * vec4(a_Position, 1.0);
        }
    `,
	fragmentShader: `
        varying vec2 v_Uv;

        ${AtmosphereCommon}
		${TransmittanceCompute}

        void main() {
            gl_FragColor = vec4(ComputeTransmittance(v_Uv), 1.0);
        }
    `
};