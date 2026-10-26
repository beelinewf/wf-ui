import React from 'react';

import { Burger, Group, ScrollArea, Tooltip, UnstyledButton } from '@mantine/core';

import { BrandMark } from '@common/component/BrandMark';

import { useAppHealthStatus } from '@module/app/hooks';
import type { AppHealthStatus } from '@module/app/types/AppHealthStatus';
import { NotificationBell } from '@module/notification/components/NotificationBell';

import { AppBreadcrumb } from '../AppBreadcrumb';
import { AppProfileMenu } from '../AppProfileMenu';
import classes from './AppTopBar.module.scss';

const HEALTH_LABEL: Record<AppHealthStatus, string> = {
	checking: 'Checking Workflow Engine',
	ready: 'Connected to Workflow Engine',
	'not-ready': 'Workflow Engine not ready',
	down: 'Disconnected from Workflow Engine',
};

const HEALTH_HINT: Record<AppHealthStatus, string> = {
	checking: 'Checking engine health…',
	ready: 'Engine is live and ready. Click to recheck',
	'not-ready': 'Engine is live but its dependencies are not ready. Click to recheck',
	down: 'Engine is unreachable. Click to recheck',
};

interface AppTopBarProps {
	navOpened: boolean;
	onToggleNav: () => void;
}

export const AppTopBar: React.FC<AppTopBarProps> = ({ navOpened, onToggleNav }) => {
	const health = useAppHealthStatus();

	return (
		<Group h="100%" px="sm" gap="sm" wrap="nowrap">
			<Burger opened={navOpened} onClick={onToggleNav} hiddenFrom="sm" size="sm" />
			<Group w={48} justify="center" visibleFrom="sm">
				<BrandMark size={28} variant="symbol" />
			</Group>

			<ScrollArea flex={1} scrollbars="x" type="never">
				<AppBreadcrumb />
			</ScrollArea>

			<Group gap="xs" wrap="nowrap">
				<Tooltip label={HEALTH_HINT[health.status]}>
					<UnstyledButton
						className={classes.engineStatus}
						data-status={health.status}
						disabled={health.fetching}
						onClick={health.refetch}
					>
						<span className={classes.engineDot} />
						<span className={classes.engineLabel}>{HEALTH_LABEL[health.status]}</span>
					</UnstyledButton>
				</Tooltip>
				<NotificationBell />
				<AppProfileMenu />
			</Group>
		</Group>
	);
};
