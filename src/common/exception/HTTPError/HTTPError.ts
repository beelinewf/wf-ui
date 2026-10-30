import type { ComplexQueryParam } from '@common/types/ComplexQueryParam';
import type { HTTPResponse } from '@common/types/HTTPResponse';

export class HTTPError extends Error implements HTTPResponse<string> {
	constructor(code?: number, data?: string, explain?: string, message?: string, retryAfter?: number) {
		super(message);
		this.retryAfter = retryAfter;
		this.code = code || 500;
		this.data = data || 'Unknown Error';
		this.explain = explain || 'Unknown Error';
		this.message = message || 'Unknown Error';
		this.param = {};
	}
	readonly code: number;
	readonly data: string;
	readonly explain: string;
	readonly message: string;
	readonly param: ComplexQueryParam;
	/** Whole seconds from a 429's Retry-After header. */
	readonly retryAfter?: number;
}
