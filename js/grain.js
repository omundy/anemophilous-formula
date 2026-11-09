/**
 * Anemophilous Formula — a single pollen grain
 *
 * A direct port of SnowFlake.as (itself adapted from
 * http://pixelfumes.blogspot.com/2006/11/actionscript-2-version-of-snow-storm.html).
 * Positions are in Flash stage pixels; step() is one Flash frame.
 */
"use strict";

window.AF = window.AF || {};

AF.Grain = class Grain {
	/**
	 * @param {number} index  creation order; the data decides which indices are visible
	 */
	constructor(index) {
		const c = AF.CONFIG;
		this.index = index;

		// speed is chosen once per grain; only drift changes when it recycles
		const n = Math.random() * c.speedMultiplier;
		this.speedVariation = Math.random() * c.speedVariMultiplier + 1;
		this.speed = n * this.speedVariation + 1; // 1 to 26 px/frame

		// everyFrame(): this._xscale = this._yscale = speed * 9
		this.diameter = c.grainBaseDiameter * this.speed * c.grainScalePerSpeed;

		// timeline: grains past 250 were hidden at creation and never shown again
		this.hiddenForever = index > c.alwaysHiddenAbove;

		this.sprite = null;
		this.spriteVersion = -1;

		// in the constructor the data hasn't loaded yet, so every grain starts visible
		this.recycle(null);
	}

	/** readyFlake(): new drift, new position above the stage, and a fresh look at the data */
	recycle(highest) {
		const c = AF.CONFIG;

		// getDrift()
		this.drift = Math.random() * c.maxDrift;
		if (Math.random() * 10 < 5) this.drift *= -1;

		this.y = Math.random() * c.viewHeight * -1;
		this.x = Math.random() * c.viewWidth;
		this.prevX = this.x;
		this.prevY = this.y;

		// "Change the amount by setting them to invisible": a grain only picks up a
		// new day's count when it recycles, so the density shifts gradually
		this.visible = highest === null || !(this.index > highest);

		// new BlurFilter(drift * 2, speed / 2, 2). Flash clamps a negative blurX to 0,
		// so grains drifting left fall crisp and grains drifting right smear sideways.
		this.blurX = Math.max(0, this.drift * 2);
		this.blurY = this.speed / 2;
		this.spriteVersion = -1;
	}

	/** everyFrame() */
	step(highest) {
		const c = AF.CONFIG;
		this.prevX = this.x;
		this.prevY = this.y;
		this.y += this.speed;
		this.x += this.drift;
		if (this.y > c.viewHeight || this.x < 0 || this.x > c.viewWidth) {
			this.recycle(highest);
		}
	}

	get shown() {
		return this.visible && !this.hiddenForever;
	}
};

/**
 * Pre-rendered, blurred grain images. Flash's BlurFilter with quality 2 is two
 * passes of a box blur with separate horizontal and vertical sizes, which canvas
 * filters can't do, so it is done here once per (size, blur) and cached.
 * Sprites are drawn at device resolution and rebuilt when the window resizes.
 */
AF.SpriteCache = class SpriteCache {
	constructor() {
		this.map = new Map();
		this.resolution = 1;
		this.version = 0;
		const [r, g, b] = AF.CONFIG.grainColor;
		this.rgb = [r, g, b];
	}

	setResolution(res) {
		res = Math.max(0.5, Math.round(res * 4) / 4);
		if (res === this.resolution) return;
		this.resolution = res;
		this.map.clear();
		this.version++;
	}

	/** Look up (or build) the sprite for a grain, memoised on the grain itself. */
	forGrain(grain) {
		if (grain.spriteVersion !== this.version) {
			grain.sprite = this.get(grain.diameter, grain.blurX, grain.blurY);
			grain.spriteVersion = this.version;
		}
		return grain.sprite;
	}

	get(diameter, blurX, blurY) {
		const d = Math.round(diameter * 4) / 4;
		const bx = Math.round(blurX * 2) / 2;
		const by = Math.round(blurY * 2) / 2;
		const key = d + "|" + bx + "|" + by;
		let sprite = this.map.get(key);
		if (!sprite) {
			sprite = this.build(d, bx, by);
			this.map.set(key, sprite);
		}
		return sprite;
	}

	build(diameter, blurX, blurY) {
		const R = this.resolution;
		const radius = Math.max(diameter * R, 0.6) / 2;

		// box radius per pass, in device pixels
		const rx = Math.floor((blurX * R) / 2);
		const ry = Math.floor((blurY * R) / 2);
		const padX = rx * 2 + 2;
		const padY = ry * 2 + 2;

		const w = Math.ceil(radius * 2) + padX * 2;
		const h = Math.ceil(radius * 2) + padY * 2;

		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d", { willReadFrequently: true });
		ctx.fillStyle = "rgb(" + this.rgb.join(",") + ")";
		ctx.beginPath();
		ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
		ctx.fill();

		if (rx > 0 || ry > 0) {
			const img = ctx.getImageData(0, 0, w, h);
			const px = img.data;
			// the colour is uniform, so only the alpha channel needs blurring
			let a = new Float32Array(w * h);
			for (let i = 0; i < a.length; i++) a[i] = px[i * 4 + 3];
			let tmp = new Float32Array(w * h);
			for (let pass = 0; pass < 2; pass++) {
				if (rx > 0) { boxBlur(a, tmp, w, h, rx, 1, w); [a, tmp] = [tmp, a]; }
				if (ry > 0) { boxBlur(a, tmp, h, w, ry, w, 1); [a, tmp] = [tmp, a]; }
			}
			const [r, g, b] = this.rgb;
			for (let i = 0; i < a.length; i++) {
				const o = i * 4;
				px[o] = r; px[o + 1] = g; px[o + 2] = b;
				px[o + 3] = a[i];
			}
			ctx.putImageData(img, 0, 0);
		}

		return { canvas, w: w / R, h: h / R, ox: w / 2 / R, oy: h / 2 / R };
	}
};

/**
 * One box-blur pass along lines of a 2D array.
 * @param len     samples per line
 * @param lines   number of lines
 * @param stride  distance between samples on a line
 * @param lineStep distance between lines
 */
function boxBlur(src, dst, len, lines, r, stride, lineStep) {
	const norm = 1 / (r * 2 + 1);
	for (let line = 0; line < lines; line++) {
		const base = line * lineStep;
		let sum = 0;
		for (let k = 0; k <= r && k < len; k++) sum += src[base + k * stride];
		for (let i = 0; i < len; i++) {
			dst[base + i * stride] = sum * norm;
			const add = i + r + 1;
			const sub = i - r;
			if (add < len) sum += src[base + add * stride];
			if (sub >= 0) sum -= src[base + sub * stride];
		}
	}
}
