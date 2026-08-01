(function () {
  'use strict';

  // --- Header: sombra al hacer scroll ---
  var header = document.getElementById('lp-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // --- Menu movil ---
  var burger = document.getElementById('lp-burger');
  var nav = document.getElementById('lp-nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(isOpen));
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // --- Filtro de portafolio ---
  var filters = document.querySelectorAll('.lp-filter');
  var projects = document.querySelectorAll('.lp-project');
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filters.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var target = btn.getAttribute('data-filter');
      projects.forEach(function (card) {
        var match = target === 'todos' || card.getAttribute('data-category') === target;
        card.classList.toggle('is-hidden', !match);
      });
    });
  });

  // --- Formulario de cotizacion (AJAX, sin recargar) ---
  var form = document.getElementById('lp-form');
  var status = document.getElementById('lp-form-status');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var submitBtn = form.querySelector('.lp-form-submit');
      var data = Object.fromEntries(new FormData(form).entries());

      submitBtn.disabled = true;
      status.textContent = 'Enviando...';
      status.className = 'lp-form-status';

      fetch('/cotizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
        .then(function (result) {
          if (result.ok && result.body.ok) {
            status.textContent = result.body.mensaje || 'Recibimos tu solicitud. Te contactaremos pronto.';
            status.className = 'lp-form-status is-ok';
            form.reset();
          } else {
            status.textContent = (result.body && result.body.mensaje) || 'No pudimos enviar tu solicitud. Intenta de nuevo.';
            status.className = 'lp-form-status is-error';
          }
        })
        .catch(function () {
          status.textContent = 'Error de conexion. Intenta de nuevo en unos segundos.';
          status.className = 'lp-form-status is-error';
        })
        .finally(function () {
          submitBtn.disabled = false;
        });
    });
  }
})();
