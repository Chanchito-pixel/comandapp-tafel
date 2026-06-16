// ════════════════════════════════════════════════════════
//  routes/menu.js
// ════════════════════════════════════════════════════════

const express = require('express');
const pool    = require('../db/conexion');
const { verificarToken, soloRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
  try {
    const soloDisp = req.query.disponible === 'true';
    const { rows } = await pool.query(
      soloDisp
        ? 'SELECT * FROM menu WHERE disponible = TRUE ORDER BY categoria, nombre'
        : 'SELECT * FROM menu ORDER BY categoria, nombre'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM menu WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', verificarToken, soloRoles('owner'), async (req, res) => {
  const { nombre, precio, disponible, descripcion, categoria } = req.body;
  if (!nombre || precio === undefined) return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO menu (nombre, precio, disponible, descripcion, categoria) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre, precio, disponible !== false, descripcion||null, categoria||'General']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Owner edita todo; cocina solo puede cambiar "disponible"
router.put('/:id', verificarToken, soloRoles('owner', 'cocina'), async (req, res) => {
  const { nombre, precio, disponible, descripcion, categoria } = req.body;
  const { id }    = req.params;
  const esOwner   = req.usuario.rol === 'owner';
  try {
    const { rows: actual } = await pool.query('SELECT * FROM menu WHERE id=$1', [id]);
    if (!actual[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    const { rows } = await pool.query(
      `UPDATE menu SET nombre=$1, precio=$2, disponible=$3, descripcion=$4, categoria=$5 WHERE id=$6 RETURNING *`,
      [
        esOwner ? (nombre      ?? actual[0].nombre)      : actual[0].nombre,
        esOwner ? (precio      ?? actual[0].precio)      : actual[0].precio,
        disponible !== undefined ? disponible             : actual[0].disponible,
        esOwner ? (descripcion !== undefined ? (descripcion||null) : actual[0].descripcion) : actual[0].descripcion,
        esOwner ? (categoria   ?? actual[0].categoria)   : actual[0].categoria,
        id
      ]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', verificarToken, soloRoles('owner'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM menu WHERE id=$1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto eliminado' });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'No se puede eliminar: tiene comandas asociadas' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
