import { PIXEL_TYPE, RenderTarget2D, RenderTarget3D, TEXTURE_FILTER, PIXEL_FORMAT, ShaderPostPass, Vector3, MathUtils } from 't3d';
import { TransmittanceShader } from './shaders/TransmittanceShader.js';
import { InscatterShader } from './shaders/InscatterShader.js';

export class SkyPrecomputeUtil {

	constructor(capabilities, options = {}) {
		const isWebGL2 = capabilities.version > 1;

		// Transmittance mapping
		// 0 - linear implementation
		// 1 - original implementation in 2008
		// 2 - new implementation in 2017
		const transmittanceMapping = options.transmittanceMapping !== undefined ? options.transmittanceMapping : 1;

		// Inscatter mapping
		// 0 - linear implementation
		// 1 - non-linear implementation
		const inscatterMapping = options.inscatterMapping !== undefined ? options.inscatterMapping : 1;

		// Whether to use 3D inscatter texture
		const use3DInscatterTexture = options.use3DInscatterTexture !== undefined ? (options.use3DInscatterTexture && isWebGL2) : false;

		// Number of layers to precompute for altitude
		// If use3DInscatterTexture is true, this value is ignored, because the number of layers is fixed to 32
		// If use3DInscatterTexture is false, and altitudeLayers is set to 4, the render layers are set to 1, 2, 4, 8
		// If use3DInscatterTexture is false, and altitudeLayers is set to 1, the render layers are set to 1 only
		const altitudeLayers = options.altitudeLayers !== undefined ? options.altitudeLayers : 4;

		// ios provides a poor implementation of float linear, so fallback to Half Float
		const isIOS = /(iPad|iPhone|iPod)/g.test(navigator.userAgent);

		let type;

		if (isWebGL2) {
			if (capabilities.getExtension('EXT_color_buffer_float') && capabilities.getExtension('OES_texture_float_linear') && !isIOS) {
				type = PIXEL_TYPE.FLOAT;
			} else {
				type = PIXEL_TYPE.HALF_FLOAT;
			}
		} else {
			if (capabilities.getExtension('OES_texture_float') && capabilities.getExtension('OES_texture_float_linear') && !isIOS) {
				type = PIXEL_TYPE.FLOAT;
			} else if (capabilities.getExtension('OES_texture_half_float') && capabilities.getExtension('OES_texture_half_float_linear')) {
				type = PIXEL_TYPE.HALF_FLOAT;
			} else {
				type = PIXEL_TYPE.UNSIGNED_BYTE;
				console.warn('Half float texture is not supported!');
			}
		}

		// Render targets

		const transmittanceRT = new RenderTarget2D(256, 64);
		transmittanceRT.texture.minFilter = TEXTURE_FILTER.LINEAR;
		transmittanceRT.texture.magFilter = TEXTURE_FILTER.LINEAR;
		transmittanceRT.texture.type = type;
		transmittanceRT.texture.format = PIXEL_FORMAT.RGBA;
		transmittanceRT.texture.generateMipmaps = false;

		const inscatterRT = use3DInscatterTexture ? new RenderTarget3D(256, 128, 32) : new RenderTarget2D(512, 512);
		inscatterRT.texture.minFilter = TEXTURE_FILTER.LINEAR;
		inscatterRT.texture.magFilter = TEXTURE_FILTER.LINEAR;
		inscatterRT.texture.type = type;
		inscatterRT.texture.format = PIXEL_FORMAT.RGBA;
		inscatterRT.texture.generateMipmaps = false;

		// Render Passes

		const betaR = [5.8e-3, 1.35e-2, 3.31e-2, 1]; // default betaR

		const transmittancePass = new ShaderPostPass(TransmittanceShader);
		transmittancePass.uniforms.betaR = betaR;
		transmittancePass.material.defines.TRANSMITTANCE_MAPPING = transmittanceMapping;

		const inscatterPass = new ShaderPostPass(InscatterShader);
		inscatterPass.uniforms._Transmittance = transmittanceRT.texture;
		inscatterPass.uniforms.betaR = betaR;
		inscatterPass.material.defines.TRANSMITTANCE_MAPPING = transmittanceMapping;
		inscatterPass.material.defines.INSCATTER_MAPPING = inscatterMapping;
		inscatterPass.material.defines.INSCATTER_3D = !!use3DInscatterTexture;
		inscatterPass.material.defines.ALTITUDE_LAYERS = altitudeLayers;

		//

		this._transmittanceRT = transmittanceRT;
		this._inscatterRT = inscatterRT;

		this._transmittancePass = transmittancePass;
		this._inscatterPass = inscatterPass;

		this._betaR = betaR;

		this._transmittanceMapping = transmittanceMapping;
		this._inscatterMapping = inscatterMapping;
		this._use3DInscatterTexture = use3DInscatterTexture;
		this._altitudeLayers = altitudeLayers;
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

	get transmittanceMapping() {
		return this._transmittanceMapping;
	}

	get inscatterMapping() {
		return this._inscatterMapping;
	}

	get use3DInscatterTexture() {
		return this._use3DInscatterTexture;
	}

	get altitudeLayers() {
		return this._altitudeLayers;
	}

	computeTransmittance(renderer) {
		renderer.setRenderTarget(this._transmittanceRT);
		renderer.setClearColor(0, 0, 0, 0);
		renderer.clear(true, true, true);
		this._transmittancePass.render(renderer);
	}

	computeInscatter(renderer) {
		const inscatterRT = this._inscatterRT;
		const inscatterPass = this._inscatterPass;
		if (inscatterRT.isRenderTarget3D) {
			for (let i = 0; i < 32; i++) {
				inscatterRT.activeLayer = i;
				inscatterPass.uniforms.layer = i;
				renderer.setRenderTarget(inscatterRT);
				renderer.setClearColor(0, 0, 0, 0);
				renderer.clear(true, true, true);
				inscatterPass.render(renderer);
			}
		} else {
			renderer.setRenderTarget(inscatterRT);
			renderer.setClearColor(0, 0, 0, 0);
			renderer.clear(true, true, true);
			inscatterPass.render(renderer);
		}
	}

	setBetaRayleighDensity(wavelengths, skyTint, atmosphereThickness) {
		// Sky Tint shifts the value of Wavelengths
		const variableRangeWavelengths = _vec3_1.set(
			MathUtils.lerp(wavelengths.x + 150, wavelengths.x - 150, skyTint.r),
			MathUtils.lerp(wavelengths.y + 150, wavelengths.y - 150, skyTint.g),
			MathUtils.lerp(wavelengths.z + 150, wavelengths.z - 150, skyTint.b)
		);

		variableRangeWavelengths.x = MathUtils.clamp(variableRangeWavelengths.x, 380, 780);
		variableRangeWavelengths.y = MathUtils.clamp(variableRangeWavelengths.y, 380, 780);
		variableRangeWavelengths.z = MathUtils.clamp(variableRangeWavelengths.z, 380, 780);

		// Evaluate Beta Rayleigh function is based on A.J.Preetham

		const WL = variableRangeWavelengths.multiplyScalar(1e-9); // nano meter unit

		const n = 1.0003; // the index of refraction of air
		const N = 2.545e25; // molecular density at sea level
		const pn = 0.035; // depolatization factor for standard air

		const waveLength4 = _vec3_2.set(Math.pow(WL.x, 4), Math.pow(WL.y, 4), Math.pow(WL.z, 4));
		const delta = waveLength4.multiplyScalar(3.0 * N * (6.0 - 7.0 * pn));
		const ray = (8 * Math.pow(Math.PI, 3) * Math.pow(n * n - 1.0, 2) * (6.0 + 3.0 * pn));
		const betaR = _vec3_1.set(ray / delta.x, ray / delta.y, ray / delta.z);

		// Atmosphere Thickness ( Rayleigh ) scale
		const Km = 1000.0; // kilo meter unit
		betaR.multiplyScalar(Km * atmosphereThickness);

		// w channel solves the Rayleigh Offset artifact issue
		this._betaR[0] = betaR.x;
		this._betaR[1] = betaR.y;
		this._betaR[2] = betaR.z;
		this._betaR[3] = Math.max(Math.pow(atmosphereThickness, Math.PI), 1);

		// w channel solves the Rayleigh Offset artifact issue
		return this._betaR;
	}

	dispose() {
		this._transmittanceRT.dispose();
		this._inscatterRT.dispose();

		this._transmittancePass.dispose();
		this._inscatterPass.dispose();
	}

}

const _vec3_1 = new Vector3();
const _vec3_2 = new Vector3();