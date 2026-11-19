import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function createBuildId(isBuild: boolean): { buildId: string; builtAt: string } {
  const now = new Date();
  const builtAt = now.toISOString();
  if (!isBuild) {
    return { buildId: 'dev', builtAt };
  }
  const stamp = builtAt.replace(/[-:T]/g, '').slice(0, 14);
  const rawSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
  const shortSha = rawSha ? rawSha.slice(0, 8) : Math.random().toString(36).slice(2, 8);
  return { buildId: `${stamp}-${shortSha}`, builtAt };
}

function appVersionManifestPlugin(buildId: string, builtAt: string): Plugin {
  const payload = JSON.stringify({ buildId, builtAt }, null, 2);
  return {
    name: 'tiny-isles-version-manifest',
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.end(payload);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: payload,
      });
    },
  };
}

export default defineConfig(({ command }) => {
  const { buildId, builtAt } = createBuildId(command === 'build');

  return {
    plugins: [react(), appVersionManifestPlugin(buildId, builtAt)],
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
      __APP_BUILT_AT__: JSON.stringify(builtAt),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            phaser: ['phaser'],
            vendor: ['react', 'react-dom', '@supabase/supabase-js'],
          },
        },
      },
    },
  };
});


