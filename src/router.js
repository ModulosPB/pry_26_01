// Enrutado por hash: #/login, #/trabajos y #/trabajos/{id}.

import { estaAutenticado } from './sesion.js';
import { vistaLogin } from './views/login.js';
import { vistaTrabajos } from './views/trabajos.js';
import { vistaDetalle } from './views/detalle.js';

const RUTAS = [
  { patron: /^#\/login$/, vista: vistaLogin, publica: true },
  { patron: /^#\/trabajos$/, vista: vistaTrabajos },
  { patron: /^#\/trabajos\/(\d+)$/, vista: vistaDetalle },
];

let contenedor = null;
let limpiarVista = null;

function mostrarRuta() {
  // Cada vista puede devolver una función que detiene sus temporizadores.
  if (typeof limpiarVista === 'function') {
    limpiarVista();
  }
  limpiarVista = null;

  const hash = location.hash || '#/trabajos';
  const ruta = RUTAS.find((r) => r.patron.test(hash));

  if (!ruta) {
    location.hash = '#/trabajos';
    return;
  }
  if (!ruta.publica && !estaAutenticado()) {
    location.hash = '#/login';
    return;
  }
  if (ruta.publica && estaAutenticado()) {
    location.hash = '#/trabajos';
    return;
  }

  const parametros = hash.match(ruta.patron).slice(1);
  contenedor.replaceChildren();
  window.scrollTo(0, 0);
  limpiarVista = ruta.vista(contenedor, ...parametros);
}

export function iniciarRouter(elemento) {
  contenedor = elemento;
  window.addEventListener('hashchange', mostrarRuta);
  mostrarRuta();
}
