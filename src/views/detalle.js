// Vista #/trabajos/{id}: datos, progreso en directo, procesamiento y respuestas.

import {
  obtenerTrabajo, listarPrompts, listarRespuestas, obtenerProgreso, procesarTrabajo,
} from '../api.js';
import { esAdmin } from '../sesion.js';
import { INTERVALO_PROGRESO_MS } from '../config.js';
import {
  escaparHtml, formatearFecha, markdownSeguro, insigniaEstado, claseEstado, etiquetaEstado,
  interpretarErrorOpenAI,
} from '../utils.js';
import { htmlCabecera, conectarCabecera } from './layout.js';

function htmlProgreso(progreso, prompts) {
  const terminados = progreso.completados + progreso.errores;
  const celdas = prompts
    .map((p, i) => `<li class="tablero__celda ${claseEstado(p.estado)}" title="Pregunta ${i + 1}: ${etiquetaEstado(p.estado)}"></li>`)
    .join('');

  const leyenda = [
    ['completado', 'Completadas', progreso.completados],
    ['procesando', 'Procesando', progreso.procesando],
    ['pendiente', 'Pendientes', progreso.pendientes],
    ['error', 'Con error', progreso.errores],
  ].map(([clase, texto, valor]) => `
      <div class="leyenda__item">
        <dt><span class="leyenda__muestra estado--${clase}"></span>${texto}</dt>
        <dd>${valor}</dd>
      </div>`).join('');

  return `
    <section class="panel progreso" aria-labelledby="titulo-progreso">
      <h2 class="panel__titulo" id="titulo-progreso">${terminados} de ${progreso.total} preguntas terminadas</h2>
      <ol class="tablero" aria-hidden="true">${celdas}</ol>
      <dl class="leyenda">${leyenda}</dl>
    </section>`;
}

// Agrupa las preguntas fallidas por causa para que el problema se vea de un vistazo.
function htmlResumenErrores(prompts) {
  const fallidos = prompts.filter((p) => p.estado === 'ERROR');
  if (fallidos.length === 0) {
    return '';
  }

  const grupos = new Map();
  for (const prompt of fallidos) {
    const error = interpretarErrorOpenAI(prompt.mensajeError);
    const grupo = grupos.get(error.clave) || { error, cantidad: 0 };
    grupo.cantidad++;
    grupos.set(error.clave, grupo);
  }

  const titulo = fallidos.length === prompts.length
    ? 'Ninguna pregunta ha obtenido respuesta'
    : `${fallidos.length} ${fallidos.length === 1 ? 'pregunta ha fallado' : 'preguntas han fallado'}`;

  const causas = [...grupos.values()].map(({ error, cantidad }) => `
      <li class="errores__causa">
        <p><strong>${escaparHtml(error.titulo)}</strong> (${cantidad} ${cantidad === 1 ? 'pregunta' : 'preguntas'})</p>
        ${error.sugerencia ? `<p>${escaparHtml(error.sugerencia)}</p>` : ''}
        ${error.detalle ? `<p class="errores__detalle">OpenAI: ${escaparHtml(error.detalle)}</p>` : ''}
      </li>`).join('');

  return `
    <section class="panel errores" aria-labelledby="titulo-errores">
      <h2 class="panel__titulo" id="titulo-errores">${titulo}</h2>
      <ul class="errores__lista">${causas}</ul>
    </section>`;
}

function htmlCuerpoPrompt(prompt, respuesta) {
  if (respuesta) {
    return `
      <div class="respuesta">${markdownSeguro(respuesta.texto)}</div>
      <p class="prompt__meta">Respuesta recibida: ${escaparHtml(formatearFecha(respuesta.fechaCreacion))}</p>`;
  }
  if (prompt.estado === 'ERROR') {
    const error = interpretarErrorOpenAI(prompt.mensajeError);
    return `
      <p class="aviso aviso--error"><strong>${escaparHtml(error.titulo)}.</strong> ${escaparHtml(error.detalle)}</p>
      ${error.sugerencia ? `<p>${escaparHtml(error.sugerencia)}</p>` : ''}
      <details class="original">
        <summary>Mensaje completo guardado por el servidor</summary>
        <pre>${escaparHtml(error.original)}</pre>
      </details>`;
  }
  if (prompt.estado === 'PROCESANDO') {
    return '<p class="prompt__meta">Un hilo está esperando la respuesta de OpenAI.</p>';
  }
  return '<p class="prompt__meta">Todavía no se ha enviado a OpenAI.</p>';
}

