import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          socket: ['socket.io-client'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
