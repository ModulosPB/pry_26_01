# procesamientoia-web

Cliente web (JavaScript sin framework + Vite) para la API del Reto Merkle.

## Puesta en marcha

1. Instala Node.js 20 o posterior.
2. En esta carpeta ejecuta `npm install`.
3. Copia `.env.example` como `.env` y escribe en `VITE_API_URL` la dirección de la API, sin barra final.
4. Ejecuta `npm run dev` y abre http://localhost:5173

El backend solo acepta peticiones del navegador desde `http://localhost:5173` y `http://127.0.0.1:5173`
(propiedad `cors.allowed-origins`). Si el puerto 5173 está ocupado, Vite se detiene en lugar de usar otro.

## Versión de producción

`npm run build` genera la carpeta `dist/`. Su origen debe añadirse a `cors.allowed-origins` del backend.
