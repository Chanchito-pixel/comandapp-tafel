// ════════════════════════════════════════════════════════
//  db/seed.js  —  Crea el usuario admin inicial
//  Ejecutar UNA VEZ con:  npm run seed
// ════════════════════════════════════════════════════════

const pool   = require('./conexion');
const bcrypt = require('bcrypt');

async function seed() {
  try {
    // Verifica si ya existe algún usuario
    const existe = await pool.query('SELECT COUNT(*) FROM empleados');
    
    if (parseInt(existe.rows[0].count) === 0) {
      const hash = await bcrypt.hash('admin', 10);
      
      const result = await pool.query(`
        INSERT INTO empleados (nombre, apellido, dni, mail, rol, pass_hash)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, ['Admin', 'Sistema', '00000000', 'admin@tafel.com', 'owner', hash]);

      console.log('✅ Base de datos inicializada correctamente.');
      console.log('👤 Usuario admin creado:');
      console.log(`   Legajo: ${result.rows[0].id}  |  Contraseña: admin`);
    } else {
      console.log('ℹ️  Ya existen usuarios, seed no modificó nada.');
    }
  } catch (err) {
    console.error('❌ Error en seed:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
