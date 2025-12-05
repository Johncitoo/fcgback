/**
 * Script para ver la estructura de la tabla users
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkUsersSchema() {
  try {
    console.log('🔍 Verificando estructura de la tabla users...\n');

    // Obtener información de columnas
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);

    console.log('📋 COLUMNAS DE LA TABLA USERS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    result.rows.forEach(col => {
      console.log(`${col.column_name.padEnd(30)} | ${col.data_type.padEnd(20)} | ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Ver un usuario de ejemplo
    const userResult = await pool.query('SELECT * FROM users WHERE role = $1 LIMIT 1', ['ADMIN']);
    
    if (userResult.rows.length > 0) {
      console.log('👤 USUARIO ADMIN DE EJEMPLO:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      const user = userResult.rows[0];
      Object.keys(user).forEach(key => {
        const value = key.includes('password') || key.includes('hash') ? '***OCULTO***' : user[key];
        console.log(`${key.padEnd(30)} | ${value}`);
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

checkUsersSchema()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
