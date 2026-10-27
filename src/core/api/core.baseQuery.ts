import type { BaseQueryFn } from '@reduxjs/toolkit/query';

import { apiTagConfig } from '@config/apiTag.config';
import { config } from '@config/config';

import { isOAuthTokenExpiring, refreshOAuthSession } from '@core/auth/oauth';
import { clearSession } from '@core/auth/store';
import { Http } from '@core/http';

import { HTTPError } from '@common/exception/HTTPError';
import type { ComplexQueryParam } from '@common/types/ComplexQueryParam';
import type { HTTPHeader } from '@common/types/HTTPHeader';
import type { HTTPMethod } from '@common/types/HTTPMethod';
import type { HTTPResponse } from '@common/types/HTTPResponse';

// Circular with core.api, but only read at call time, after both modules have loaded.
import { coreApi } from './core.api';
import { buildAuthHead, getCoreAuth } from './core.authHead';

export interface CoreQueryArgs {
	method: HTTPMethod;
	url: string;
	qParam?: ComplexQueryParam;
	body?: unknown;
	head?: HTTPHeader;
}

export interface CoreQueryError {
	code: number;
	data: string;
	explain: string;
	message: string;
}

export interface CoreQueryExtraOptions {
	anonymous?: boolean;
}

export interface CoreQueryMeta {
	code: number;
	explain: string;
	param: ComplexQueryParam;
}

let httpPromise: Promise<Http> | null = null;

const getHttp = (): Promise<Http> => {
	httpPromise ??= config.getValue().then((value) => new Http(value.BEELINE_UI_API));
	return httpPromise;
};

export const resetCoreHttp = () => {
	httpPromise = null;
};

const toCoreQueryError = (err: unknown): CoreQueryError => {
	if (err instanceof HTTPError) {
		return { code: err.code, data: err.data, explain: err.explain, message: err.message };
	}

	return {
		code: 500,
		data: 'Unknown Error',
		explain: 'Unknown Error',
		message: err instanceof Error ? err.message : 'Unknown Error',
	};
};

export const coreBaseQuery: BaseQueryFn<
	CoreQueryArgs,
	unknown,
	CoreQueryError,
	CoreQueryExtraOptions,
	CoreQueryMeta
> = async (args, api, extraOptions) => {
	const anonymous = !!extraOptions?.anonymous;

	try {
		const http = await getHttp();

		// A failed early refresh is not fatal here: the request still goes out and the 401 path below decides.
		if (!anonymous && isOAuthTokenExpiring(getCoreAuth(api))) await refreshOAuthSession(api).catch(() => undefined);

		// The header is rebuilt per attempt so a retry picks up the refreshed token.
		const send = () =>
			http.requestJSON(args.method, args.url, args.qParam, args.body, {
				...(anonymous ? {} : buildAuthHead(getCoreAuth(api))),
				...args.head,
			});

		let res: HTTPResponse<unknown>;
		try {
			res = await send();
		} catch (err) {
			if (anonymous || !(err instanceof HTTPError) || err.code !== 401 || getCoreAuth(api)?.method !== 'oauth')
				throw err;

			// The access token may have been revoked or expired early, so refresh once and retry before giving up.
			await refreshOAuthSession(api).catch(() => {
				throw err;
			});
			res = await send();
		}

		return { data: res.data, meta: { code: res.code, explain: res.explain, param: res.param } };
	} catch (err) {
		const error = toCoreQueryError(err);
		if (error.code === 401 && !anonymous) api.dispatch(clearSession());
		// Roles can change mid-session, so a denial refreshes /auth/me and the gates follow it.
		if (error.code === 403 && !anonymous) api.dispatch(coreApi.util.invalidateTags([{ type: apiTagConfig.me }]));

		return { error };
	}
};
