// Funciones de apoyo para las vistas.

import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Evita que un texto recibido de la API se interprete como HTML.
export function escaparHtml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// El backend envía fechas como "2026-09-23T19:13:39.008483948":
// sin zona horaria (el servidor trabaja en UTC) y con nanosegundos.
export function convertirFecha(texto) {
  if (!texto) {
    return null;
  }
  const partes = String(texto).match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?/);
  if (!partes) {
    return null;
  }
  const milisegundos = (partes[2] || '').padEnd(3, '0').slice(0, 3);
  const fecha = new Date(`${partes[1]}.${milisegundos}Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

const formatoFecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

export function formatearFecha(texto) {
  const fecha = convertirFecha(texto);
  return fecha ? formatoFecha.format(fecha) : 'Sin fecha';
}

// Las respuestas de OpenAI vienen en Markdown. Se convierten a HTML
// y se limpian con DOMPurify antes de insertarlas en la página.
export function markdownSeguro(texto) {
  return DOMPurify.sanitize(marked.parse(texto || ''));
}

const ETIQUETAS_ESTADO = {
  PENDIENTE: 'Pendiente',
  PROCESANDO: 'Procesando',
  FINALIZADO: 'Finalizado',
  FINALIZADO_CON_ERRORES: 'Finalizado con errores',
  COMPLETADO: 'Completado',
  ERROR: 'Error',
};

export function etiquetaEstado(estado) {
  return ETIQUETAS_ESTADO[estado] || estado;
}

// "FINALIZADO_CON_ERRORES" -> "estado--finalizado-con-errores"
export function claseEstado(estado) {
  return `estado--${String(estado || '').toLowerCase().replaceAll('_', '-')}`;
}

export function insigniaEstado(estado) {
  return `<span class="estado ${claseEstado(estado)}">${escaparHtml(etiquetaEstado(estado))}</span>`;
}

// ---------- Errores de OpenAI ----------
// El backend guarda en mensajeError un texto con este formato:
//   OpenAI HTTP 401 (invalid_api_key): Incorrect API key provided: ...
// Aquí se interpreta para mostrar la causa y qué hacer.

// Causas por código de error de OpenAI (el más preciso).
const CAUSAS_POR_CODIGO = {
  invalid_api_key: {
    titulo: 'Clave de OpenAI no válida',
    sugerencia: 'La clave configurada en el servidor (OPENAI_API_KEY) es incorrecta o ha sido revocada. Corrígela y reinicia el contenedor procesamientoia.',
  },
  insufficient_quota: {
    titulo: 'Sin crédito en la cuenta de OpenAI',
    sugerencia: 'La cuenta asociada a la clave ha agotado su saldo o su límite de gasto. Revisa la facturación en platform.openai.com.',
  },
  rate_limit_exceeded: {
    titulo: 'Límite de peticiones de OpenAI',
    sugerencia: 'OpenAI siguió respondiendo 429 después de todos los reintentos. Aumenta openai.intervalo-ms o reduce procesamiento.numero-hilos.',
  },
  model_not_found: {
    titulo: 'Modelo no disponible',
    sugerencia: 'El modelo indicado en openai.model no existe o la cuenta no tiene acceso a él.',
  },
};

// Causas por código HTTP, cuando OpenAI no envía un código propio.
function causaPorEstadoHttp(estado) {
  if (estado === 400) {
    return { titulo: 'OpenAI rechazó la petición', sugerencia: 'Revisa el modelo (openai.model) y el formato de la petición en OpenAIService.' };
  }
  if (estado === 401) {
    return CAUSAS_POR_CODIGO.invalid_api_key;
  }
  if (estado === 403) {
    return { titulo: 'Acceso denegado por OpenAI', sugerencia: 'La clave no tiene permiso para este modelo o el proyecto de OpenAI tiene restricciones.' };
  }
  if (estado === 404) {
    return { titulo: 'Modelo o dirección no encontrados', sugerencia: 'Revisa openai.model y openai.url en la configuración del servidor.' };
  }
  if (estado === 429) {
    return { titulo: 'Límite o cuota de OpenAI agotados', sugerencia: 'Espera unos minutos, aumenta openai.intervalo-ms o revisa el saldo de la cuenta.' };
  }
  if (estado >= 500) {
    return { titulo: 'OpenAI no está disponible', sugerencia: 'El servicio de OpenAI ha fallado. Vuelve a intentarlo más tarde.' };
  }
  return { titulo: 'Error al consultar OpenAI', sugerencia: '' };
}

export function interpretarErrorOpenAI(mensaje) {
  const original = String(mensaje || '').trim() || 'Error desconocido';

  // Formato actual: "OpenAI HTTP 401 (invalid_api_key): detalle"
  const partes = original.match(/^OpenAI HTTP (\d{3})(?: \(([^)]+)\))?:\s*([\s\S]*)$/);
  if (partes) {
    const estado = Number(partes[1]);
    const codigo = partes[2] || '';
    const causa = CAUSAS_POR_CODIGO[codigo] || causaPorEstadoHttp(estado);
    return {
      clave: codigo || `http_${estado}`,
      titulo: causa.titulo,
      detalle: `HTTP ${estado}${codigo ? ` (${codigo})` : ''}. ${partes[3]}`,
      sugerencia: causa.sugerencia,
      original,
    };
  }

  if (original.startsWith('No se ha podido establecer comunicación con OpenAI')) {
    return {
      clave: 'sin_conexion',
      titulo: 'Sin conexión con OpenAI',
      detalle: original,
      sugerencia: 'El servidor no pudo conectar con api.openai.com. Comprueba que tiene acceso a Internet.',
      original,
    };
  }

  // Formato antiguo: "Error devuelto por OpenAI: " + JSON (a veces vacío).
  const inicioJson = original.indexOf('{');
  if (inicioJson !== -1) {
    try {
      const error = JSON.parse(original.slice(inicioJson)).error || {};
      const causa = CAUSAS_POR_CODIGO[error.code] || { titulo: 'OpenAI rechazó la petición', sugerencia: '' };
      return { clave: error.code || error.type || original, titulo: causa.titulo, detalle: error.message || '', sugerencia: causa.sugerencia, original };
    } catch {
      // No era JSON.
    }
  }
  if (/^Error devuelto por OpenAI:\s*$/.test(original)) {
    return {
      clave: 'sin_detalle',
      titulo: 'Error de OpenAI sin detalle',
      detalle: 'El servidor no guardó ni el código HTTP ni la causa del error.',
      sugerencia: 'Este error se registró con una versión anterior de OpenAIService. Actualiza el backend y vuelve a procesar un trabajo para ver la causa.',
      original,
    };
  }

  return { clave: original, titulo: 'Error al consultar OpenAI', detalle: original, sugerencia: '', original };
}
