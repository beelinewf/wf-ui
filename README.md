<img src="./src/assets/banner.png" />

# Beeline

A workflow UI for [Beeline Workflow Engine](https://github.com/beelinewf/wf-engine).

## Run locally

You need [Node.js 24](https://nodejs.org/en/download) and a running Beeline Workflow Engine.

```
npm install
npm run dev
```

Dev server proxies `/wf-engine` to `http://localhost:8080`. If your workflow engine runs somewhere else:

```
BEELINE_API_PROXY=http://localhost:9999 npm run dev
```

## Docker

```
docker run -p 8080:80 \
  -e BEELINE_UI_API=http://your-wf-engine:9999 \
  ghcr.io/beelinewf/wf-ui
```

Env:

- `BEELINE_UI_NAME` - app name, default `Beeline`
- `BEELINE_UI_API` - workflow engine API url, default `http://localhost:9999`
- `BEELINE_UI_IDP_ADMIN_URL` - optional, identity provider admin page linked from Settings → Roles

The backend doesn't send CORS headers, so you probably need to put both behind same reverse proxy.

## License

MIT. See [LICENSE](./LICENSE).

Copyright (c) 2026 Muhammad Randa Syafridamara
