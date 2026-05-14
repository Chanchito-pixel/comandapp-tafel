// ════════════════════════════════════════════════════════
//  db/conexion.js  —  Pool de conexiones a PostgreSQL
//  Se importa en todas las rutas que necesiten la BD
// ════════════════════════════════════════════════════════

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'comandapp',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// Avisa en consola si hay un error inesperado en el pool
pool.on('error', (err) => {
  console.error('❌ Error en el pool de PostgreSQL:', err.message);
});

// Verifica la conexión al arrancar
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Conectado a PostgreSQL'))
  .catch(err => {
    console.error('❌ No se pudo conectar a PostgreSQL:', err.message);
    console.error('   Revisá las variables en el archivo .env');
  });

module.exports = pool;
