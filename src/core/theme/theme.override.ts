import {
	ActionIcon,
	Badge,
	Button,
	Card,
	createTheme,
	defaultVariantColorsResolver,
	Input,
	Paper,
	rem,
	SegmentedControl,
	Select,
	Switch,
	TextInput,
	Tooltip,
	type CSSVariablesResolver,
	type MantineColorsTuple,
	type VariantColorsResolver,
} from '@mantine/core';

// Brand palette (Beeline brand guideline).
export const BRAND = {
	honey: '#f8a23b',
	ink: '#1a1a1a',
	stone: '#8a8378',
	sand: '#e7e1d6',
	paper: '#fcfaf6',
} as const;

// Honey sits at shade 5; darker shades keep honey-tinted text readable on light surfaces.
const brand: MantineColorsTuple = [
	'#fef6ea',
	'#fdeacf',
	'#fcd7a3',
	'#fac274',
	'#f9b157',
	BRAND.honey,
	'#e08b22',
	'#b86e12',
	'#8f540d',
	'#663b08',
];

// Warm neutrals built from Paper → Sand → Stone → Ink, replacing Mantine's cool grays.
const gray: MantineColorsTuple = [
	'#f7f4ee',
	'#f0ebe2',
	BRAND.sand,
	'#d8d0c3',
	'#bdb5a8',
	'#a39c90',
	BRAND.stone,
	'#6b655c',
	'#4d4943',
	'#2e2c29',
];

const dark: MantineColorsTuple = [
	BRAND.sand,
	'#c9c2b6',
	'#a39c90',
	BRAND.stone,
	'#5e5a54',
	'#45423e',
	'#33312e',
	'#262523',
	'#201f1e',
	BRAND.ink,
];

// Honey is too light for text, so tinted variants of the brand color use a deeper shade for their label.
const variantColorResolver: VariantColorsResolver = (input) => {
	const colors = defaultVariantColorsResolver(input);
	const isBrand = (input.color ?? input.theme.primaryColor) === 'brand';
	if (!isBrand) return colors;

	switch (input.variant) {
		case 'light':
		case 'subtle':
			return { ...colors, color: 'var(--mantine-color-brand-8)' };
		case 'outline':
			return {
				...colors,
				color: 'var(--mantine-color-brand-8)',
				border: `${rem(1)} solid var(--mantine-color-brand-5)`,
			};
		default:
			return colors;
	}
};

export const cssVariablesResolver: CSSVariablesResolver = () => ({
	variables: {},
	light: {
		// Shell chrome (page, header, nav) sits on Paper; content surfaces stay white.
		'--app-color-shell': BRAND.paper,
		'--mantine-color-text': BRAND.ink,
		'--mantine-color-anchor': 'var(--mantine-color-brand-8)',
		// Stone alone falls under 4.5:1 on Paper; one step darker keeps secondary text legible.
		'--mantine-color-dimmed': 'var(--mantine-color-gray-7)',
	},
	dark: {},
});

export const themeOverride = createTheme({
	colors: { brand, gray, dark },
	primaryColor: 'brand',
	primaryShade: 5,
	autoContrast: true,
	white: '#ffffff',
	black: BRAND.ink,
	fontFamily: 'Inter, sans-serif',
	headings: { fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: '600' },
	defaultRadius: 'md',
	radius: { xs: rem(4), sm: rem(6), md: rem(10), lg: rem(14), xl: rem(20) },
	fontSizes: { xs: rem(12), sm: rem(14), md: rem(16), lg: rem(18), xl: rem(22) },
	shadows: {
		xs: '0 1px 2px rgb(26 26 26 / 4%)',
		sm: '0 1px 3px rgb(26 26 26 / 6%), 0 1px 2px rgb(26 26 26 / 4%)',
	},
	variantColorResolver,
	other: {
		surfaceMuted: gray[0],
		borderSubtle: gray[2],
	},
	components: {
		Button: Button.extend({ defaultProps: { radius: 'md', fw: 500 } }),
		ActionIcon: ActionIcon.extend({ defaultProps: { radius: 'md', variant: 'subtle', color: 'gray' } }),
		Card: Card.extend({ defaultProps: { radius: 'md', withBorder: true, shadow: 'xs', padding: 'md' } }),
		Paper: Paper.extend({ defaultProps: { radius: 'md' } }),
		Badge: Badge.extend({ defaultProps: { radius: 'sm', variant: 'light', tt: 'none', fw: 500 } }),
		Input: Input.extend({ defaultProps: { radius: 'md' } }),
		TextInput: TextInput.extend({ defaultProps: { radius: 'md' } }),
		Select: Select.extend({ defaultProps: { radius: 'md' } }),
		Switch: Switch.extend({ defaultProps: { size: 'md', withThumbIndicator: false } }),
		SegmentedControl: SegmentedControl.extend({
			defaultProps: { radius: 'md', color: 'brand', fullWidth: true },
		}),
		Tooltip: Tooltip.extend({ defaultProps: { withArrow: true, openDelay: 200 } }),
	},
});
