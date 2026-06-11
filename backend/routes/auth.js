// ════════════════════════════════════════════════════════
//  routes/auth.js  —  Login
// ════════════════════════════════════════════════════════

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/conexion');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { legajo, pass } = req.body;

  if (!legajo || !pass) {
    return res.status(400).json({ error: 'Ingresá legajo y contraseña' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM empleados WHERE id = $1 AND activo = TRUE',
      [parseInt(legajo)]
    );

    const usuario = rows[0];
    if (!usuario) {
      return res.status(401).json({ error: 'Legajo o contraseña incorrectos' });
    }

    const valido = await bcrypt.compare(pass, usuario.pass_hash);
    if (!valido) {
      return res.status(401).json({ error: 'Legajo o contraseña incorrectos' });
    }

    // JWT con legajo y rol — expira en 10 horas
    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '10h' }
    );

    res.json({
      token,
      usuario: {
        id:       usuario.id,
        nombre:   usuario.nombre,
        apellido: usuario.apellido,
        rol:      usuario.rol,
        mail:     usuario.mail
      }
    });

  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
