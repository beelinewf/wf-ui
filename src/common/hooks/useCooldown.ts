import { useCallback, useEffect, useState } from 'react';

/**
 * A countdown in whole seconds, for holding a submit back after a 429 or between resends.
 * `start(n)` (re)arms it; `remaining` is 0 when idle.
 */
export const useCooldown = () => {
	const [until, setUntil] = useState<number | null>(null);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (until === null) return;
		const timer = setInterval(() => {
			const current = Date.now();
			setNow(current);
			if (current >= until) setUntil(null);
		}, 250);
		return () => clearInterval(timer);
	}, [until]);

	const start = useCallback((seconds: number) => {
		const current = Date.now();
		setNow(current);
		setUntil(current + seconds * 1000);
	}, []);

	const remaining = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));

	return { remaining, active: remaining > 0, start };
};
