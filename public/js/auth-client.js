/**
 * Maneja el formulario de login. Guarda el JWT en localStorage (para que
 * el propio cliente pueda usarlo en futuras llamadas fetch/AJAX, ver
 * SRS 3.3.2) y TAMBIEN en una cookie no-httpOnly, para que la navegacion
 * normal entre paginas EJS (GET completos del navegador) tambien quede
 * autenticada sin convertir todo el panel en una SPA.
 */
(function () {
  const form = document.getElementById('login-form');
  if (!form) return;

  const errorBox = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorBox.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Validando...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.mensaje || 'No fue posible iniciar sesion');
      }

      localStorage.setItem('cf_token', data.token);
      // Cookie de sesion (8h) para que las cargas de pagina completas tambien autentiquen.
      const maxAge = 8 * 60 * 60;
      document.cookie = `token=${data.token}; path=/; max-age=${maxAge}; SameSite=Lax`;

      window.location.href = window.CF_REDIRECT_HINT || data.redirect || '/';
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Iniciar sesion';
    }
  });
})();
