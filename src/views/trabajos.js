// Vista #/trabajos: listado de trabajos e importación de CSV (solo ADMIN).

import { listarTrabajos, importarTrabajo } from '../api.js';
import { esAdmin } from '../sesion.js';
import { TAMANO_MAXIMO_CSV } from '../config.js';
import { escaparHtml, formatearFecha, insigniaEstado } from '../utils.js';
import { htmlCabecera, conectarCabecera } from './layout.js';

function htmlImportacion() {
  return `
    <section class="panel" aria-labelledby="titulo-importar">
      <h2 class="panel__titulo" id="titulo-importar">Nuevo trabajo</h2>
      <p class="panel__texto">Sube un CSV con una única columna llamada <code>pregunta</code>. Cada fila será un prompt.</p>
      <form class="formulario formulario--linea" novalidate>
        <label class="campo">
          <span class="campo__etiqueta">Nombre del trabajo</span>
          <input class="campo__control" name="nombre" placeholder="Dashboard Coca-Cola España" maxlength="255" required />
        </label>
        <label class="campo">
          <span class="campo__etiqueta">Fichero CSV</span>
          <input class="campo__control" name="fichero" type="file" accept=".csv,text/csv" required />
        </label>
        <button class="boton boton--primario" type="submit">Crear trabajo</button>
      </form>
      <p class="aviso aviso--error" role="alert" hidden></p>
    </section>`;
}

function htmlTabla(trabajos) {
  if (trabajos.length === 0) {
    const pista = esAdmin()
      ? 'Crea el primero subiendo un CSV.'
      : 'Aparecerán aquí cuando un administrador importe un CSV.';
    return `<p class="vacio">Todavía no hay trabajos. ${pista}</p>`;
  }

  const filas = trabajos
    .slice()
    .sort((a, b) => b.id - a.id) // los más recientes primero
    .map((t) => `
      <tr>
        <td class="tabla__numero">${t.id}</td>
        <td><a class="enlace" href="#/trabajos/${t.id}">${escaparHtml(t.nombre)}</a></td>
        <td>${escaparHtml(formatearFecha(t.fechaCreacion))}</td>
        <td>${insigniaEstado(t.estado)}</td>
      </tr>`)
    .join('');

  return `
    <div class="tabla-contenedor">
      <table class="tabla">
        <thead>
          <tr><th scope="col">Id</th><th scope="col">Nombre</th><th scope="col">Creado</th><th scope="col">Estado</th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

function validarImportacion(nombre, fichero) {
  if (!nombre) {
    return 'Escribe un nombre para el trabajo.';
  }
  if (!fichero) {
    return 'Selecciona un fichero CSV.';
  }
  if (!fichero.name.toLowerCase().endsWith('.csv')) {
    return 'El fichero debe tener extensión .csv.';
  }
  if (fichero.size === 0) {
    return 'El fichero está vacío.';
  }
  if (fichero.size > TAMANO_MAXIMO_CSV) {
    return 'El fichero supera 1 MB, el tamaño máximo que acepta el servidor.';
  }
  return null;
}

export function vistaTrabajos(contenedor) {
  let activa = true;

  contenedor.innerHTML = `
    ${htmlCabecera()}
    <main class="pagina">
      <div class="pagina__encabezado">
        <h1 class="pagina__titulo">Trabajos</h1>
        <button class="boton boton--secundario" type="button" data-accion="recargar">Actualizar</button>
      </div>
      ${esAdmin() ? htmlImportacion() : ''}
      <section class="listado" aria-live="polite"><p class="cargando">Cargando trabajos…</p></section>
    </main>`;

  conectarCabecera(contenedor);
  const listado = contenedor.querySelector('.listado');

  async function cargar() {
    listado.innerHTML = '<p class="cargando">Cargando trabajos…</p>';
    try {
      const trabajos = await listarTrabajos();
      if (activa) {
        listado.innerHTML = htmlTabla(trabajos);
      }
    } catch (error) {
      if (activa) {
        listado.innerHTML = `<p class="aviso aviso--error">${escaparHtml(error.message)}</p>`;
      }
    }
  }

  contenedor.querySelector('[data-accion="recargar"]').addEventListener('click', cargar);

  const formulario = contenedor.querySelector('.panel form');
  if (formulario) {
    const aviso = contenedor.querySelector('.panel .aviso');
    const boton = formulario.querySelector('button');

    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const nombre = formulario.nombre.value.trim();
      const fichero = formulario.fichero.files[0];

      const problema = validarImportacion(nombre, fichero);
      if (problema) {
        aviso.textContent = problema;
        aviso.hidden = false;
        return;
      }

      aviso.hidden = true;
      boton.disabled = true;
      boton.textContent = 'Subiendo…';
      try {
        const trabajo = await importarTrabajo(nombre, fichero);
        location.hash = `#/trabajos/${trabajo.id}`;
      } catch (error) {
        aviso.textContent = error.message;
        aviso.hidden = false;
      } finally {
        boton.disabled = false;
        boton.textContent = 'Crear trabajo';
      }
    });
  }

  cargar();

  return () => {
    activa = false;
  };
}
