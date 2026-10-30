import { API_TAG_LIST_ID, apiTagConfig } from '@config/apiTag.config';

import { coreApi } from '@core/api';

import type { Form } from '@module/form-engine/types/Form';
import type { FormList } from '@module/form-engine/types/FormList';
import type { FormPayload } from '@module/form-engine/types/FormPayload';
import type { FormQuery } from '@module/form-engine/types/FormQuery';
import type { FormUsage } from '@module/form-engine/types/FormUsage';
import type { FormUsageQuery } from '@module/form-engine/types/FormUsageQuery';

const RESOURCE = 'v1/forms';

const formUrl = (id: string) => `${RESOURCE}/${encodeURIComponent(id)}`;

/** Usage depends on definitions this module doesn't own, so it's tagged apart and refetched on open. */
const usageTag = (id: string) => ({ type: apiTagConfig.form, id: `usage:${id}` });

export const formApi = coreApi.injectEndpoints({
	endpoints: (build) => ({
		listForms: build.query<FormList, FormQuery>({
			query: (param) => ({ method: 'get', url: RESOURCE, qParam: param }),
			providesTags: (result) => [
				{ type: apiTagConfig.form, id: API_TAG_LIST_ID },
				...(result?.items ?? []).map((item) => ({ type: apiTagConfig.form, id: item.id })),
			],
		}),

		getForm: build.query<Form, string>({
			query: (id) => ({ method: 'get', url: formUrl(id) }),
			providesTags: (_result, _error, id) => [{ type: apiTagConfig.form, id }],
		}),

		getFormUsage: build.query<FormUsage, FormUsageQuery>({
			query: ({ id, ...param }) => ({ method: 'get', url: `${formUrl(id)}/usage`, qParam: param }),
			providesTags: (_result, _error, { id }) => [usageTag(id)],
		}),

		createForm: build.mutation<Form, FormPayload>({
			query: (body) => ({ method: 'post', url: RESOURCE, body }),
			invalidatesTags: [{ type: apiTagConfig.form, id: API_TAG_LIST_ID }],
		}),

		/** Full overwrite: an omitted `ui` clears the stored one and `content_type` resets. Allowed while the form is in use. */
		updateForm: build.mutation<Form, FormPayload & { id: string }>({
			query: ({ id, ...body }) => ({ method: 'put', url: formUrl(id), body }),
			invalidatesTags: (_result, _error, { id }) => [
				{ type: apiTagConfig.form, id },
				{ type: apiTagConfig.form, id: API_TAG_LIST_ID },
			],
		}),

		/** Rejected with 409 while any workflow or node definition references the form. */
		deleteForm: build.mutation<void, string>({
			query: (id) => ({ method: 'delete', url: formUrl(id) }),
			invalidatesTags: (_result, error, id) =>
				error
					? [usageTag(id)]
					: [
							{ type: apiTagConfig.form, id },
							{ type: apiTagConfig.form, id: API_TAG_LIST_ID },
						],
		}),
	}),
});
