// Vista #/login

import { iniciarSesion } from '../auth.js';

export function vistaLogin(contenedor) {
  contenedor.innerHTML = `
    <main class="acceso">
      <section class="acceso__panel">
        <h1 class="acceso__titulo">Procesamiento IA</h1>
        <p class="acceso__texto">Envía lotes de preguntas a OpenAI respetando sus límites y revisa las respuestas.</p>
        <form class="formulario" novalidate>
          <label class="campo">
            <span class="campo__etiqueta">Usuario</span>
            <input class="campo__control" name="usuario" autocomplete="username" required />
          </label>
          <label class="campo">
            <span class="campo__etiqueta">Contraseña</span>
            <input class="campo__control" name="clave" type="password" autocomplete="current-password" required />
          </label>
          <p class="aviso aviso--error" role="alert" hidden></p>
          <button class="boton boton--primario" type="submit">Iniciar sesión</button>
        </form>
      </section>
    </main>`;

  const formulario = contenedor.querySelector('form');
  const aviso = contenedor.querySelector('.aviso');
  const boton = formulario.querySelector('button');

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const usuario = formulario.usuario.value.trim();
    const clave = formulario.clave.value;

    if (!usuario || !clave) {
      aviso.textContent = 'Escribe el usuario y la contraseña.';
      aviso.hidden = false;
      return;
    }

    aviso.hidden = true;
    boton.disabled = true;
    boton.textContent = 'Comprobando…';
    try {
      await iniciarSesion(usuario, clave);
      location.hash = '#/trabajos';
    } catch (error) {
      aviso.textContent = error.message;
      aviso.hidden = false;
      formulario.clave.select();
    } finally {
      boton.disabled = false;
      boton.textContent = 'Iniciar sesión';
    }
  });

  formulario.usuario.focus();
}
