/** What the engine records for a part sent without a type. */
const DEFAULT_MIME_TYPE = 'application/octet-stream';

/** `type/subtype` or `type/*`, as the engine's `validMIMEType` takes it: no whitespace, no bare or double wildcard. */
export const FORM_MIME_TYPE_PATTERN = /^[^\s/*]+\/(\*|[^\s/*]+)$/;

/** Whether `type` is one of `allowed`, where `image/*` takes any `image/` type. Parameters are ignored. */
export const matchesMimeType = (type: string, allowed: string[]) => {
	const own = (type.split(';')[0].trim() || DEFAULT_MIME_TYPE).toLowerCase();
	return allowed.some((pattern) => {
		const rule = pattern.trim().toLowerCase();
		return rule.endsWith('/*') ? own.startsWith(rule.slice(0, -1)) : own === rule;
	});
};

const UNITS = ['B', 'KB', 'MB', 'GB'];

/** Bytes in binary units: `1.5 MB`. */
export const formatFileSize = (bytes: number) => {
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${unit === 0 ? value : Number(value.toFixed(1))} ${UNITS[unit]}`;
};

/** A payload for display: each File as its name, so a JSON view shows what's picked. */
export const describeFiles = (value: unknown): unknown => {
	if (value instanceof File) return `<file: ${value.name}>`;
	if (Array.isArray(value)) return value.map(describeFiles);
	if (typeof value === 'object' && value !== null) {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, describeFiles(item)]));
	}
	return value;
};
