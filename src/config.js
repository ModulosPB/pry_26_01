// Configuración general del cliente.
// VITE_API_URL se define en el fichero .env de la raíz del proyecto.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/+$/, '');

// Cada cuánto se consulta el progreso de un trabajo que se está procesando.
export const INTERVALO_PROGRESO_MS = 3000;

// Tamaño máximo de fichero que acepta Spring Boot por defecto (1 MB).
export const TAMANO_MAXIMO_CSV = 1024 * 1024;
