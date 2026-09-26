// Guarda y recupera la sesión del usuario en sessionStorage.
// La sesión se pierde al cerrar la pestaña.

const CLAVE_SESION = 'procesamientoia.sesion';

export function guardarSesion(sesion) {
  sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
}

export function obtenerSesion() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_SESION));
  } catch {
    return null;
  }
}

export function borrarSesion() {
  sessionStorage.removeItem(CLAVE_SESION);
}

export function estaAutenticado() {
  return obtenerSesion() !== null;
}

export function esAdmin() {
  const sesion = obtenerSesion();
  return Boolean(sesion && sesion.roles && sesion.roles.includes('ROLE_ADMIN'));
}
