import type { JsonSchema } from '@common/types/JsonSchema';

import type { FormContentType } from './FormContentType';

/** One forms-library entry. `schema` and `ui` are the stored bytes, exactly as saved. */
export interface Form {
	id: string;
	name: string;
	schema: JsonSchema;
	/** Absent when the form was saved without one. Parsed with `formUiSchema` before use; never trusted as is. */
	ui?: Record<string, unknown> | null;
	/** How the payload is delivered; empty or absent is JSON. */
	content_type?: FormContentType | '';
	created_at: string;
	updated_at: string;
}
