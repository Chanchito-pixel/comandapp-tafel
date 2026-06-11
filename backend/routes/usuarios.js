// ════════════════════════════════════════════════════════
//  routes/usuarios.js  —  CRUD de empleados (solo owner)
// ════════════════════════════════════════════════════════

const express              = require('express');
const bcrypt = require('bcryptjs');
const pool                 = require('../db/conexion');
const { verificarToken, soloRoles } = require('../middleware/auth');

const router = express.Router();

// Formatea una fila de BD al formato que usa el frontend
function fmt(u) {
  return {
    id:       u.id,
    nombre:   u.nombre,
    apellido: u.apellido,
    dni:      u.dni      || '',
    telefono: u.telefono || '',
    mail:     u.mail     || '',
    rol:      u.rol,
    activo:   u.activo
  };
}

// GET /api/usuarios — Listar todos
router.get('/', verificarToken, soloRoles('owner'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM empleados ORDER BY id'
    );
    res.json(rows.map(fmt));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usuarios/:id — Obtener uno
router.get('/:id', verificarToken, soloRoles('owner'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM empleados WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(fmt(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/usuarios — Crear
router.post('/', verificarToken, soloRoles('owner'), async (req, res) => {
  const { nombre, apellido, dni, telefono, mail, rol, pass } = req.body;

  if (!nombre || !apellido || !rol || !pass) {
    return res.status(400).json({ error: 'Nombre, apellido, rol y contraseña son obligatorios' });
  }
  if (!['owner','mozo','cocina'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  try {
    const hash = await bcrypt.hash(pass, 10);
    const { rows } = await pool.query(
      `INSERT INTO empleados (nombre, apellido, dni, telefono, mail, rol, pass_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nombre, apellido, dni||null, telefono||null, mail||null, rol, hash]
    );
    res.status(201).json(fmt(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/usuarios/:id — Editar
router.put('/:id', verificarToken, soloRoles('owner'), async (req, res) => {
  const { nombre, apellido, dni, telefono, mail, rol, pass, activo } = req.body;
  const { id } = req.params;

  try {
    // Primero traemos el usuario actual para no pisar lo que no cambia
    const { rows: actual } = await pool.query(
      'SELECT * FROM empleados WHERE id = $1', [id]
    );
    if (!actual[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    const nuevoHash = pass
      ? await bcrypt.hash(pass, 10)
      : actual[0].pass_hash;

    const { rows } = await pool.query(
      `UPDATE empleados
       SET nombre=$1, apellido=$2, dni=$3, telefono=$4, mail=$5, rol=$6, pass_hash=$7, activo=$8
       WHERE id=$9 RETURNING *`,
      [
        nombre   ?? actual[0].nombre,
        apellido ?? actual[0].apellido,
        dni      !== undefined ? (dni||null) : actual[0].dni,
        telefono !== undefined ? (telefono||null) : actual[0].telefono,
        mail     !== undefined ? (mail||null) : actual[0].mail,
        rol      ?? actual[0].rol,
        nuevoHash,
        activo   !== undefined ? activo : actual[0].activo,
        id
      ]
    );
    res.json(fmt(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/usuarios/:id — Eliminar (soft: pone activo=false)
router.delete('/:id', verificarToken, soloRoles('owner'), async (req, res) => {
  const { id } = req.params;

  // No se puede eliminar al admin principal
  if (parseInt(id) === 1) {
    return res.status(403).json({ error: 'No se puede eliminar el usuario principal' });
  }

  try {
    const { rowCount } = await pool.query(
      'UPDATE empleados SET activo = FALSE WHERE id = $1', [id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ mensaje: 'Usuario desactivado', id: parseInt(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
