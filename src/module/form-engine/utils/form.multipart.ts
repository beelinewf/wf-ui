/** One text part's value: strings as they are, anything else as JSON. */
const textPart = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));

const isScalar = (value: unknown) => value === null || ['string', 'number', 'boolean'].includes(typeof value);

/**
 * A form payload as a `multipart/form-data` body. The engine reads parts flat: each part name is a top-level key and
 * every key arrives as a list. So files and lists of scalars go out one part per item under `key[]`, everything
 * else as one text part, JSON-encoded unless it's a string.
 */
export const buildMultipartBody = (payload: Record<string, unknown>): FormData => {
	const body = new FormData();
	for (const [key, value] of Object.entries(payload)) {
		if (value === undefined) continue;
		if (value instanceof File) {
			body.append(key, value, value.name);
		} else if (Array.isArray(value) && value.length && value.every((item) => item instanceof File)) {
			for (const file of value as File[]) body.append(`${key}[]`, file, file.name);
		} else if (Array.isArray(value) && value.every(isScalar)) {
			for (const item of value) body.append(`${key}[]`, textPart(item));
		} else {
			body.append(key, textPart(value));
		}
	}
	return body;
};
