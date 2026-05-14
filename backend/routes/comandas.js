// ════════════════════════════════════════════════════════
//  routes/comandas.js  —  Comandas + Socket.IO en tiempo real
// ════════════════════════════════════════════════════════

const express = require('express');
const pool    = require('../db/conexion');
const { verificarToken, soloRoles } = require('../middleware/auth');

const router = express.Router();

// ── Query reutilizable que trae una comanda completa ─────
const SELECT_COMANDA = `
  SELECT
    c.id, c.estado, c.observaciones, c.total,
    c.creado_en, c.actualizado_en,
    m.id   AS mesa_id,
    m.numero AS mesa_numero,
    e.id   AS mozo_id,
    e.nombre   AS mozo_nombre,
    e.apellido AS mozo_apellido,
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
  LEFT JOIN mesas     m  ON c.id_mesa  = m.id
  LEFT JOIN empleados e  ON c.id_mozo  = e.id
  LEFT JOIN detalle_comanda dc ON c.id = dc.id_comanda
  LEFT JOIN menu      p  ON dc.id_producto = p.id
`;

// GET /api/comandas — Todas las activas (pendiente/aceptada/lista)
// Usada por cocina y owner
router.get('/', verificarToken, soloRoles('owner', 'cocina'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      SELECT_COMANDA +
      `WHERE c.estado IN ('pendiente','aceptada','lista')
       GROUP BY c.id, m.id, e.id
       ORDER BY c.creado_en ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/comandas/mozo/:id — Comandas del mozo logueado
router.get('/mozo/:id', verificarToken, async (req, res) => {
  // El mozo solo puede ver las suyas; owner puede ver las de cualquiera
  if (req.usuario.rol === 'mozo' && req.usuario.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Solo podés ver tus propias comandas' });
  }

  try {
    const { rows } = await pool.query(
      SELECT_COMANDA +
      `WHERE c.id_mozo = $1 AND c.estado NOT IN ('entregada')
       GROUP BY c.id, m.id, e.id
       ORDER BY c.creado_en DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/comandas/mesa/:id — Comandas activas de una mesa
router.get('/mesa/:id', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      SELECT_COMANDA +
      `WHERE c.id_mesa = $1 AND c.estado NOT IN ('entregada','rechazada')
       GROUP BY c.id, m.id, e.id
       ORDER BY c.creado_en DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/comandas — Mozo crea una comanda
// Body: { id_mesa, observaciones, items: [{id_producto, cantidad}] }
router.post('/', verificarToken, soloRoles('owner', 'mozo'), async (req, res) => {
  const { id_mesa, observaciones, items } = req.body;
  const io = req.app.get('io');

  if (!id_mesa || !items?.length) {
    return res.status(400).json({ error: 'Mesa e ítems son obligatorios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear la comanda
    const { rows: [comanda] } = await client.query(
      `INSERT INTO comandas (id_mesa, id_mozo, observaciones)
       VALUES ($1, $2, $3) RETURNING *`,
      [id_mesa, req.usuario.id, observaciones || null]
    );

    // 2. Insertar ítems y calcular total
    let total = 0;
    for (const item of items) {
      // Obtiene precio actual del producto
      const { rows: [prod] } = await client.query(
        'SELECT precio FROM menu WHERE id = $1 AND disponible = TRUE',
        [item.id_producto]
      );
      if (!prod) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Producto ${item.id_producto} no disponible` });
      }

      await client.query(
        `INSERT INTO detalle_comanda (id_comanda, id_producto, cantidad, precio_unidad)
         VALUES ($1, $2, $3, $4)`,
        [comanda.id, item.id_producto, item.cantidad, prod.precio]
      );
      total += prod.precio * item.cantidad;
    }

    // 3. Actualizar total de la comanda
    await client.query(
      'UPDATE comandas SET total = $1 WHERE id = $2',
      [total, comanda.id]
    );

    // 4. Marcar mesa como ocupada
    await client.query(
      "UPDATE mesas SET estado = 'ocupada' WHERE id = $1",
      [id_mesa]
    );

    await client.query('COMMIT');

    // 5. Traer comanda completa para devolverla y emitirla
    const { rows: [completa] } = await pool.query(
      SELECT_COMANDA + `WHERE c.id = $1 GROUP BY c.id, m.id, e.id`,
      [comanda.id]
    );

    // 6. 📡 Notificar a cocina en tiempo real
    io.to('cocina').emit('nueva-comanda', completa);

    res.status(201).json(completa);

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/comandas/:id/estado — Cocina cambia el estado
// Body: { estado: 'aceptada' | 'rechazada' | 'lista' | 'entregada' }
router.put('/:id/estado', verificarToken, soloRoles('cocina', 'mozo', 'owner'), async (req, res) => {
  const { estado } = req.body;
  const { id }     = req.params;
  const io         = req.app.get('io');

  const estadosValidos = ['aceptada','rechazada','lista','entregada'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE comandas SET estado=$1, actualizado_en=NOW()
       WHERE id=$2 RETURNING *`,
      [estado, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Comanda no encontrada' });

    const comanda = rows[0];

    // Si se entrega la comanda, verificar si la mesa quedó libre
    if (estado === 'entregada') {
      const { rows: activas } = await pool.query(
        `SELECT COUNT(*) FROM comandas
         WHERE id_mesa = $1 AND estado NOT IN ('entregada','rechazada')`,
        [comanda.id_mesa]
      );
      if (parseInt(activas[0].count) === 0) {
        await pool.query("UPDATE mesas SET estado = 'libre' WHERE id = $1", [comanda.id_mesa]);
      }
    }

    // 📡 Notificar al mozo asignado
    io.to(`mozo-${comanda.id_mozo}`).emit('comanda-actualizada', {
      id: comanda.id, estado, id_mesa: comanda.id_mesa
    });

    // 📡 Notificar a cocina también (para actualizar su vista)
    io.to('cocina').emit('comanda-actualizada', { id: comanda.id, estado });

    res.json({ mensaje: 'Estado actualizado', id: parseInt(id), estado });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/comandas/:id — Cancelar comanda (mozo o owner)
router.delete('/:id', verificarToken, soloRoles('owner', 'mozo'), async (req, res) => {
  const io = req.app.get('io');
  try {
    const { rows } = await pool.query(
      'DELETE FROM comandas WHERE id = $1 RETURNING *', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Comanda no encontrada' });

    io.to('cocina').emit('comanda-eliminada', { id: parseInt(req.params.id) });
    res.json({ mensaje: 'Comanda eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
