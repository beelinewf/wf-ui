import React from 'react';

import { ActionIcon, Group, Input, Stack, Text, Tooltip } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { LuPaperclip, LuUpload, LuX } from 'react-icons/lu';

import type { FormFieldModel } from '@module/form-engine/types/FormFieldModel';
import { formatFileSize } from '@module/form-engine/utils';

import classes from './FormFileField.module.scss';

interface FormFileFieldProps {
	field: FormFieldModel;
	value: unknown;
	/** The field's own error, then any per-file ones. */
	errors: string[];
	disabled?: boolean;
	onChange: (value: File | File[] | null) => void;
}

/**
 * Picks one file, or several for a list. Type and size are checked by the form's validation rather than the
 * dropzone, so a rejected file still shows why instead of silently not appearing.
 */
export const FormFileField: React.FC<FormFileFieldProps> = ({ field, value, errors, disabled, onChange }) => {
	const { multiple = false, accept = [] } = field.file ?? {};
	const files = (multiple ? (Array.isArray(value) ? value : []) : value instanceof File ? [value] : []).filter(
		(item): item is File => item instanceof File,
	);
	const max = field.schema.maxItems;
	const full = multiple && max !== undefined && files.length >= max;

	const drop = (picked: File[]) => {
		if (!picked.length) return;
		onChange(multiple ? [...files, ...picked] : picked[0]);
	};
	const remove = (index: number) => onChange(multiple ? files.filter((_, at) => at !== index) : null);

	const hint = [
		accept.length ? accept.join(', ') : 'Any type',
		field.file?.maxBytes !== undefined ? `up to ${formatFileSize(field.file.maxBytes)} each` : null,
	]
		.filter(Boolean)
		.join(' · ');

	return (
		<Input.Wrapper
			label={field.label}
			description={field.help}
			withAsterisk={field.required}
			error={errors.length ? errors.join('; ') : undefined}
			inputWrapperOrder={['label', 'input', 'description', 'error']}
		>
			<Stack gap={6} mt={4}>
				{(multiple || files.length === 0) && (
					<Dropzone
						// Rejected files are kept too, so validation says why they don't fit.
						onDrop={() => undefined}
						onDropAny={(accepted, rejections) =>
							drop([...accepted, ...rejections.map((rejection) => rejection.file)])
						}
						multiple={multiple}
						accept={accept.length ? accept : undefined}
						disabled={disabled || full}
						p="sm"
						className={classes.dropzone}
						data-error={errors.length > 0 || undefined}
					>
						<Group gap="sm" wrap="nowrap" style={{ pointerEvents: 'none' }}>
							<LuUpload size={18} className={classes.icon} />
							<div>
								<Text fz="sm">
									{full
										? 'File limit reached'
										: `Drop ${multiple ? 'files' : 'a file'} here or click to choose`}
								</Text>
								<Text fz="xs" c="dimmed">
									{hint}
								</Text>
							</div>
						</Group>
					</Dropzone>
				)}
				{files.map((file, index) => (
					<Group key={`${file.name}-${index}`} gap="xs" wrap="nowrap" className={classes.file}>
						<LuPaperclip size={14} className={classes.icon} />
						<Text fz="sm" truncate flex={1}>
							{file.name}
						</Text>
						<Text fz="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
							{formatFileSize(file.size)}
						</Text>
						{!disabled && (
							<Tooltip label="Remove">
								<ActionIcon
									variant="subtle"
									color="gray"
									size="sm"
									aria-label={`Remove ${file.name}`}
									onClick={() => remove(index)}
								>
									<LuX size={14} />
								</ActionIcon>
							</Tooltip>
						)}
					</Group>
				))}
			</Stack>
		</Input.Wrapper>
	);
};
