/**
 * Script para listar todos los usuarios del sistema
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkAllUsers() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔍 VERIFICANDO USUARIOS EN EL SISTEMA...\n');
    
    // Obtener todos los usuarios
    const result = await client.query(`
      SELECT 
        email, 
        full_name,
        role, 
        is_active,
        applicant_id,
        last_login_at,
        created_at
      FROM users
      ORDER BY role, created_at DESC
    `);

    console.log('═══════════════════════════════════════════════════════════════════════\n');
    
    if (result.rows.length === 0) {
      console.log('⚠️  No hay usuarios en la base de datos\n');
      console.log('═══════════════════════════════════════════════════════════════════════\n');
      return;
    }

    // Agrupar por rol
    const byRole = {
      ADMIN: [],
      REVIEWER: [],
      APPLICANT: []
    };

    result.rows.forEach(user => {
      byRole[user.role].push(user);
    });

    // Mostrar ADMIN
    console.log('👑 ADMINISTRADORES (' + byRole.ADMIN.length + ')');
    console.log('───────────────────────────────────────────────────────────────────────');
    if (byRole.ADMIN.length === 0) {
      console.log('   ⚠️  No hay usuarios administradores\n');
    } else {
      byRole.ADMIN.forEach((user, i) => {
        console.log(`\n   ${i + 1}. ${user.full_name} <${user.email}>`);
        console.log(`      Estado: ${user.is_active ? '✅ Activo' : '❌ Inactivo'}`);
        console.log(`      Último login: ${user.last_login_at ? new Date(user.last_login_at).toLocaleString('es-CL') : 'Nunca'}`);
        console.log(`      Creado: ${new Date(user.created_at).toLocaleString('es-CL')}`);
      });
      console.log('');
    }

    // Mostrar REVIEWER
    console.log('\n🔍 REVISORES (' + byRole.REVIEWER.length + ')');
    console.log('───────────────────────────────────────────────────────────────────────');
    if (byRole.REVIEWER.length === 0) {
      console.log('   ⚠️  No hay usuarios revisores\n');
    } else {
      byRole.REVIEWER.forEach((user, i) => {
        console.log(`\n   ${i + 1}. ${user.full_name} <${user.email}>`);
        console.log(`      Estado: ${user.is_active ? '✅ Activo' : '❌ Inactivo'}`);
        console.log(`      Último login: ${user.last_login_at ? new Date(user.last_login_at).toLocaleString('es-CL') : 'Nunca'}`);
        console.log(`      Creado: ${new Date(user.created_at).toLocaleString('es-CL')}`);
      });
      console.log('');
    }

    // Mostrar APPLICANT (solo primeros 10)
    console.log('\n📝 POSTULANTES (' + byRole.APPLICANT.length + ')');
    console.log('───────────────────────────────────────────────────────────────────────');
    if (byRole.APPLICANT.length === 0) {
      console.log('   ⚠️  No hay postulantes\n');
    } else {
      const displayCount = Math.min(10, byRole.APPLICANT.length);
      byRole.APPLICANT.slice(0, displayCount).forEach((user, i) => {
        console.log(`\n   ${i + 1}. ${user.full_name} <${user.email}>`);
        console.log(`      Estado: ${user.is_active ? '✅ Activo' : '❌ Inactivo'}`);
        console.log(`      Applicant ID: ${user.applicant_id || 'N/A'}`);
        console.log(`      Último login: ${user.last_login_at ? new Date(user.last_login_at).toLocaleString('es-CL') : 'Nunca'}`);
      });
      if (byRole.APPLICANT.length > displayCount) {
        console.log(`\n   ... y ${byRole.APPLICANT.length - displayCount} más`);
      }
      console.log('');
    }

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('\n📊 RESUMEN:');
    console.log(`   Total usuarios: ${result.rows.length}`);
    console.log(`   - Administradores: ${byRole.ADMIN.length}`);
    console.log(`   - Revisores: ${byRole.REVIEWER.length}`);
    console.log(`   - Postulantes: ${byRole.APPLICANT.length}`);
    console.log('\n═══════════════════════════════════════════════════════════════════════\n');

    // Si no hay revisores, mostrar cómo crear uno
    if (byRole.REVIEWER.length === 0) {
      console.log('\n💡 CÓMO CREAR UN USUARIO REVISOR:\n');
      console.log('Opción 1 - Desde la aplicación (recomendado):');
      console.log('  1. Iniciar sesión como ADMIN');
      console.log('  2. Ir a panel de administración → Usuarios');
      console.log('  3. Crear nuevo usuario con rol REVIEWER\n');
      
      console.log('Opción 2 - Desde SQL directo:');
      console.log("  INSERT INTO users (email, password_hash, full_name, role, is_active)");
      console.log("  VALUES (");
      console.log("    'revisor@fcg.cl',");
      console.log("    '$2b$10$K8qLXZ9Z9Z9Z9Z9Z9Z9Z9u',  -- bcrypt de 'Revisor123!'");
      console.log("    'Revisor FCG',");
      console.log("    'REVIEWER',");
      console.log("    true");
      console.log("  );\n");
    }

  } catch (error) {
    console.error('\n❌ Error conectando a la base de datos:', error.message);
    console.error('\n💡 Verifica que:');
    console.error('  1. El archivo .env existe y tiene DATABASE_URL configurado');
    console.error('  2. La conexión a Railway está activa');
    console.error('  3. Las credenciales son correctas\n');
    throw error;
  } finally {
    await client.release();
    await pool.end();
  }
}

checkAllUsers().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
