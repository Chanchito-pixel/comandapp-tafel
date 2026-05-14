// ════════════════════════════════════════════════════════
//  routes/mesas.js  —  CRUD de mesas
// ════════════════════════════════════════════════════════

const express = require('express');
const pool    = require('../db/conexion');
const { verificarToken, soloRoles } = require('../middleware/auth');

const router = express.Router();

// GET /api/mesas — Listar todas (todos los roles autenticados)
router.get('/', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM mesas ORDER BY numero');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mesas/:id — Una mesa
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM mesas WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Mesa no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mesas — Crear (solo owner)
router.post('/', verificarToken, soloRoles('owner'), async (req, res) => {
  const { numero, capacidad } = req.body;
  if (!numero) return res.status(400).json({ error: 'El número de mesa es obligatorio' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO mesas (numero, capacidad) VALUES ($1, $2) RETURNING *',
      [numero, capacidad || 4]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    // Error de UNIQUE: número ya existe
    if (err.code === '23505') {
      return res.status(409).json({ error: `Ya existe la mesa número ${numero}` });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/mesas/:id — Editar (owner modifica datos; mozo puede cambiar estado)
router.put('/:id', verificarToken, soloRoles('owner', 'mozo'), async (req, res) => {
  const { numero, capacidad, estado } = req.body;
  const { id } = req.params;

  try {
    const { rows: actual } = await pool.query('SELECT * FROM mesas WHERE id = $1', [id]);
    if (!actual[0]) return res.status(404).json({ error: 'Mesa no encontrada' });

    // Mozos solo pueden cambiar el estado, no numero ni capacidad
    const esOwner = req.usuario.rol === 'owner';

    const { rows } = await pool.query(
      `UPDATE mesas SET numero=$1, capacidad=$2, estado=$3 WHERE id=$4 RETURNING *`,
      [
        esOwner  ? (numero   ?? actual[0].numero)   : actual[0].numero,
        esOwner  ? (capacidad ?? actual[0].capacidad) : actual[0].capacidad,
        estado   ?? actual[0].estado,
        id
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/mesas/:id — Eliminar (solo owner)
router.delete('/:id', verificarToken, soloRoles('owner'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM mesas WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Mesa no encontrada' });
    res.json({ mensaje: 'Mesa eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
