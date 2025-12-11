/**
 * Script para obtener credenciales de admin
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function getAdminCredentials() {
  const client = await pool.connect();
  
  try {
    // Buscar usuarios admin
    const result = await client.query(`
      SELECT email, role, created_at
      FROM users
      WHERE role = 'ADMIN'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n📋 USUARIOS ADMINISTRADORES:\n');
    
    if (result.rows.length === 0) {
      console.log('⚠️  No hay usuarios administradores en la base de datos\n');
      console.log('💡 Crear uno con:');
      console.log('   INSERT INTO users (email, password_hash, role) VALUES');
      console.log("   ('admin@fcg.cl', '$2b$10$hashedpassword', 'ADMIN');\n");
    } else {
      result.rows.forEach((user, i) => {
        console.log(`${i + 1}. Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Creado: ${new Date(user.created_at).toLocaleString('es-CL')}`);
        console.log('');
      });
      
      console.log('\n🔐 CREDENCIALES PARA EL CLIENTE:\n');
      console.log('──────────────────────────────────────');
      console.log('Email: admin@fcg.org');
      console.log('Contraseña: Admin123!');
      console.log('──────────────────────────────────────');
      console.log('\nNOTA: Si estas credenciales no funcionan, necesitas');
      console.log('crear un usuario admin con esas credenciales.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

getAdminCredentials();
