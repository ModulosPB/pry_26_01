import { defineConfig } from 'vite';

// El backend solo admite peticiones CORS desde este origen,
// así que el servidor de desarrollo no debe cambiar de puerto.
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
});
