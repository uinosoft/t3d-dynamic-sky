import * as t3d from 't3d';
import { clamp, lerp } from "./Utils.js";

export class SkyTimeline {

	constructor(options) {
		// Objects

		this._sunLight = options.sunLight || null;
		this._moonLight = options.moonLight || null;
		this._hemisphereLight = options.hemisphereLight || null;

		this._sky = options.sky || null;
		this._clouds = options.clouds || null;
		this._stars = options.stars || null;

		// Settings

		this._lightColorGradient = (new Gradient()).setColors({
			0: new t3d.Color3(85 / 255, 99 / 255, 112 / 255),
			0.49: new t3d.Color3(85 / 255, 99 / 255, 112 / 255),
			0.51: new t3d.Color3(245 / 255, 173 / 255, 84 / 255),
			0.57: new t3d.Color3(249 / 255, 208 / 255, 144 / 255),
			1: new t3d.Color3(252 / 255, 222 / 255, 186 / 255)
		});

		this._skyColorGradient = (new Gradient()).setColors({
			0: new t3d.Color3(28 / 255, 32 / 255, 40 / 255),
			0.475: new t3d.Color3(28 / 255, 32 / 255, 40 / 255),
			0.5: new t3d.Color3(55 / 255, 65 / 255, 63 / 255),
			0.55: new t3d.Color3(138 / 255, 168 / 255, 168 / 255),
			0.65: new t3d.Color3(145 / 255, 174 / 255, 210 / 255),
			1: new t3d.Color3(145 / 255, 174 / 255, 210 / 255)
		});

		this._equatorColorGradient = (new Gradient()).setColors({
			0: new t3d.Color3(17 / 255, 21 / 255, 30 / 255),
			0.475: new t3d.Color3(17 / 255, 21 / 255, 30 / 255),
			0.52: new t3d.Color3(100 / 255, 100 / 255, 78 / 255),
			0.58: new t3d.Color3(128 / 255, 150 / 255, 128 / 255),
			1: new t3d.Color3(128 / 255, 150 / 255, 128 / 255)
		});

		this._groundColorGradient = (new Gradient()).setColors({
			0: new t3d.Color3(21 / 255, 20 / 255, 19 / 255),
			0.48: new t3d.Color3(21 / 255, 20 / 255, 19 / 255),
			0.55: new t3d.Color3(94 / 255, 89 / 255, 87 / 255),
			1: new t3d.Color3(94 / 255, 89 / 255, 87 / 255)
		});

		this._lightExposure = 1;

		this._sunAndMoon = {
			sunDirection: 0,
			sunEquatorOffset: 30,
			moonPositionOffset: 0,
			distance: 50
		};

		this._sunIntensity = 1;
		this._moonIntensity = 0.6;

		this._sunSize = 1;

		this._nightSkySettings = {
			nightZenithColor: [51 / 255, 74 / 255, 102 / 255, 255 / 255],
			nightHorizonColor: [72 / 255, 100 / 255, 128 / 255, 128 / 255],
			starIntensity: 1,
			outerSpaceIntensity: 0.25,
			moonInnerCorona: [225 / 255, 225 / 255, 225 / 255, 128 / 255],
			moonOuterCorona: [65 / 255, 88 / 255, 128 / 255, 128 / 255],
			moonSize: 1
		};

		this._timeline = 0;

		// Stats

		this._stats = {
			sunQuaternion: new t3d.Quaternion(),
			moonQuaternion: new t3d.Quaternion(),
			sunDirection: new t3d.Vector3(),
			moonDirection: new t3d.Vector3(),
			dayTimeBrightness: 0,
			nightTimeBrightness: 0,
			nightFade: 0,
			moonFade: 0,
			normalizedTime: 0,
			lightColor: new t3d.Color3(),
			skyColor: new t3d.Color3(),
			equatorColor: new t3d.Color3(),
			groundColor: new t3d.Color3()
		};
	}

	set timeline(value) {
		this._timeline = value;

		this.refresh();
	}

	get timeline() {
		return this._timeline;
	}

	refresh() {
		this._updateStats();

		this._updateLights();

		this._updateSkyMaterialUniform();
		this._updateCloudsMaterialUniform();
		this._updateStarsMaterialUniforms();
	}

