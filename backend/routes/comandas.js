// ════════════════════════════════════════════════════════
//  routes/comandas.js
// ════════════════════════════════════════════════════════

const express = require('express');
const pool    = require('../db/conexion');
const { verificarToken, soloRoles } = require('../middleware/auth');

const router = express.Router();

const SELECT_COMANDA = `
  SELECT
    c.id, c.estado, c.observaciones, c.total, c.pagada,
    c.creado_en, c.actualizado_en,
    m.id        AS mesa_id,
    m.numero    AS mesa_numero,
    e.id        AS mozo_id,
    e.nombre    AS mozo_nombre,
    e.apellido  AS mozo_apellido,
    COALESCE(
      json_agg(
        json_build_object(
          'id',            dc.id,
          'id_producto',   dc.id_producto,
          'producto',      p.nombre,
          'cantidad',      dc.cantidad,
          'precio_unidad', dc.precio_unidad,
          'subtotal',      dc.cantidad * dc.precio_unidad
        )
      ) FILTER (WHERE dc.id IS NOT NULL),
      '[]'
    ) AS items
  FROM comandas c
  LEFT JOIN mesas           m  ON c.id_mesa     = m.id
  LEFT JOIN empleados       e  ON c.id_mozo      = e.id
  LEFT JOIN detalle_comanda dc ON c.id           = dc.id_comanda
  LEFT JOIN menu            p  ON dc.id_producto = p.id
`;

