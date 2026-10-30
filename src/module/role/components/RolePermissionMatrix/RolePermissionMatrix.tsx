import React, { Fragment } from 'react';

import { Card, Group, Skeleton, Table, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { LuCheck, LuMinus, LuTriangleAlert } from 'react-icons/lu';

import { PERMISSION_GROUPS, PERMISSION_META } from '@module/role/constant';
import type { Role } from '@module/role/types/Role';
import { hasWildcard, unrecognizedPermissions } from '@module/role/utils';

import classes from './RolePermissionMatrix.module.scss';

interface RolePermissionMatrixProps {
	roles: Role[];
	onSelectRole: (role: Role) => void;
	/** Rendered beside each role's name in the header, e.g. an edit/delete menu. */
	renderRoleActions?: (role: Role) => React.ReactNode;
	/** Renders placeholder columns while the catalog loads. */
	skeletonColumns?: number;
}

interface MatrixRow {
	permission: string;
	label: string | null;
}

const GrantCell: React.FC<{ granted: boolean; viaWildcard: boolean }> = ({ granted, viaWildcard }) => {
	if (!granted) return <LuMinus size={14} color="var(--mantine-color-gray-4)" aria-label="Not granted" />;
	const icon = <LuCheck size={16} color="var(--mantine-color-teal-6)" aria-label="Granted" />;
	return viaWildcard ? <Tooltip label="Granted through *">{icon}</Tooltip> : icon;
};

/** Rows are the permission catalog grouped by resource, columns are roles: who can do what at a glance. */
export const RolePermissionMatrix: React.FC<RolePermissionMatrixProps> = ({
	roles,
	onSelectRole,
	renderRoleActions,
	skeletonColumns,
}) => {
	const grants = roles.map((role) => ({
		wildcard: hasWildcard(role.permissions),
		set: new Set(role.permissions),
	}));
	const unknown = unrecognizedPermissions(roles.flatMap((role) => role.permissions));

	const sections: { id: string; label: React.ReactNode; rows: MatrixRow[] }[] = PERMISSION_GROUPS.map((group) => ({
		id: group.id,
		label: group.label,
		rows: group.permissions.map((permission) => ({
			permission,
			label: PERMISSION_META[permission].label,
		})),
	}));
	if (unknown.length > 0) {
		sections.push({
			id: 'unrecognized',
			label: (
				<Group gap={6}>
					<LuTriangleAlert size={12} color="var(--mantine-color-yellow-7)" aria-hidden />
					Unrecognized — granted by the engine, unknown to this UI
				</Group>
			),
			rows: unknown.map((permission) => ({ permission, label: null })),
		});
	}

	const columnCount = skeletonColumns ?? roles.length;

	return (
		<Card padding={0} className={classes.root}>
			<Table.ScrollContainer minWidth={360 + columnCount * 96} type="native">
				<Table verticalSpacing={6} horizontalSpacing="md" fz="sm" highlightOnHover>
					<Table.Thead className={classes.head}>
						<Table.Tr>
							<Table.Th>Permission</Table.Th>
							{skeletonColumns
								? Array.from({ length: skeletonColumns }, (_, index) => (
										<Table.Th key={index} className={classes.cell}>
											<Skeleton height={10} width={56} mx="auto" />
										</Table.Th>
									))
								: roles.map((role) => (
										<Table.Th key={role.name} className={classes.cell}>
											<Group gap={2} justify="center" wrap="nowrap">
												<UnstyledButton
													className={classes.roleButton}
													onClick={() => onSelectRole(role)}
													aria-label={`Show role ${role.name}`}
												>
													{role.name}
												</UnstyledButton>
												{renderRoleActions?.(role)}
											</Group>
										</Table.Th>
									))}
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{sections.map((section) => (
							<Fragment key={section.id}>
								<Table.Tr className={classes.group}>
									<Table.Td colSpan={columnCount + 1}>{section.label}</Table.Td>
								</Table.Tr>
								{section.rows.map((row) => (
									<Table.Tr key={row.permission}>
										<Table.Td>
											{row.label && <Text fz="sm">{row.label}</Text>}
											<Text fz="xs" c="dimmed" ff="monospace">
												{row.permission}
											</Text>
										</Table.Td>
										{skeletonColumns
											? Array.from({ length: skeletonColumns }, (_, index) => (
													<Table.Td key={index} className={classes.cell}>
														<Skeleton height={10} width={16} mx="auto" />
													</Table.Td>
												))
											: grants.map((grant, index) => {
													const direct = grant.set.has(row.permission);
													const viaWildcard = !direct && grant.wildcard;
													return (
														<Table.Td key={roles[index].name} className={classes.cell}>
															<GrantCell
																granted={direct || viaWildcard}
																viaWildcard={viaWildcard}
															/>
														</Table.Td>
													);
												})}
									</Table.Tr>
								))}
							</Fragment>
						))}
					</Table.Tbody>
				</Table>
			</Table.ScrollContainer>
		</Card>
	);
};
