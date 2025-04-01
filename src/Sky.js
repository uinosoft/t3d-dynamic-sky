import { Mesh, ShaderMaterial, DRAW_SIDE, SphereGeometry } from 't3d';
import { SkyShader } from './shaders/SkyShader.js';

export class Sky extends Mesh {

	constructor() {
		const material = new ShaderMaterial(SkyShader);
		material.depthWrite = false;
		material.side = DRAW_SIDE.BACK;

		super(new SphereGeometry(1, 100, 100), material);

		this.frustumCulled = false;
	}

	setPrcomputeTextures(skyPrecomputeUtil) {
		const { transmittanceTexture, inscatterTexture } = skyPrecomputeUtil;
		const { uniforms, defines } = this.material;

		uniforms._Transmittance = transmittanceTexture;
		uniforms._Inscatter = inscatterTexture;

		uniforms.betaR = skyPrecomputeUtil.betaR;

		let needsUpdate = false;

		if (defines.TRANSMITTANCE_MAPPING !== skyPrecomputeUtil.transmittanceMapping) {
			defines.TRANSMITTANCE_MAPPING = skyPrecomputeUtil.transmittanceMapping;
			needsUpdate = true;
		}

		if (defines.INSCATTER_MAPPING !== skyPrecomputeUtil.inscatterMapping) {
			defines.INSCATTER_MAPPING = skyPrecomputeUtil.inscatterMapping;
			needsUpdate = true;
		}

		if (defines.INSCATTER_3D !== skyPrecomputeUtil.use3DInscatterTexture) {
			defines.INSCATTER_3D = skyPrecomputeUtil.use3DInscatterTexture;
			needsUpdate = true;
		}

		if (defines.ALTITUDE_LAYERS !== skyPrecomputeUtil.altitudeLayers) {
			defines.ALTITUDE_LAYERS = skyPrecomputeUtil.altitudeLayers;
			needsUpdate = true;
		}

		this.material.needsUpdate = needsUpdate;
	}

}