	_updateStats() {
		const timeline = this._timeline;
		const sunAndMoon = this._sunAndMoon;
		const lightColorGradient = this._lightColorGradient;
		const skyColorGradient = this._skyColorGradient;
		const equatorColorGradient = this._equatorColorGradient;
		const groundColorGradient = this._groundColorGradient;

		const stats = this._stats;
		const { sunQuaternion, moonQuaternion, sunDirection, moonDirection, lightColor, skyColor, equatorColor, groundColor } = stats;

		const t = timeline * 360 / 24 - 90;
		_euler_1.set(0, degreeToRadian(sunAndMoon.sunDirection - 90), degreeToRadian(sunAndMoon.sunEquatorOffset));
		sunQuaternion.setFromEuler(_euler_1);
		_euler_1.set(degreeToRadian(t), 0, 0);
		_quat_1.setFromEuler(_euler_1);
		sunQuaternion.multiply(_quat_1);

		_euler_1.set(degreeToRadian(180), degreeToRadian(sunAndMoon.moonPositionOffset), degreeToRadian(180));
		moonQuaternion.copy(sunQuaternion).multiply(_quat_1.setFromEuler(_euler_1));

		getDirectionFromQuaternion(sunDirection, sunQuaternion, -1);
		getDirectionFromQuaternion(moonDirection, moonQuaternion, -1);

		stats.dayTimeBrightness = clamp(Math.max(sunDirection.y + 0.2, 0.0) / 1.2, 0, 1);
		stats.nightTimeBrightness = 1 - stats.dayTimeBrightness;
		stats.nightFade = Math.pow(stats.nightTimeBrightness, 4);
		stats.moonFade = (moonDirection.y > 0) ? Math.max(clamp((moonDirection.y - 0.1) * Math.PI * stats.nightTimeBrightness - stats.dayTimeBrightness, 0, 1), 0) : 0;

		stats.normalizedTime = sunDirection.y * 0.5 + 0.5;

		lightColorGradient.evaluate(lightColor, stats.normalizedTime);
		skyColorGradient.evaluate(skyColor, stats.normalizedTime);
		equatorColorGradient.evaluate(equatorColor, stats.normalizedTime);
		groundColorGradient.evaluate(groundColor, stats.normalizedTime);

		const exposureScale = Math.pow(this._lightExposure, 0.4);

		colorMultiplyScaler(lightColor, exposureScale);
		colorMultiplyScaler(skyColor, exposureScale);
		colorMultiplyScaler(equatorColor, exposureScale);
		colorMultiplyScaler(groundColor, exposureScale);
	}

	_updateLights() {
		const sunLight = this._sunLight;
		const moonLight = this._moonLight;
		const hemisphereLight = this._hemisphereLight;

		const sunAndMoon = this._sunAndMoon;
		const sunIntensity = this._sunIntensity;
		const moonIntensity = this._moonIntensity;

		const stats = this._stats;
		const { sunQuaternion, moonQuaternion, dayTimeBrightness, nightTimeBrightness, normalizedTime, lightColor, skyColor, groundColor } = stats;

		const daySky = clamp(dayTimeBrightness * 4, 0, 1);
		const nightSky = nightTimeBrightness;

		if (sunLight) {
			getDirectionFromQuaternion(sunLight.position, sunQuaternion, -sunAndMoon.distance);
			sunLight.lookAt(_origin, _up);

			sunLight.color.setRGB(lightColor.r * daySky, lightColor.g * daySky, lightColor.b * daySky);
			sunLight.intensity = normalizedTime > 0.48 ? sunIntensity : 0;
		}

		if (moonLight) {
			getDirectionFromQuaternion(moonLight.position, moonQuaternion, -sunAndMoon.distance);
			moonLight.lookAt(_origin, _up);

			moonLight.color.setRGB(lightColor.r * nightSky, lightColor.g * nightSky, lightColor.b * nightSky);
			moonLight.intensity = (normalizedTime < 0.5 && moonIntensity > 0.01) ? moonIntensity : 0;
		}

		if (hemisphereLight) {
			hemisphereLight.color.copy(skyColor);
			hemisphereLight.groundColor.copy(groundColor);
		}
	}

	_updateSkyMaterialUniform() {
		const nightSkySettings = this._nightSkySettings;

		const stats = this._stats;
		const { moonQuaternion, sunDirection, moonDirection, nightTimeBrightness, nightFade, moonFade } = stats;

		const sky = this._sky;

		if (sky) {
			sunDirection.toArray(sky.material.uniforms['_SunDirSize']);
			sky.material.uniforms['_SunDirSize'][3] = this._sunSize;

			moonDirection.toArray(sky.material.uniforms['_MoonDirSize']);
			sky.material.uniforms['_MoonDirSize'][3] = 8 / nightSkySettings.moonSize;

			sky.material.uniforms['_uSkyNightParams'][0] = nightFade;
			sky.material.uniforms['_uSkyNightParams'][1] = moonFade;
			sky.material.uniforms['_uSkyNightParams'][2] = nightFade;

			_vec4_1.fromArray(nightSkySettings.nightZenithColor).multiplyScalar(nightTimeBrightness * 0.25);
			_vec4_1.toArray(sky.material.uniforms['_NightZenithColor']);

			_vec4_1.fromArray(nightSkySettings.nightHorizonColor).multiplyScalar(nightFade * 0.5);
			_vec4_1.toArray(sky.material.uniforms['_NightHorizonColor']);

			sky.material.uniforms['_MoonInnerCorona'][0] = nightSkySettings.moonInnerCorona[0] * moonFade;
			sky.material.uniforms['_MoonInnerCorona'][1] = nightSkySettings.moonInnerCorona[1] * moonFade;
			sky.material.uniforms['_MoonInnerCorona'][2] = nightSkySettings.moonInnerCorona[2] * moonFade;
			sky.material.uniforms['_MoonInnerCorona'][3] = 4e2 / nightSkySettings.moonInnerCorona[3];

			sky.material.uniforms['_MoonOuterCorona'][0] = nightSkySettings.moonOuterCorona[0] * moonFade * 0.25;
			sky.material.uniforms['_MoonOuterCorona'][1] = nightSkySettings.moonOuterCorona[1] * moonFade * 0.25;
			sky.material.uniforms['_MoonOuterCorona'][2] = nightSkySettings.moonOuterCorona[2] * moonFade * 0.25;
			sky.material.uniforms['_MoonOuterCorona'][3] = 4 / nightSkySettings.moonOuterCorona[3];

			_mat4_1.makeRotationFromQuaternion(moonQuaternion).inverse();
			_mat4_1.toArray(sky.material.uniforms['_SpaceRotationMatrix']);
		}
	}

