/** Parses the raw payload box: blank sends `{}`. Null when the text isn't JSON. */
export const parseRawPayload = (raw: string): { payload: unknown } | null => {
	try {
		return { payload: raw.trim() ? JSON.parse(raw) : {} };
	} catch {
		return null;
	}
};

const MULTIPART = 'multipart/form-data';
const JSON_TYPE = 'application/json';

/** What an input node takes, from `pending_input.accept`; absent is JSON only. */
export const inputBodyTypes = (accept: string[] | undefined) => ({
	json: !accept?.length || accept.includes(JSON_TYPE),
	multipart: !!accept?.includes(MULTIPART),
});

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
