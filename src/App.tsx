import React from 'react';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router';

import { routesConfig } from '@config/routes.config';

import { coreStore } from '@core/store';
import { cssVariablesResolver, themeOverride } from '@core/theme/theme.override';

function App() {
	return (
		<Provider store={coreStore}>
			<MantineProvider theme={themeOverride} cssVariablesResolver={cssVariablesResolver}>
				<Notifications position="top-right" />
				<RouterProvider router={routesConfig} />
			</MantineProvider>
		</Provider>
	);
}

export default App;
