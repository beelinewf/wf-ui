import { config } from '@config/config';

import { isOAuthTokenExpiring, refreshOAuthSession } from '@core/auth/oauth';
import { clearSession, expireSession, isLocalSessionExpired } from '@core/auth/store';

import { buildAuthHead, getCoreAuth, type CoreStoreApi } from './core.authHead';

export interface CoreSseFrame {
	id: string | null;
	/** `message` when the frame names no event. */
	event: string;
	data: string;
}

export type CoreSseCloseReason = { type: 'closed' } | { type: 'unauthorized' } | { type: 'http'; code: number };

export interface CoreSseOptions {
	api: CoreStoreApi;
	/** Relative to the engine base URL. */
	path: string;
	onFrame: (frame: CoreSseFrame) => void;
	/** Every time a response starts streaming, including after a reconnect. */
	onOpen?: () => void;
	/** The stream dropped and another attempt is scheduled. */
	onRetry?: (attempt: number) => void;
	/** The stream ended for good; not called after `close()`. */
	onEnd?: (reason: CoreSseCloseReason) => void;
}

export interface CoreSse {
	close: () => void;
}

const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;

/** Full jitter: anywhere between half and the whole capped exponential delay. */
const retryDelay = (attempt: number) => {
	const cap = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt);
	return cap / 2 + Math.random() * (cap / 2);
};

/** Codes a retry may cure; anything else in the 4xx range will answer the same way again. */
const isRetryableCode = (code: number) => code >= 500 || code === 408 || code === 429;

/**
 * Splits a text/event-stream into frames as chunks arrive. Field handling follows the HTML spec:
 * comments (`:`) are skipped, `data` lines join with `\n`, and a blank line dispatches the frame.
 */
export const createSseParser = (onFrame: (frame: CoreSseFrame) => void) => {
	let buffer = '';
	let id: string | null = null;
	let event = '';
	let data: string[] = [];

	const dispatch = () => {
		if (data.length > 0) onFrame({ id, event: event || 'message', data: data.join('\n') });
		event = '';
		data = [];
	};

	const readLine = (line: string) => {
		if (line === '') return dispatch();
		if (line.startsWith(':')) return;

		const colon = line.indexOf(':');
		const field = colon === -1 ? line : line.slice(0, colon);
		let value = colon === -1 ? '' : line.slice(colon + 1);
		if (value.startsWith(' ')) value = value.slice(1);

		if (field === 'data') data.push(value);
		else if (field === 'event') event = value;
		else if (field === 'id' && !value.includes('\0')) id = value;
	};

	// A `\r\n` split across chunks would otherwise read as a line end followed by a blank line.
	let pendingCr = false;

	return (chunk: string) => {
		if (pendingCr && chunk.startsWith('\n')) chunk = chunk.slice(1);
		pendingCr = chunk.endsWith('\r');
		buffer += chunk;
		const lines = buffer.split(/\r\n|\r|\n/);
		buffer = lines.pop() ?? '';
		for (const line of lines) readLine(line);
	};
};

/**
 * Opens an authenticated event stream with `fetch`, since `EventSource` cannot send the auth header.
 * Drops and server-side closes reconnect with backoff until the caller closes the stream; a 401
 * refreshes an OAuth session once, and other client errors end it.
 */
export const openCoreSse = (options: CoreSseOptions): CoreSse => {
	const { api } = options;
	let controller: AbortController | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let closed = false;
	let attempt = 0;

	const end = (reason: CoreSseCloseReason) => {
		if (closed) return;
		closed = true;
		options.onEnd?.(reason);
	};

	const retry = () => {
		if (closed) return;
		options.onRetry?.(attempt + 1);
		timer = setTimeout(connect, retryDelay(attempt));
		attempt++;
	};

	const request = async (url: string, signal: AbortSignal) =>
		fetch(url, {
			headers: { Accept: 'text/event-stream', ...buildAuthHead(getCoreAuth(api)) },
			cache: 'no-store',
			signal,
		});

	async function connect() {
		timer = null;
		controller = new AbortController();
		const { signal } = controller;

		try {
			const { BEELINE_UI_API } = await config.getValue();
			const url = `${BEELINE_UI_API.replace(/\/+$/, '')}/${options.path.replace(/^\/+/, '')}`;

			if (isOAuthTokenExpiring(getCoreAuth(api))) await refreshOAuthSession(api).catch(() => undefined);
			if (isLocalSessionExpired(getCoreAuth(api))) {
				api.dispatch(expireSession());
				return end({ type: 'unauthorized' });
			}

			let res = await request(url, signal);
			if (res.status === 401 && getCoreAuth(api)?.method === 'oauth') {
				const refreshed = await refreshOAuthSession(api).then(
					() => true,
					() => false,
				);
				if (refreshed) res = await request(url, signal);
			}

			if (res.status === 401) {
				api.dispatch(getCoreAuth(api)?.method === 'local' ? expireSession() : clearSession());
				return end({ type: 'unauthorized' });
			}
			if (!res.ok || !res.body) {
				return isRetryableCode(res.status) ? retry() : end({ type: 'http', code: res.status });
			}

			options.onOpen?.();
			const push = createSseParser((frame) => {
				attempt = 0;
				if (!closed) options.onFrame(frame);
			});
			const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
			for (;;) {
				const { done, value } = await reader.read();
				if (done || closed) break;
				push(value);
			}
			// The server ends every stream after a while; picking up again yields a fresh snapshot.
			retry();
		} catch {
			if (!signal.aborted) retry();
		}
	}

	void connect();

	return {
		close: () => {
			closed = true;
			if (timer) clearTimeout(timer);
			controller?.abort();
		},
	};
};
