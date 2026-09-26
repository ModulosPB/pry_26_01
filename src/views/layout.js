// Cabecera común de las vistas privadas.

import { cerrarSesion } from '../auth.js';
import { obtenerSesion, esAdmin } from '../sesion.js';
import { escaparHtml } from '../utils.js';

export function htmlCabecera() {
  const sesion = obtenerSesion();
  const rol = esAdmin() ? 'Administrador' : 'Consulta';
  return `
    <header class="cabecera">
      <a class="cabecera__marca" href="#/trabajos">Procesamiento IA</a>
      <div class="cabecera__usuario">
        <span><strong>${escaparHtml(sesion?.username)}</strong> <span class="cabecera__rol">${rol}</span></span>
        <button class="boton boton--discreto" type="button" data-accion="salir">Cerrar sesión</button>
      </div>
    </header>`;
}

export function conectarCabecera(contenedor) {
  contenedor.querySelector('[data-accion="salir"]').addEventListener('click', () => {
    cerrarSesion();
    location.hash = '#/login';
  });
}
