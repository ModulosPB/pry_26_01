// Inicio y cierre de sesión con HTTP Basic.

import { obtenerUsuarioActual } from './api.js';
import { guardarSesion, borrarSesion } from './sesion.js';

// btoa() solo admite caracteres de 1 byte; así se codifican también tildes y eñes.
function codificarBasic(usuario, clave) {
  const bytes = new TextEncoder().encode(`${usuario}:${clave}`);
  let binario = '';
  for (const byte of bytes) {
    binario += String.fromCharCode(byte);
  }
  return `Basic ${btoa(binario)}`;
}

// Comprueba las credenciales contra /auth/me y, si son válidas, guarda la sesión.
export async function iniciarSesion(usuario, clave) {
  const autorizacion = codificarBasic(usuario, clave);
  const datos = await obtenerUsuarioActual(autorizacion);
  const sesion = {
    username: datos.username,
    roles: datos.roles || [],
    autorizacion,
  };
  guardarSesion(sesion);
  return sesion;
}

export function cerrarSesion() {
  borrarSesion();
}
