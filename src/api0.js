// Comunicación con la API REST del backend.
// Todas las peticiones pasan por la función peticion().

import { API_URL } from './config.js';
import { obtenerSesion } from './sesion.js';

export class ApiError extends Error {
  constructor(estado, mensaje, datos = null) {
    super(mensaje);
    this.name = 'ApiError';
    this.estado = estado; // código HTTP (0 si no hubo respuesta)
    this.datos = datos;   // cuerpo de la respuesta de error, si lo hay
  }
}

const MENSAJES_POR_ESTADO = {
  400: 'La petición no es válida.',
  401: 'Usuario o contraseña incorrectos.',
  403: 'Tu usuario no tiene permiso para esta operación.',
  404: 'No se ha encontrado lo que buscas.',
  409: 'La operación no es posible en el estado actual.',
  413: 'El fichero es demasiado grande.',
};

async function leerCuerpo(respuesta) {
  const tipo = respuesta.headers.get('Content-Type') || '';
  if (tipo.includes('application/json')) {
    try {
      return await respuesta.json();
    } catch {
      return null;
    }
  }
  return respuesta.text();
}

// opciones.autorizacion permite usar unas credenciales concretas (login);
// si no se indica, se usan las de la sesión guardada.
async function peticion(ruta, opciones = {}) {
  const { metodo = 'GET', cuerpo, autorizacion } = opciones;

  const cabeceras = { Accept: 'application/json, text/plain' };
  const credenciales = autorizacion || obtenerSesion()?.autorizacion;
  if (credenciales) {
    cabeceras.Authorization = credenciales;
  }

  let respuesta;
  try {
    // Con FormData NO se indica Content-Type: el navegador añade el boundary.
    respuesta = await fetch(API_URL + ruta, { method: metodo, headers: cabeceras, body: cuerpo });
  } catch {
    throw new ApiError(0, `No se puede conectar con ${API_URL}. Comprueba que la API está en marcha, que esa es la dirección correcta (VITE_API_URL en .env) y, si lo es, busca un error de CORS en la consola del navegador.`);
  }

  const datos = await leerCuerpo(respuesta);

  if (!respuesta.ok) {
    const mensaje = (datos && typeof datos === 'object' && datos.mensaje)
      || MENSAJES_POR_ESTADO[respuesta.status]
      || `El servidor respondió con un error ${respuesta.status}.`;

    // Un 401 fuera del login significa que la sesión guardada ya no sirve.
    if (respuesta.status === 401 && !autorizacion) {
      window.dispatchEvent(new CustomEvent('sesion-caducada'));
    }
    throw new ApiError(respuesta.status, mensaje, datos);
  }

  return datos;
}

export function obtenerUsuarioActual(autorizacion) {
  return peticion('/auth/me', { autorizacion });
}

export function listarTrabajos() {
  return peticion('/trabajos');
}

export function obtenerTrabajo(id) {
  return peticion(`/trabajos/${encodeURIComponent(id)}`);
}

export function listarPrompts(id) {
  return peticion(`/trabajos/${encodeURIComponent(id)}/prompts`);
}

export function listarRespuestas(id) {
  return peticion(`/trabajos/${encodeURIComponent(id)}/respuestas`);
}

export function obtenerProgreso(id) {
  return peticion(`/trabajos/${encodeURIComponent(id)}/progreso`);
}

export function importarTrabajo(nombre, fichero) {
  const formulario = new FormData();
  formulario.append('nombre', nombre);
  formulario.append('fichero', fichero);
  return peticion('/trabajos/importar', { metodo: 'POST', cuerpo: formulario });
}

export function procesarTrabajo(id) {
  return peticion(`/trabajos/${encodeURIComponent(id)}/procesar`, { metodo: 'POST' });
}
