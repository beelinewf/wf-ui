import React from 'react';

import { Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import { LuPaperclip } from 'react-icons/lu';

import { formatFileSize } from '@module/form-engine/utils';
import { collectFileRefs } from '@module/workflow-run/utils';

import classes from './WorkflowRunFileRefs.module.scss';

/**
 * The files a multipart delivery left in `value`, listed by path. There's no download: the bytes live in the input
 * node's bucket under `file_name`, which the engine doesn't serve.
 */
export const WorkflowRunFileRefs: React.FC<{ value: unknown }> = ({ value }) => {
	const groups = collectFileRefs(value);
	if (groups.length === 0) return null;

	return (
		<Stack gap={6} className={classes.root}>
			{groups.map(({ path, files }) => (
				<Stack key={path} gap={2}>
					{path && (
						<Text fz={11} c="dimmed" ff="monospace">
							{path}
						</Text>
					)}
					{files.map((file, index) => (
						<Tooltip
							key={`${file.file_name}-${index}`}
							label={`Stored in object storage as ${file.file_name}`}
							openDelay={300}
						>
							<Group gap={6} wrap="nowrap" className={classes.row}>
								<LuPaperclip size={12} className={classes.icon} />
								<Text fz="xs" fw={500} truncate>
									{file.original_file_name || file.file_name}
								</Text>
								<Text fz={11} c="dimmed" ff="monospace" truncate flex={1}>
									{file.file_name}
								</Text>
								<Text fz={11} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
									{formatFileSize(file.size)}
								</Text>
								<Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
									{file.mime_type}
								</Badge>
							</Group>
						</Tooltip>
					))}
				</Stack>
			))}
		</Stack>
	);
};
