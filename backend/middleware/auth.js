// ════════════════════════════════════════════════════════
//  middleware/auth.js  —  Verificación JWT y roles
// ════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

// Verifica que el pedido traiga un token JWT válido
function verificarToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) {
    return res.status(401).json({ error: 'Se requiere autenticación' });
  }

  const token = auth.replace('Bearer ', '');
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado. Volvé a loguearte.' });
  }
}

// Verifica que el usuario tenga uno de los roles permitidos
// Uso: soloRoles('owner'), soloRoles('owner','mozo')
function soloRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
      return res.status(403).json({
        error: `Acceso denegado. Roles permitidos: ${roles.join(', ')}`
      });
    }
    next();
  };
}

module.exports = { verificarToken, soloRoles };
