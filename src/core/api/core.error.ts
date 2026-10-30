import type { CoreQueryError } from './core.baseQuery';

// Used when a 429 arrives without a readable Retry-After, e.g. cross-origin with the header not exposed by CORS.
export const RATE_LIMIT_FALLBACK_SECONDS = 30;

const asQueryError = (error: unknown): Partial<CoreQueryError> | null =>
	error && typeof error === 'object' ? (error as Partial<CoreQueryError>) : null;

export const queryErrorCode = (error: unknown): number | null => {
	const code = asQueryError(error)?.code;
	return typeof code === 'number' ? code : null;
};

// The engine's problem details lead with its error class ("model: invalid: password must be…"), which reads as noise.
const ENGINE_ERROR_PREFIX = /^model: [^:]+: /;

export const queryErrorMessage = (error: unknown, fallback: string): string => {
	const message = asQueryError(error)?.message;
	if (typeof message !== 'string' || !message) return fallback;
	const cleaned = message.replace(ENGINE_ERROR_PREFIX, '');
	return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

/** Seconds to hold off after a 429, or null when the error is not a rate limit. */
export const queryRetryAfter = (error: unknown): number | null => {
	if (queryErrorCode(error) !== 429) return null;
	const seconds = asQueryError(error)?.retryAfter;
	return typeof seconds === 'number' && seconds > 0 ? seconds : RATE_LIMIT_FALLBACK_SECONDS;
};
