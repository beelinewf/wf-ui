import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const src = (dir: string) => fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

const publicConfig = JSON.parse(readFileSync(new URL('./public/config.json', import.meta.url), 'utf8')) as {
	BEELINE_UI_API?: string;
};

// The backend sends no CORS headers, so in dev a relative BEELINE_UI_API is proxied through the Vite origin.
const apiProxyTarget = process.env.BEELINE_API_PROXY ?? 'http://localhost:8080';
const apiPath = publicConfig.BEELINE_UI_API ?? '';
const apiProxyPrefix = apiPath.startsWith('/') ? apiPath.replace(/\/+$/, '') : '';

// Set by the Docker build (release tag); local builds show "dev".
const appVersion = process.env.APP_VERSION || 'dev';

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
	define: {
		__APP_VERSION__: JSON.stringify(appVersion),
	},
	server: {
		proxy: apiProxyPrefix
			? {
					[apiProxyPrefix]: {
						target: apiProxyTarget,
						ws: true,
						changeOrigin: true,
						rewrite: (path) => path.slice(apiProxyPrefix.length) || '/',
					},
				}
			: undefined,
	},
	resolve: {
		alias: {
			'@config': src('config'),
			'@core': src('core'),
			'@common': src('common'),
			'@module': src('module'),
			'@assets': src('assets'),
		},
	},
});
