/** input: where files delivered as `multipart/form-data` are stored. Required while `accept` lists multipart. */
export interface WorkflowDefinitionInputStorage {
	bucket: string;
	/** Object key prefix inside the bucket. */
	prefix?: string;
	/** `type/subtype` or `type/*`; absent allows any type. */
	allowed_mime_types?: string[];
	max_file_bytes?: number;
}
