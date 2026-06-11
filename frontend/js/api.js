/* ════════════════════════════════════════════════════════
   js/api.js  —  Funciones compartidas por todas las páginas
   Importar con: <script src="../js/api.js"></script>
   (o <script src="js/api.js"> desde la raíz)
════════════════════════════════════════════════════════ */

const API = '/api';

// ── Sesión ────────────────────────────────────────────────
function getToken()  { return sessionStorage.getItem('token'); }
function getUser()   { const u = sessionStorage.getItem('user'); return u ? JSON.parse(u) : null; }
function setSession(token, usuario) {
  sessionStorage.setItem('token',   token);
  sessionStorage.setItem('user',    JSON.stringify(usuario));
}
function clearSession() { sessionStorage.clear(); }

// ── Guard de auth ─────────────────────────────────────────
// Llamar al inicio de cada página protegida:
// requireAuth(['owner']) o requireAuth(['mozo','cocina'])
function requireAuth(roles = []) {
  const token = getToken();
  const user  = getUser();
  if (!token || !user) {
    window.location.href = _loginPath();
    return null;
  }
  if (roles.length && !roles.includes(user.rol)) {
    window.location.href = _loginPath();
    return null;
  }
  return user;
}

function _loginPath() {
  const path = window.location.pathname;
  if (path.includes('/owner/') || path.includes('/mozo/') || path.includes('/cocina/')) {
    return '../index.html';
  }
  return 'index.html';
}

function logout() {
  clearSession();
  window.location.href = _loginPath();
}

// ── Fetch helper ──────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token   = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  try {
    const res  = await fetch(API + path, { ...options, headers });
    const data = await res.json();

    if (res.status === 401) {
      clearSession();
      window.location.href = _loginPath();
      return null;
    }
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;

  } catch (err) {
    if (err.message.includes('Failed to fetch')) {
      throw new Error('No se puede conectar al servidor. ¿Está corriendo node server.js?');
    }
    throw err;
  }
}

// ── Toast ─────────────────────────────────────────────────
function toast(msg, type = 'success', duration = 3200) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = (type === 'success' ? '✓ ' : type === 'error' ? '✕ ' : 'ℹ ') + msg;
  el.className   = `toast toast-${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

// ── Topbar helper ─────────────────────────────────────────
// Rellena los elementos del topbar con los datos del usuario
function setupTopbar() {
  const user = getUser();
  if (!user) return;

  const name   = document.getElementById('topbar-name');
  const avatar = document.getElementById('topbar-avatar');
  const role   = document.getElementById('topbar-role');

  if (name)   name.textContent   = user.nombre + ' ' + user.apellido;
  if (avatar) avatar.textContent = (user.nombre[0] + user.apellido[0]).toUpperCase();
  if (role) {
    const labels = { owner: 'Dueño', mozo: 'Mozo', cocina: 'Cocina' };
    role.textContent = labels[user.rol] || user.rol;
    role.className   = `topbar-role role-${user.rol}`;
  }
}

// ── Badge helpers ─────────────────────────────────────────
function rolBadge(rol) {
  const map = { owner: 'badge-owner', mozo: 'badge-mozo', cocina: 'badge-cocina' };
  const lbl = { owner: 'Dueño', mozo: 'Mozo', cocina: 'Cocina' };
  return `<span class="badge ${map[rol]||''}">${lbl[rol]||rol}</span>`;
}

function estadoBadge(estado) {
  const cls = {
    pendiente: 'badge-pendiente', aceptada: 'badge-aceptada',
    rechazada: 'badge-rechazada', lista: 'badge-lista',
    entregada: 'badge-entregada', libre: 'badge-libre',
    ocupada:   'badge-ocupada',   reservada: 'badge-reserv'
  };
  return `<span class="badge ${cls[estado]||''}">${estado}</span>`;
}

// ── Tiempo relativo ───────────────────────────────────────
function tiempoRelativo(fecha) {
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000);
  if (diff < 60)  return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff/60)}m`;
  return `hace ${Math.floor(diff/3600)}h`;
}

// ── Formatear precio ──────────────────────────────────────
function formatPrecio(n) {
  return '$' + parseFloat(n || 0).toFixed(2);
}
