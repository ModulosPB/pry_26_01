// Cliente de la API del Reto Merkle para el frontend (Vite).
// La URL base se toma de la variable de entorno VITE_API_URL:
//   - en local: fichero .env.development
//   - en Vercel: Settings -> Environment Variables

const API_URL = import.meta.env.VITE_API_URL;

let credenciales = null;

// Codifica usuario:clave en Base64 admitiendo tildes y eñes
function basic(usuario, clave) {
  const bytes = new TextEncoder().encode(`${usuario}:${clave}`);
  return "Basic " + btoa(String.fromCharCode(...bytes));
}

export function login(usuario, clave) {
  credenciales = basic(usuario, clave);
}

export function logout() {
  credenciales = null;
}

async function peticion(ruta, opciones = {}) {
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: {
      ...(credenciales ? { Authorization: credenciales } : {}),
      ...(opciones.headers || {}),
    },
  });

  if (!respuesta.ok) {
    let mensaje = `Error ${respuesta.status}`;
    if (respuesta.status === 401) mensaje = "Usuario o contraseña incorrectos";
    if (respuesta.status === 403) mensaje = "No tienes permiso para esta operación";
    try {
      const cuerpo = await respuesta.json();
      if (cuerpo.message || cuerpo.mensaje) mensaje = cuerpo.message || cuerpo.mensaje;
    } catch { /* la respuesta no era JSON */ }
    throw new Error(mensaje);
  }

  const tipo = respuesta.headers.get("Content-Type") || "";
  return tipo.includes("application/json") ? respuesta.json() : respuesta.text();
}

// ----- Endpoints -----

export const listarTrabajos    = ()   => peticion("/trabajos");
export const obtenerTrabajo    = (id) => peticion(`/trabajos/${id}`);
export const listarPrompts     = (id) => peticion(`/trabajos/${id}/prompts`);
export const listarRespuestas  = (id) => peticion(`/trabajos/${id}/respuestas`);
export const obtenerProgreso   = (id) => peticion(`/trabajos/${id}/progreso`);
export const procesarTrabajo   = (id) => peticion(`/trabajos/${id}/procesar`, { method: "POST" });

// No se fija Content-Type: el navegador lo genera con el boundary del multipart
export function importarTrabajo(nombre, fichero) {
  const datos = new FormData();
  datos.append("nombre", nombre);
  datos.append("fichero", fichero);
  return peticion("/trabajos/importar", { method: "POST", body: datos });
}
