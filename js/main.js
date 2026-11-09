/**
 * Anemophilous Formula for Computer Art
 * Owen Mundy & Joelle Dietrick, 2007
 *
 * Vanilla JavaScript rebuild of the ActionScript 2 timeline code.
 *
 * URL options:
 *   ?kiosk       skip the intro, hide the cursor, start sound on first interaction
 *   ?day=21      start on a given day of March (1–31)
 *   ?muted       start with the sound off
 */
"use strict";

(function () {
	const C = AF.CONFIG;
	const POLLEN = AF.POLLEN_COUNT;
	const DAYS = POLLEN.length;
	const FRAME_MS = 1000 / C.frameRate;
	const params = new URLSearchParams(location.search);

	const intro = document.getElementById("intro");
	const info = document.getElementById("info");
	const readout = {
		date: document.getElementById("readout-date"),
		count: document.getElementById("readout-count"),
		grains: document.getElementById("readout-grains"),
	};

	// ------------------------------------------------------------------ stage

	const canvas = document.getElementById("stage");
	const ctx = canvas.getContext("2d");
	const view = { scale: 1, dpr: 1, ox: 0, oy: 0 };
	const sprites = new AF.SpriteCache();

	// The photo is a 3000px upscale of the original 1000px wallpaper. It is resampled
	// once per resize to the exact device size, so each frame is a 1:1 copy.
	const wallpaper = new Image();
	const background = document.createElement("canvas");
	wallpaper.onload = buildBackground;
	wallpaper.src = "assets/img/wallpaper.jpg";

	function buildBackground() {
		if (!wallpaper.complete || !wallpaper.naturalWidth) return;
		const s = view.scale * view.dpr;
		background.width = Math.max(1, Math.round(C.stageWidth * s));
		background.height = Math.max(1, Math.round(C.wallpaperHeight * s));
		const bctx = background.getContext("2d");
		bctx.imageSmoothingEnabled = true;
		bctx.imageSmoothingQuality = "high";
		bctx.drawImage(wallpaper, 0, 0, background.width, background.height);
		background.ready = true;
	}

	function resize() {
		const dpr = window.devicePixelRatio || 1;
		const cw = window.innerWidth;
		const ch = window.innerHeight;
		canvas.width = Math.round(cw * dpr);
		canvas.height = Math.round(ch * dpr);

		// fit the 1000×550 stage to the window, letterboxed in black
		const scale = Math.min(cw / C.stageWidth, ch / C.stageHeight);
		view.scale = scale;
		view.dpr = dpr;
		view.ox = Math.round(((cw - C.stageWidth * scale) / 2) * dpr) / dpr;
		view.oy = Math.round(((ch - C.stageHeight * scale) / 2) * dpr) / dpr;
		sprites.setResolution(scale * dpr);
		buildBackground();
	}
	window.addEventListener("resize", resize);
	resize();

	// ------------------------------------------------------------------ pollen

	const grains = [];
	for (let i = 0; i < C.numFlakes; i++) grains.push(new AF.Grain(i));

	// _root.newHighestNumber: grains with an index above this hide when they recycle.
	// It stays null (everything visible) until the first day begins.
	let highest = null;

	// ------------------------------------------------------------------ timer

	let day = -1; // index into POLLEN; -1 before the first day turns over
	let tickCounter = 0;
	let clockFrame = 0;

	function updateTimer() {
		clockFrame = (clockFrame + 1) % C.clockFrames;
		if (++tickCounter >= C.ticksPerDay) {
			tickCounter = 0;
			setDay((day + 1) % DAYS);
		}
	}

	function setDay(d) {
		day = d;
		highest = POLLEN[day] / C.pollenDivisor;
		updateReadout();
	}

	const startDay = parseInt(params.get("day"), 10);
	if (startDay >= 1 && startDay <= DAYS) setDay(startDay - 1);

	// ------------------------------------------------------------------ loop

	let last = performance.now();
	let frameAcc = 0;
	let tickAcc = 0;

	function frame(now) {
		// clamp so a backgrounded tab doesn't fast-forward on return
		const dt = Math.min(now - last, 250);
		last = now;

		frameAcc += dt;
		while (frameAcc >= FRAME_MS) {
			for (let i = 0; i < grains.length; i++) grains[i].step(highest);
			frameAcc -= FRAME_MS;
		}

		tickAcc += dt;
		while (tickAcc >= C.tickMs) {
			updateTimer();
			tickAcc -= C.tickMs;
		}

		render(frameAcc / FRAME_MS);
		requestAnimationFrame(frame);
	}

	// ------------------------------------------------------------------ drawing

	function render(t) {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1;
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		const s = view.scale * view.dpr;
		ctx.setTransform(s, 0, 0, s, view.ox * view.dpr, view.oy * view.dpr);
		ctx.save();
		ctx.beginPath();
		ctx.rect(0, 0, C.stageWidth, C.stageHeight);
		ctx.clip();

		// timeline layers sit beneath the grains
		if (background.ready) {
			ctx.drawImage(background, 0, 0, C.stageWidth, C.wallpaperHeight);
		}
		ctx.fillStyle = C.barColor;
		ctx.fillRect(0, C.wallpaperHeight, C.stageWidth, C.stageHeight - C.wallpaperHeight);
		drawClock(tickAcc / C.tickMs);

		// grains (created at depths 1–350, later ones on top)
		ctx.globalAlpha = C.grainAlpha;
		for (let i = 0; i < grains.length; i++) {
			const g = grains[i];
			if (!g.shown) continue;
			const sp = sprites.forGrain(g);
			const x = g.prevX + (g.x - g.prevX) * t;
			const y = g.prevY + (g.y - g.prevY) * t;
			ctx.drawImage(sp.canvas, x - sp.ox, y - sp.oy, sp.w, sp.h);
		}
		ctx.globalAlpha = 1;

		// date text fields were created after the grains, so they draw on top
		drawDates();
		ctx.restore();
	}

	/** @param {number} t  progress toward the next tick (0–1), so the hand sweeps rather than steps */
	function drawClock(t) {
		const angle = ((clockFrame + t) / C.clockFrames) * Math.PI * 2 - Math.PI / 2;
		const r = C.clockRadius;
		ctx.strokeStyle = C.clockColor;
		ctx.lineWidth = 1.5;
		ctx.lineCap = "round";
		ctx.beginPath();
		ctx.arc(C.clockX, C.clockY, r, 0, Math.PI * 2);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(C.clockX, C.clockY);
		ctx.lineTo(C.clockX + Math.cos(angle) * (r - 2), C.clockY + Math.sin(angle) * (r - 2));
		ctx.stroke();
	}

	function drawDates() {
		ctx.textBaseline = "top";
		ctx.textAlign = "left";
		for (let j = 0; j < DAYS; j++) {
			const active = j === day;
			ctx.font = active ? C.dateActiveFont : C.dateFont;
			ctx.fillStyle = active ? C.dateActiveColor : C.dateColor;
			// a Flash TextField insets its text by 2px
			ctx.fillText(String(j + 1), j * C.dateStep + C.dateX + 2, C.dateY + 2);
		}
	}

	// ------------------------------------------------------------------ sound

	/**
	 * Birdsong loop (pollensound_clean.wav). Web Audio gives a gapless loop like
	 * Flash's onSoundComplete restart; over file:// fetch is blocked, so fall
	 * back to a looping <audio> element.
	 */
	const sound = (function () {
		const src = "assets/sound/pollensound.mp3";
		let muted = params.has("muted");
		let started = false;
		let audioCtx = null;
		let gain = null;
		let element = null;
		const bytes = fetch(src).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)));
		bytes.catch(() => {}); // handled in start()

		async function start() {
			if (started) {
				if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
				if (element && element.paused) element.play().catch(() => {});
				return;
			}
			started = true;
			const AC = window.AudioContext || window.webkitAudioContext;
			try {
				if (!AC) throw new Error("no Web Audio");
				audioCtx = new AC();
				gain = audioCtx.createGain();
				gain.gain.value = muted ? 0 : 1;
				gain.connect(audioCtx.destination);
				const buffer = await audioCtx.decodeAudioData(await bytes);
				const node = audioCtx.createBufferSource();
				node.buffer = buffer;
				node.loop = true;
				node.connect(gain);
				node.start();
			} catch (err) {
				audioCtx = null;
				element = new Audio(src);
				element.loop = true;
				element.muted = muted;
				element.play().catch(() => { started = false; });
			}
		}

		function toggleMute() {
			muted = !muted;
			if (gain) gain.gain.setTargetAtTime(muted ? 0 : 1, audioCtx.currentTime, 0.05);
			if (element) element.muted = muted;
			if (!started && !muted) start();
		}

		return { start, toggleMute };
	})();

	// ------------------------------------------------------------------ interface

	function updateReadout() {
		if (info.hidden) return;
		if (day < 0) {
			readout.date.textContent = "—";
			readout.count.textContent = "—";
		} else {
			readout.date.textContent = "March " + (day + 1) + ", 2007";
			readout.count.textContent = POLLEN[day].toLocaleString("en-US");
		}
		readout.grains.textContent = grains.filter((g) => g.shown).length;
	}
	setInterval(updateReadout, 500);

	function begin() {
		if (!intro.classList.contains("fade")) {
			intro.classList.add("fade");
			setTimeout(() => (intro.hidden = true), 800);
		}
		sound.start();
	}

	function toggleFullscreen() {
		const el = document.documentElement;
		if (document.fullscreenElement || document.webkitFullscreenElement) {
			(document.exitFullscreen || document.webkitExitFullscreen).call(document);
		} else if (el.requestFullscreen) {
			el.requestFullscreen().catch(() => {});
		} else if (el.webkitRequestFullscreen) {
			el.webkitRequestFullscreen();
		}
	}

	function toggleInfo() {
		info.hidden = !info.hidden;
		updateReadout();
	}

	document.getElementById("start").addEventListener("click", begin);
	intro.addEventListener("click", begin);
	canvas.addEventListener("dblclick", toggleFullscreen);
	// any interaction counts as the gesture browsers need before playing sound
	window.addEventListener("pointerdown", () => sound.start());

	window.addEventListener("keydown", (e) => {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const key = e.key.toLowerCase();
		if (key === "f") toggleFullscreen();
		else if (key === "m") sound.toggleMute();
		else if (key === "i") toggleInfo();
		else if (key === "escape" && !info.hidden) toggleInfo();
		else if (!intro.hidden && (key === "enter" || key === " ")) {
			e.preventDefault();
			begin();
			return;
		} else return;
		begin();
	});

	// hide the cursor when the mouse is still
	let idleTimer = 0;
	function wake() {
		document.body.classList.remove("hide-cursor");
		clearTimeout(idleTimer);
		idleTimer = setTimeout(() => document.body.classList.add("hide-cursor"), 2500);
	}
	window.addEventListener("pointermove", wake);
	wake();

	if (params.has("kiosk")) {
		intro.hidden = true;
		document.body.classList.add("hide-cursor");
		sound.start(); // usually blocked until the first click or key press
	}

	requestAnimationFrame(frame);
})();
