/**
 * Anemophilous Formula — data and constants
 *
 * Every number here comes from the original ActionScript 2 source
 * (index.fla / index_20090913.fla and SnowFlake.as) unless noted.
 */
"use strict";

window.AF = window.AF || {};

/** Daily tree pollen counts, Tallahassee FL, March 1–31 2007 (National Allergy Board data). */
AF.POLLEN_COUNT = [
	823, 2290, 201, 259, 93, 55, 135, 139,
	545, 1371, 671, 831, 617, 722, 901, 844,
	229, 801, 615, 1259, 3134, 2782, 1923,
	4277, 1243, 2579, 3609, 3197, 3182, 3862, 2703,
];

AF.CONFIG = {
	// Flash stage
	stageWidth: 1000,
	stageHeight: 550,
	frameRate: 30, // the SWF ran at 30fps; grain motion is defined per frame

	// Wallpaper photo occupies the top of the stage, the date bar sits below it
	wallpaperHeight: 521,
	barColor: "#1a1a1a",

	// SnowFlake.as
	viewWidth: 1000,
	viewHeight: 560, // grains fall a little past the bottom of the stage before recycling
	speedMultiplier: 5,
	speedVariMultiplier: 4,
	maxDrift: 7,

	// The snowFlake_mc symbol: a #CCFF00 dot, drawn at speed * 9% scale.
	// A 12px symbol matches the grain sizes measured in the 2009 recording.
	grainColor: [0xcc, 0xff, 0x00],
	grainAlpha: 1,
	grainBaseDiameter: 12,
	grainScalePerSpeed: 0.09,

	// Timeline: 350 grains were created, but those with index > 250 had their
	// container hidden at creation and never reappeared, so at most 251 ever fell.
	numFlakes: 350,
	alwaysHiddenAbove: 250,
	pollenDivisor: 8, // _root.newHighestNumber = pollenCount[d] / 8

	// setInterval(updateTimer, 100); the day advances when the counter reaches 40
	tickMs: 100,
	ticksPerDay: 39, // c starts at 1 and the day turns over at c == 40
	clockFrames: 40, // clock_mc advances one frame per tick

	// Date row: createTextField((j*28)+70, 525, 20, 22), Arial 11
	dateX: 70,
	dateStep: 28,
	dateY: 525,
	dateColor: "#888888", // 0x666666 in code; Flash rendered it lighter (measured from the recording)
	dateActiveColor: "#ccff00",
	dateFont: "11px Arial, Helvetica, sans-serif",
	dateActiveFont: "bold 11px Arial, Helvetica, sans-serif",

	// clock_mc, measured from the 2009 recording
	clockX: 14,
	clockY: 534.5,
	clockRadius: 8.5,
	clockColor: "#7a7a7a",
};
