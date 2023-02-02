export function lerp(a, b, t) {
	if (t <= 0) {
		return a;
	} else if (t >= 1) {
		return b;
	}
	return a + (b - a) * t;
}

export function clamp(x, min, max) {
	if (x > max) { return max; }
	if (x < min) { return min; }
	return x;
}