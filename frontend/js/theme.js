/* ════════════════════════════════════════════════════════
   theme.js  —  ComandApp TAFEL · Modo Oscuro / Claro / PRO
   Colocar en: frontend/js/theme.js
   Incluir en cada HTML lo antes posible dentro de <head>:
     · index.html         →  <script src="js/theme.js"></script>
     · mozo/*.html        →  <script src="../js/theme.js"></script>
     · cocina/*.html      →  <script src="../js/theme.js"></script>
     · owner/*.html       →  <script src="../js/theme.js"></script>

   HTML requerido para el botón:
   ──────────────────────────────────────────────────────────
   <!-- Botón combinado: clic normal = claro/oscuro · clic largo = PRO -->
   <button id="theme-toggle" class="theme-toggle" title="Cambiar tema"></button>
   <button id="pro-toggle"   class="pro-toggle"   title="Modo PRO">PRO</button>
   ──────────────────────────────────────────────────────────
════════════════════════════════════════════════════════ */

/* ── 1. Aplicar tema ANTES de pintar el DOM (evita flash) ── */
(function () {
  var saved    = localStorage.getItem('comandapp-theme') || 'dark';
  var savedPro = localStorage.getItem('comandapp-pro')   || 'off';
  document.documentElement.setAttribute('data-theme', saved);
  if (savedPro === 'on') {
    document.documentElement.setAttribute('data-pro', 'on');
  }
})();

/* ── 2. Conectar botones una vez el DOM esté listo ───────── */
document.addEventListener('DOMContentLoaded', function () {
  var btnTheme = document.getElementById('theme-toggle');
  var btnPro   = document.getElementById('pro-toggle');

  /* ── Theme toggle (claro ↔ oscuro) ── */
  if (btnTheme) {
    syncThemeIcon(btnTheme, document.documentElement.getAttribute('data-theme'));
    btnTheme.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      var next    = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('comandapp-theme', next);
      syncThemeIcon(btnTheme, next);
    });
  }

  /* ── PRO toggle ── */
  if (btnPro) {
    var isPro = document.documentElement.getAttribute('data-pro') === 'on';
    syncProBtn(btnPro, isPro);

    btnPro.addEventListener('click', function () {
      var active = document.documentElement.getAttribute('data-pro') === 'on';
      var next   = active ? null : 'on';
      if (next) {
        document.documentElement.setAttribute('data-pro', 'on');
        localStorage.setItem('comandapp-pro', 'on');
      } else {
        document.documentElement.removeAttribute('data-pro');
        localStorage.setItem('comandapp-pro', 'off');
      }
      syncProBtn(btnPro, !!next);
      spawnProRipple(btnPro);
    });
  }
});

/* ── 3. Helpers ──────────────────────────────────────────── */
function syncThemeIcon(btn, theme) {
  btn.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'
  );
  btn.innerHTML = theme === 'dark' ? iconSol() : iconLuna();
}

function syncProBtn(btn, active) {
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.setAttribute('aria-label', active ? 'Desactivar modo PRO' : 'Activar modo PRO');
  if (active) {
    btn.classList.add('pro-active');
  } else {
    btn.classList.remove('pro-active');
  }
}

/* Efecto ripple al activar PRO */
function spawnProRipple(btn) {
  var r = document.createElement('span');
  r.className = 'pro-ripple';
  btn.appendChild(r);
  setTimeout(function () { r.remove(); }, 700);
}

function iconSol() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<circle cx="12" cy="12" r="5"/>'
    + '<line x1="12" y1="1"     x2="12" y2="3"/>'
    + '<line x1="12" y1="21"    x2="12" y2="23"/>'
    + '<line x1="4.22" y1="4.22"   x2="5.64"  y2="5.64"/>'
    + '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>'
    + '<line x1="1"  y1="12"    x2="3"  y2="12"/>'
    + '<line x1="21" y1="12"    x2="23" y2="12"/>'
    + '<line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>'
    + '<line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>'
    + '</svg>';
}

function iconLuna() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
    + '</svg>';
}