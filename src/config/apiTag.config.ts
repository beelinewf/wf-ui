export const apiTagConfig = {
	workflowDefinition: 'WorkflowDefinition',
	nodeDefinition: 'NodeDefinition',
	nodeType: 'NodeType',
	workflowRun: 'WorkflowRun',
	statistics: 'Statistics',
	secret: 'Secret',
	form: 'Form',
	role: 'Role',
	user: 'User',
	schedule: 'Schedule',
	me: 'Me',
} as const;

export type ApiTag = (typeof apiTagConfig)[keyof typeof apiTagConfig];

export const apiTagList = Object.values(apiTagConfig) as ApiTag[];

export const API_TAG_LIST_ID = 'LIST';
