import React from 'react';

import { Image } from '@mantine/core';

import { config } from '@config/config';

import symbol from '@assets/brand/beeline-logo-m.svg';
import lockupOnDark from '@assets/brand/beeline-logo-xl-on-dark.svg';
import lockup from '@assets/brand/beeline-logo-xl.svg';

import classes from './BrandMark.module.scss';

// Intrinsic width / height of the artwork.
const LOCKUP_RATIO = 537.796 / 159.375;
const SYMBOL_RATIO = 172.514 / 118.097;

interface BrandMarkProps {
	/** Rendered height in px. */
	size?: number;
	/** `lockup` is the horizontal symbol + wordmark; `symbol` is the symbol on its own, for spots where the brand is already clear. */
	variant?: 'lockup' | 'symbol';
	/** Use `dark` on Ink backgrounds so the dark parts of the lockup switch to Paper. */
	tone?: 'light' | 'dark';
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 32, variant = 'lockup', tone = 'light' }) => {
	const alt = config.value.BEELINE_UI_NAME || 'Beeline';

	if (variant === 'symbol') {
		return <Image src={symbol} alt={alt} w={size * SYMBOL_RATIO} h={size} className={classes.logo} />;
	}

	return (
		<Image
			src={tone === 'dark' ? lockupOnDark : lockup}
			alt={alt}
			w={size * LOCKUP_RATIO}
			h={size}
			className={classes.logo}
		/>
	);
};
