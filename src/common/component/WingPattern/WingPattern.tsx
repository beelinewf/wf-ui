import React, { useId } from 'react';

import classes from './WingPattern.module.scss';

// The two wing parallelograms, taken verbatim from the favicon artwork (100 × 100 viewBox).
const UPPER_WING = 'M25.778 46 L47.111 22 L78.222 22 L56.889 46 Z';
const LOWER_WING = 'M29.333 57.556 L46.222 78 L70.222 78 L53.333 57.556 Z';

// Brick grid of mini wings (the guideline's wing pattern), alternating honey and muted pairs.
const TILE = { width: 176, height: 120 };
const WING_SCALE = 0.56;
const PATTERN_CELLS = [
	{ x: 0, y: 0, accent: true },
	{ x: 88, y: 0, accent: false },
	{ x: 44, y: 60, accent: false },
	{ x: 132, y: 60, accent: true },
];

interface WingPatternProps {
	/** Fills the nearest positioned ancestor; pass a class to fade it with `mask-image`. */
	className?: string;
	/** Multiplies the tile and wing size. */
	scale?: number;
}

/** Decorative wing pattern for Ink backgrounds. */
export const WingPattern: React.FC<WingPatternProps> = ({ className, scale = 1 }) => {
	const patternId = useId();

	return (
		<svg className={[classes.root, className].filter(Boolean).join(' ')} aria-hidden="true" focusable="false">
			<defs>
				<pattern
					id={patternId}
					width={TILE.width * scale}
					height={TILE.height * scale}
					patternUnits="userSpaceOnUse"
				>
					{PATTERN_CELLS.map(({ x, y, accent }) => (
						<g
							key={`${x}-${y}`}
							transform={`translate(${x * scale} ${y * scale}) scale(${WING_SCALE * scale})`}
							strokeWidth="4.444"
							strokeLinejoin="round"
						>
							<path d={UPPER_WING} className={accent ? classes.wingHoney : classes.wingMuted} />
							<path d={LOWER_WING} className={classes.wingLower} />
						</g>
					))}
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill={`url(#${CSS.escape(patternId)})`} />
		</svg>
	);
};