function htmlPrompts(prompts, respuestasPorPrompt, abiertos) {
  if (prompts.length === 0) {
    return '<p class="vacio">Este trabajo no tiene preguntas.</p>';
  }
  const elementos = prompts.map((p, i) => `
      <li class="prompt">
        <details data-prompt="${p.id}" ${abiertos.has(String(p.id)) ? 'open' : ''}>
          <summary class="prompt__resumen">
            <span class="prompt__numero">${i + 1}</span>
            <span class="prompt__texto">
              ${escaparHtml(p.texto)}
              ${p.estado === 'ERROR' ? `<span class="prompt__error">${escaparHtml(interpretarErrorOpenAI(p.mensajeError).titulo)}</span>` : ''}
            </span>
            ${insigniaEstado(p.estado)}
          </summary>
          <div class="prompt__cuerpo">${htmlCuerpoPrompt(p, respuestasPorPrompt.get(p.id))}</div>
        </details>
      </li>`).join('');

  return `
    <section aria-labelledby="titulo-preguntas">
      <h2 class="seccion__titulo" id="titulo-preguntas">Preguntas y respuestas</h2>
      <ol class="prompts">${elementos}</ol>
    </section>`;
}

export function vistaDetalle(contenedor, id) {
  let activa = true;
  let temporizador = null;
  let siguiendo = false; // true mientras se consulta el progreso periódicamente

  contenedor.innerHTML = `
    ${htmlCabecera()}
    <main class="pagina">
      <a class="volver" href="#/trabajos">Volver a trabajos</a>
      <p class="aviso" role="status" hidden></p>
      <div class="detalle"><p class="cargando">Cargando trabajo…</p></div>
    </main>`;

  conectarCabecera(contenedor);
  const zona = contenedor.querySelector('.detalle');
  const mensaje = contenedor.querySelector('main > .aviso');

  function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = `aviso aviso--${tipo}`;
    mensaje.hidden = false;
  }

  function pintar(trabajo, prompts, respuestas, progreso) {
    // Se conservan abiertas las preguntas que el usuario había desplegado.
    const abiertos = new Set(
      [...zona.querySelectorAll('details[open]')].map((d) => d.dataset.prompt),
    );
    const respuestasPorPrompt = new Map(respuestas.map((r) => [r.promptId, r]));
    const puedeProcesar = esAdmin() && trabajo.estado === 'PENDIENTE';

    zona.innerHTML = `
      <div class="pagina__encabezado">
        <div>
          <h1 class="pagina__titulo">${escaparHtml(trabajo.nombre)}</h1>
          <p class="pagina__subtitulo">Trabajo ${trabajo.id}, creado el ${escaparHtml(formatearFecha(trabajo.fechaCreacion))}</p>
        </div>
        <div class="pagina__acciones">
          ${insigniaEstado(trabajo.estado)}
          ${puedeProcesar ? '<button class="boton boton--primario" type="button" data-accion="procesar">Procesar trabajo</button>' : ''}
        </div>
      </div>
      ${htmlResumenErrores(prompts)}
      ${htmlProgreso(progreso, prompts)}
      ${htmlPrompts(prompts, respuestasPorPrompt, abiertos)}`;
  }

  function programarSeguimiento() {
    clearTimeout(temporizador);
    temporizador = setTimeout(cargar, INTERVALO_PROGRESO_MS);
  }

  async function cargar() {
    try {
      const [trabajo, prompts, respuestas, progreso] = await Promise.all([
        obtenerTrabajo(id),
        listarPrompts(id),
        listarRespuestas(id),
        obtenerProgreso(id),
      ]);
      if (!activa) {
        return;
      }
      pintar(trabajo, prompts, respuestas, progreso);

      // Mientras los hilos trabajan, se vuelve a consultar dentro de unos segundos.
      if (trabajo.estado === 'PROCESANDO') {
        siguiendo = true;
        programarSeguimiento();
      } else if (siguiendo) {
        siguiendo = false;
        if (progreso.errores === 0) {
          mostrarMensaje('Procesamiento terminado: todas las preguntas tienen respuesta.', 'exito');
        } else if (progreso.completados === 0) {
          mostrarMensaje('Procesamiento terminado sin ninguna respuesta. Revisa la causa más abajo.', 'error');
        } else {
          const errores = progreso.errores === 1 ? '1 error' : `${progreso.errores} errores`;
          mostrarMensaje(`Procesamiento terminado con ${errores}. Revisa la causa más abajo.`, 'error');
        }
      }
    } catch (error) {
      if (!activa) {
        return;
      }
      const yaHabiaDatos = zona.querySelector('.progreso') !== null;
      if (yaHabiaDatos && error.estado !== 401 && error.estado !== 404) {
        mostrarMensaje(`No se pudo actualizar el progreso (${error.message}). Se reintentará.`, 'error');
        programarSeguimiento();
      } else {
        zona.innerHTML = `<p class="aviso aviso--error">${escaparHtml(error.message)}</p>`;
      }
    }
  }

  zona.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-accion="procesar"]');
    if (!boton) {
      return;
    }
    const total = zona.querySelectorAll('.prompt').length;
    if (!window.confirm(`Se enviarán ${total} preguntas a OpenAI. Esta operación tiene coste. ¿Continuar?`)) {
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Iniciando…';
    try {
      const texto = await procesarTrabajo(id);
      mostrarMensaje(texto, 'exito');
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    }
    await cargar();
  });

  cargar();

  // El router llama a esta función al salir de la vista.
  return () => {
    activa = false;
    clearTimeout(temporizador);
  };
}