	_updateCloudsMaterialUniform() {
		const clouds = this._clouds;

		const nightSkySettings = this._nightSkySettings;
		const sunIntensity = this._sunIntensity;
		const moonIntensity = this._moonIntensity;

		const stats = this._stats;
		const { sunDirection, moonDirection, dayTimeBrightness, nightTimeBrightness, nightFade, moonFade, lightColor } = stats;

		if (clouds) {
			sunDirection.toArray(clouds.material.uniforms['_SunDirSize']);
			moonDirection.toArray(clouds.material.uniforms['_MoonDirSize']);

			clouds.material.uniforms['_uSkyNightParams'][0] = nightFade;
			clouds.material.uniforms['_uSkyNightParams'][1] = moonFade;
			// sky.material.uniforms['_uSkyNightParams'][2] = nightFade;

			const currentLightIntensity = lerp(moonIntensity, sunIntensity, clamp(dayTimeBrightness * 1.2, 0, 1));
			clouds.material.uniforms['_SkyLightColor'][0] = lightColor.r * Math.pow(currentLightIntensity, 2.2);
			clouds.material.uniforms['_SkyLightColor'][1] = lightColor.g * Math.pow(currentLightIntensity, 2.2);
			clouds.material.uniforms['_SkyLightColor'][2] = lightColor.b * Math.pow(currentLightIntensity, 2.2);

			_vec4_1.fromArray(nightSkySettings.nightZenithColor).multiplyScalar(nightTimeBrightness * 0.25);
			clouds.material.uniforms['_NightZenithColor'][0] = _vec4_1.x;
			clouds.material.uniforms['_NightZenithColor'][1] = _vec4_1.y;
			clouds.material.uniforms['_NightZenithColor'][2] = _vec4_1.z;
		}
	}

	_updateStarsMaterialUniforms() {
		const stars = this._stars;

		const stats = this._stats;
		const { moonQuaternion, moonFade } = stats;

		if (stars) {
			_mat4_1.makeRotationFromQuaternion(moonQuaternion);
			_mat4_1.toArray(stars.material.uniforms['_StarRotationMatrix']);

			stars.material.uniforms['_StarIntensity'] = 40 * moonFade;
		}
	}

}

const _origin = new t3d.Vector3(0, 0, 0);
const _up = new t3d.Vector3(0, 1, 0);

const _vec4_1 = new t3d.Vector4();
const _mat4_1 = new t3d.Matrix4();

const _euler_1 = new t3d.Euler(0, 0, 0, 'YZX');
const _quat_1 = new t3d.Quaternion();

function degreeToRadian(degree) {
	return degree * Math.PI / 180;
}

function getDirectionFromQuaternion(out, quaternion, distance) {
	out.set(0, 0, 1);
	out.applyQuaternion(quaternion);
	out.normalize();
	return out.multiplyScalar(distance);
}

class Gradient {

	constructor() {
		this._array = [];
	}

	setColors(configure) {
		this._array.length = 0;

		for (const key in configure) {
			this._array.push({ key: +key, value: configure[key] });
		}

		this._array.sort((a, b) => a.key - b.key);

		return this;
	}

	evaluate(out, value) {
		for (let i = 0; i < this._array.length - 1; i++) {
			const e1 = this._array[i];
			const e2 = this._array[i + 1];
			if (e1.key <= value && value <= e2.key) {
				const t = (value - e1.key) / (e2.key - e1.key);
				out.lerpColors(e1.value, e2.value, t);
			}
		}

		return out;
	}

}

function colorMultiplyScaler(color, scalar) {
	color.r *= scalar;
	color.g *= scalar;
	color.b *= scalar;
	return color;
}