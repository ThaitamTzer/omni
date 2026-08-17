import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env from apps/web/.env* (VITE_ prefix only)
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiTarget = env.VITE_API_URL || 'http://localhost:3000';
  const wsTarget = env.VITE_WS_URL || apiTarget;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: wsTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
