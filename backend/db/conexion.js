// ════════════════════════════════════════════════════════
//  db/conexion.js — Conexión a Neon PostgreSQL
// ════════════════════════════════════════════════════════

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Avisa en consola si hay un error inesperado en el pool
pool.on('error', (err) => {
  console.error('❌ Error en PostgreSQL:', err.message);
});

// Verifica la conexión al arrancar
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Conectado a Neon PostgreSQL'))
  .catch(err => {
    console.error('❌ No se pudo conectar a Neon:', err.message);
    console.error('   Revisá DATABASE_URL en .env');
  });

module.exports = pool;