// GET /api/comandas — activas (cocina y owner)
router.get('/', verificarToken, soloRoles('owner', 'cocina'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      SELECT_COMANDA +
      `WHERE c.estado IN ('pendiente','aceptada','lista')
       GROUP BY c.id, m.id, e.id ORDER BY c.creado_en ASC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/comandas/todas-hoy — activas + entregadas de hoy (para cobro del dueño)
router.get('/todas-hoy', verificarToken, soloRoles('owner'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      SELECT_COMANDA +
      `WHERE (
         c.estado IN ('pendiente','aceptada','lista')
         OR (c.estado = 'entregada' AND c.creado_en >= CURRENT_DATE)
       )
       GROUP BY c.id, m.id, e.id ORDER BY c.creado_en DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/comandas/stats/hoy
router.get('/stats/hoy', verificarToken, soloRoles('owner'), async (req, res) => {
  try {
    const [stats, mejor] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                                           AS total_comandas,
          COUNT(*) FILTER (WHERE estado = 'entregada')                      AS entregadas,
          COUNT(*) FILTER (WHERE estado = 'rechazada')                      AS rechazadas,
          COUNT(*) FILTER (WHERE estado IN ('pendiente','aceptada','lista')) AS activas,
          COALESCE(SUM(total) FILTER (WHERE estado = 'entregada'), 0)        AS monto_total,
          COALESCE(SUM(total) FILTER (WHERE estado = 'entregada' AND pagada = TRUE), 0) AS monto_cobrado
        FROM comandas WHERE creado_en >= CURRENT_DATE
      `),
      pool.query(`
        SELECT e.nombre, e.apellido, COUNT(c.id) AS total
        FROM comandas c
        JOIN empleados e ON c.id_mozo = e.id
        WHERE c.creado_en >= CURRENT_DATE AND c.estado != 'rechazada'
        GROUP BY e.id, e.nombre, e.apellido
        ORDER BY total DESC LIMIT 1
      `)
    ]);
    res.json({ ...stats.rows[0], mejor_empleado: mejor.rows[0] || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/comandas/stats/historico?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/stats/historico', verificarToken, soloRoles('owner'), async (req, res) => {
  const desde = req.query.desde || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const hasta = req.query.hasta || new Date().toISOString().slice(0,10);
  try {
    const [porDia, totales, porEmpleado] = await Promise.all([
      pool.query(`
        SELECT DATE(creado_en) AS fecha,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE estado='entregada') AS entregadas,
          COUNT(*) FILTER (WHERE estado='rechazada') AS rechazadas,
          COALESCE(SUM(total) FILTER (WHERE estado='entregada'),0) AS monto,
          COALESCE(SUM(total) FILTER (WHERE estado='entregada' AND pagada=TRUE),0) AS cobrado
        FROM comandas
        WHERE creado_en >= $1 AND creado_en < $2::date + INTERVAL '1 day'
        GROUP BY DATE(creado_en) ORDER BY fecha DESC
      `, [desde, hasta]),
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE estado='entregada') AS entregadas,
          COUNT(*) FILTER (WHERE estado='rechazada') AS rechazadas,
          COALESCE(SUM(total) FILTER (WHERE estado='entregada'),0) AS monto_total,
          COALESCE(SUM(total) FILTER (WHERE estado='entregada' AND pagada=TRUE),0) AS monto_cobrado
        FROM comandas
        WHERE creado_en >= $1 AND creado_en < $2::date + INTERVAL '1 day'
      `, [desde, hasta]),
      pool.query(`
        SELECT e.nombre, e.apellido, COUNT(c.id) AS total,
               COALESCE(SUM(c.total) FILTER (WHERE c.estado='entregada'),0) AS monto
        FROM comandas c JOIN empleados e ON c.id_mozo = e.id
        WHERE c.creado_en >= $1 AND c.creado_en < $2::date + INTERVAL '1 day'
          AND c.estado != 'rechazada'
        GROUP BY e.id, e.nombre, e.apellido ORDER BY total DESC
      `, [desde, hasta])
    ]);
    res.json({ desde, hasta, totales: totales.rows[0], por_dia: porDia.rows, empleados: porEmpleado.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/comandas/mozo/:id
router.get('/mozo/:id', verificarToken, async (req, res) => {
  if (req.usuario.rol === 'mozo' && req.usuario.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Solo podés ver tus propias comandas' });
  }
  try {
    const { rows } = await pool.query(
      SELECT_COMANDA +
      `WHERE c.id_mozo=$1 AND c.estado NOT IN ('entregada')
       GROUP BY c.id, m.id, e.id ORDER BY c.creado_en DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/comandas/mesa/:id
router.get('/mesa/:id', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      SELECT_COMANDA +
      `WHERE c.id_mesa=$1 AND c.estado NOT IN ('entregada','rechazada')
       GROUP BY c.id, m.id, e.id ORDER BY c.creado_en DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/comandas
router.post('/', verificarToken, soloRoles('owner', 'mozo'), async (req, res) => {
  const { id_mesa, observaciones, items } = req.body;
  const io = req.app.get('io');
  if (!id_mesa || !items?.length) return res.status(400).json({ error: 'Mesa e ítems son obligatorios' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [comanda] } = await client.query(
      `INSERT INTO comandas (id_mesa, id_mozo, observaciones) VALUES ($1,$2,$3) RETURNING *`,
      [id_mesa, req.usuario.id, observaciones || null]
    );
    let total = 0;
    for (const item of items) {
      const { rows: [prod] } = await client.query(
        'SELECT precio FROM menu WHERE id=$1 AND disponible=TRUE', [item.id_producto]
      );
      if (!prod) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Producto ${item.id_producto} no disponible` }); }
      await client.query(
        `INSERT INTO detalle_comanda (id_comanda, id_producto, cantidad, precio_unidad) VALUES ($1,$2,$3,$4)`,
        [comanda.id, item.id_producto, item.cantidad, prod.precio]
      );
      total += prod.precio * item.cantidad;
    }
    await client.query('UPDATE comandas SET total=$1 WHERE id=$2', [total, comanda.id]);
    await client.query("UPDATE mesas SET estado='ocupada' WHERE id=$1", [id_mesa]);
    await client.query('COMMIT');
    const { rows: [completa] } = await pool.query(SELECT_COMANDA + `WHERE c.id=$1 GROUP BY c.id,m.id,e.id`, [comanda.id]);
    io.to('cocina').emit('nueva-comanda', completa);
    res.status(201).json(completa);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// PUT /api/comandas/:id/estado
router.put('/:id/estado', verificarToken, soloRoles('cocina','mozo','owner'), async (req, res) => {
  const { estado } = req.body;
  const { id }     = req.params;
  const io         = req.app.get('io');
  if (!['aceptada','rechazada','lista','entregada'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE comandas SET estado=$1, actualizado_en=NOW() WHERE id=$2 RETURNING *`, [estado, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Comanda no encontrada' });
    const comanda = rows[0];
    if (estado === 'entregada') {
      const { rows: activas } = await pool.query(
        `SELECT COUNT(*) FROM comandas WHERE id_mesa=$1 AND estado NOT IN ('entregada','rechazada')`,
        [comanda.id_mesa]
      );
      if (parseInt(activas[0].count) === 0) {
        await pool.query("UPDATE mesas SET estado='libre' WHERE id=$1", [comanda.id_mesa]);
      }
    }
    io.to(`mozo-${comanda.id_mozo}`).emit('comanda-actualizada', { id: comanda.id, estado, id_mesa: comanda.id_mesa });
    io.to('cocina').emit('comanda-actualizada', { id: comanda.id, estado });
    res.json({ mensaje: 'Estado actualizado', id: parseInt(id), estado });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/comandas/:id/pagar
router.put('/:id/pagar', verificarToken, soloRoles('owner','mozo'), async (req, res) => {
  const { pagada } = req.body;
  if (typeof pagada !== 'boolean') return res.status(400).json({ error: 'pagada debe ser true o false' });
  try {
    const { rows } = await pool.query(
      `UPDATE comandas SET pagada=$1, actualizado_en=NOW() WHERE id=$2 RETURNING id, pagada`,
      [pagada, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Comanda no encontrada' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/comandas/:id
router.delete('/:id', verificarToken, soloRoles('owner','mozo'), async (req, res) => {
  const io = req.app.get('io');
  try {
    const { rows } = await pool.query('DELETE FROM comandas WHERE id=$1 RETURNING *', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Comanda no encontrada' });
    io.to('cocina').emit('comanda-eliminada', { id: parseInt(req.params.id) });
    res.json({ mensaje: 'Comanda eliminada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
