import './styles.css';
import { iniciarRouter } from './router.js';
import { borrarSesion } from './sesion.js';

// api.js lanza este evento cuando el servidor rechaza las credenciales guardadas.
window.addEventListener('sesion-caducada', () => {
  borrarSesion();
  location.hash = '#/login';
});

iniciarRouter(document.querySelector('#app'));
