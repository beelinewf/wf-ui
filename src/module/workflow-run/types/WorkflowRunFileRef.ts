/** A file delivered as a multipart part, as the engine writes it into the context. The bytes stay in object storage. */
export interface WorkflowRunFileRef {
	original_file_name: string;
	/** Object key in the input node's storage bucket. */
	file_name: string;
	size: number;
	mime_type: string;
}
