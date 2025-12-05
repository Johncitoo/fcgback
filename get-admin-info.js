/**
 * Script para obtener o actualizar contraseña de admin existente
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function getAdminInfo() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔍 Buscando usuarios administradores...\n');
    
    const result = await client.query(`
      SELECT id, email, role, is_active, created_at
      FROM users
      WHERE role = 'ADMIN'
      ORDER BY created_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('⚠️  No hay usuarios administradores');
      console.log('\n💡 Necesitas crear uno desde el backend de NestJS');
      console.log('   o ejecutar un INSERT manual en la BD.\n');
      return;
    }
    
    console.log('📋 USUARIOS ADMINISTRADORES ENCONTRADOS:\n');
    result.rows.forEach((user, i) => {
      console.log(`${i + 1}. ${user.email}`);
      console.log(`   └─ Role: ${user.role} | Activo: ${user.is_active ? 'Sí' : 'No'}`);
      console.log(`   └─ Creado: ${new Date(user.created_at).toLocaleString('es-CL')}\n`);
    });
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('🔐 CREDENCIALES PARA EL CLIENTE');
    console.log('═══════════════════════════════════════════════════\n');
    console.log('🌐 URL:        https://fcgfront.vercel.app/login');
    console.log('👤 Email:      admin@fcg.local');
    console.log('🔑 Contraseña: admin123  (o la que hayas configurado)');
    console.log('\n═══════════════════════════════════════════════════\n');
    console.log('📝 INSTRUCCIONES PARA EL CLIENTE:\n');
    console.log('1. Abrir https://fcgfront.vercel.app/login');
    console.log('2. Ir a la pestaña "Acceso" (NO usar "Postular")');
    console.log('3. Ingresar email y contraseña');
    console.log('4. Click en "Iniciar sesión"');
    console.log('5. Será redirigido al Panel de Administración\n');
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log('⚠️  NOTA IMPORTANTE:');
    console.log('Si no recuerdas la contraseña del admin, necesitas:');
    console.log('1. Usar el endpoint POST /auth/reset-password del backend');
    console.log('2. O actualizar directamente en la BD con un hash bcrypt\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

getAdminInfo();
