import * as t3d from 't3d';
import { TransmittanceShader } from './shaders/TransmittanceShader.js';
import { InscatterShader } from './shaders/InscatterShader.js';
import { clamp, lerp } from "./Utils.js";

export class SkyPrecomputeUtil {

	constructor(capabilities) {
		const isWebGL2 = capabilities.version > 1;

		// ios provides a poor implementation of float linear, so fallback to Half Float
		const isIOS = /(iPad|iPhone|iPod)/g.test(navigator.userAgent);

		let type;

		if (isWebGL2) {
			if (capabilities.getExtension("EXT_color_buffer_float") && capabilities.getExtension("OES_texture_float_linear") && !isIOS) {
				type = t3d.PIXEL_TYPE.FLOAT;
			} else {
				type = t3d.PIXEL_TYPE.HALF_FLOAT;
			}
		} else {
			if (capabilities.getExtension("OES_texture_float") && capabilities.getExtension("OES_texture_float_linear") && !isIOS) {
				type = t3d.PIXEL_TYPE.FLOAT;
			} else if (capabilities.getExtension("OES_texture_half_float") && capabilities.getExtension("OES_texture_half_float_linear")) {
				type = t3d.PIXEL_TYPE.HALF_FLOAT;
			} else {
				type = t3d.PIXEL_TYPE.UNSIGNED_BYTE;
				console.warn('Half float texture is not supported!');
			}
		}

		// Render targets

		const transmittanceRT = new t3d.RenderTarget2D(256, 64);
		transmittanceRT.texture.minFilter = t3d.TEXTURE_FILTER.LINEAR;
		transmittanceRT.texture.magFilter = t3d.TEXTURE_FILTER.LINEAR;
		transmittanceRT.texture.type = type;
		transmittanceRT.texture.format = t3d.PIXEL_FORMAT.RGBA;
		transmittanceRT.texture.generateMipmaps = false;

		const inscatterRT = new t3d.RenderTarget2D(512, 512);
		inscatterRT.texture.minFilter = t3d.TEXTURE_FILTER.LINEAR;
		inscatterRT.texture.magFilter = t3d.TEXTURE_FILTER.LINEAR;
		inscatterRT.texture.type = type;
		inscatterRT.texture.format = t3d.PIXEL_FORMAT.RGBA;
		inscatterRT.texture.generateMipmaps = false;

		// Render Passes

		const betaR = [5.8e-3, 1.35e-2, 3.31e-2, 1]; // default betaR

		const transmittancePass = new t3d.ShaderPostPass(TransmittanceShader);
		transmittancePass.uniforms.betaR = betaR;

		const inscatterPass = new t3d.ShaderPostPass(InscatterShader);
		inscatterPass.uniforms._Transmittance = transmittanceRT.texture;
		inscatterPass.uniforms.betaR = betaR;

		//

		this._transmittanceRT = transmittanceRT;
		this._inscatterRT = inscatterRT;

		this._transmittancePass = transmittancePass;
		this._inscatterPass = inscatterPass;

		this._betaR = betaR;
	}

	get transmittanceTexture() {
		return this._transmittanceRT.texture;
	}

	get inscatterTexture() {
		return this._inscatterRT.texture;
	}

	get betaR() {
		return this._betaR;
	}

	computeTransmittance(renderer) {
		renderer.renderPass.setRenderTarget(this._transmittanceRT);
		renderer.renderPass.setClearColor(0, 0, 0, 0);
		renderer.renderPass.clear(true, true, true);
		this._transmittancePass.render(renderer);
	}

	computeInscatter(renderer) {
		renderer.renderPass.setRenderTarget(this._inscatterRT);
		renderer.renderPass.setClearColor(0, 0, 0, 0);
		renderer.renderPass.clear(true, true, true);
		this._inscatterPass.render(renderer);
	}

	setBetaRayleighDensity(Wavelengths, SkyTint, AtmosphereThickness) {
		// Sky Tint shifts the value of Wavelengths
		const variableRangeWavelengths = _vec3_1.set(
			lerp(Wavelengths.x + 150, Wavelengths.x - 150, SkyTint.r),
			lerp(Wavelengths.y + 150, Wavelengths.y - 150, SkyTint.g),
			lerp(Wavelengths.z + 150, Wavelengths.z - 150, SkyTint.b)
		);

		variableRangeWavelengths.x = clamp(variableRangeWavelengths.x, 380, 780);
		variableRangeWavelengths.y = clamp(variableRangeWavelengths.y, 380, 780);
		variableRangeWavelengths.z = clamp(variableRangeWavelengths.z, 380, 780);

		// Evaluate Beta Rayleigh function is based on A.J.Preetham

		const WL = variableRangeWavelengths.multiplyScalar(1e-9); // nano meter unit

		const n = 1.0003; // the index of refraction of air
		const N = 2.545e25; // molecular density at sea level
		const pn = 0.035; // depolatization factor for standard air

		const waveLength4 = _vec3_2.set(Math.pow(WL.x, 4), Math.pow(WL.y, 4), Math.pow(WL.z, 4));
		const delta =  waveLength4.multiplyScalar(3.0 * N * (6.0 - 7.0 * pn));
		const ray = (8 * Math.pow(Math.PI, 3) * Math.pow(n * n - 1.0, 2) * (6.0 + 3.0 * pn));
		const betaR = _vec3_1.set(ray / delta.x, ray / delta.y, ray / delta.z);

		// Atmosphere Thickness ( Rayleigh ) scale
		const Km = 1000.0; // kilo meter unit
		betaR.multiplyScalar(Km * AtmosphereThickness);

		// w channel solves the Rayleigh Offset artifact issue
		this._betaR[0] = betaR.x;
		this._betaR[1] = betaR.y;
		this._betaR[2] = betaR.z;
		this._betaR[3] = Math.max(Math.pow(AtmosphereThickness, Math.PI), 1);

		// w channel solves the Rayleigh Offset artifact issue
		return this._betaR;
	}

}

const _vec3_1 = new t3d.Vector3();
const _vec3_2 = new t3d.Vector3();