const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function getTestUsers() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           USUARIOS DISPONIBLES PARA PRUEBAS                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Usuarios ADMIN
    const admins = await client.query(`
      SELECT email, full_name, role, created_at, last_login_at
      FROM users 
      WHERE role = 'ADMIN'
      ORDER BY created_at
      LIMIT 5
    `);
    
    console.log('👑 ADMINISTRADORES\n');
    admins.rows.forEach((user, i) => {
      console.log(`${i + 1}. Email: ${user.email}`);
      console.log(`   Nombre: ${user.full_name}`);
      console.log(`   Último login: ${user.last_login_at ? new Date(user.last_login_at).toLocaleString('es-CL') : 'Nunca'}\n`);
    });

    // Usuarios REVIEWER
    const reviewers = await client.query(`
      SELECT email, full_name, role, created_at, last_login_at
      FROM users 
      WHERE role = 'REVIEWER'
      ORDER BY created_at
    `);
    
    console.log('🔍 REVISORES\n');
    reviewers.rows.forEach((user, i) => {
      console.log(`${i + 1}. Email: ${user.email}`);
      console.log(`   Nombre: ${user.full_name}`);
      console.log(`   Último login: ${user.last_login_at ? new Date(user.last_login_at).toLocaleString('es-CL') : 'Nunca'}\n`);
    });

    // Usuarios APPLICANT con postulaciones
    const applicants = await client.query(`
      SELECT u.email, u.full_name, u.role, u.last_login_at,
        (SELECT COUNT(*) FROM applications a WHERE a.applicant_id = u.applicant_id) as application_count
      FROM users u
      WHERE u.role = 'APPLICANT'
      AND u.applicant_id IS NOT NULL
      ORDER BY application_count DESC, u.last_login_at DESC NULLS LAST
      LIMIT 5
    `);
    
    console.log('📝 POSTULANTES (con aplicaciones)\n');
    applicants.rows.forEach((user, i) => {
      console.log(`${i + 1}. Email: ${user.email}`);
      console.log(`   Nombre: ${user.full_name}`);
      console.log(`   Postulaciones: ${user.application_count}`);
      console.log(`   Último login: ${user.last_login_at ? new Date(user.last_login_at).toLocaleString('es-CL') : 'Nunca'}\n`);
    });

    // Verificar si existe usuario de prueba común
    const commonTestUser = await client.query(`
      SELECT email, full_name, role
      FROM users
      WHERE email IN ('test@test.com', 'demo@demo.com', 'admin@fcg.local', 'reviewer@fcg.local')
    `);

    if (commonTestUser.rows.length > 0) {
      console.log('🔑 USUARIOS COMUNES DE PRUEBA\n');
      commonTestUser.rows.forEach(user => {
        console.log(`• ${user.email} (${user.role})`);
        console.log(`  Nombre: ${user.full_name}\n`);
      });
    }

    console.log('═'.repeat(60));
    console.log('⚠️  NOTA IMPORTANTE:');
    console.log('Las contraseñas están hasheadas por seguridad.');
    console.log('Para obtener acceso, puedes:');
    console.log('1. Usar el sistema de reset de contraseña desde el frontend');
    console.log('2. Crear un token de cambio de contraseña desde el backend');
    console.log('3. Revisar la documentación del proyecto por contraseñas de prueba');
    console.log('═'.repeat(60));

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getTestUsers();
