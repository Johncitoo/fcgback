/**
 * Script rápido para ver todos los usuarios
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function getAllUsers() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('\n🔌 Conectado a Railway PostgreSQL\n');
    
    const result = await client.query(`
      SELECT 
        email, 
        full_name,
        role, 
        is_active,
        last_login_at,
        created_at
      FROM users
      ORDER BY role, created_at DESC
    `);

    console.log('═══════════════════════════════════════════════════════════════════════\n');
    console.log(`📊 TOTAL USUARIOS: ${result.rows.length}\n`);
    
    const byRole = { ADMIN: [], REVIEWER: [], APPLICANT: [] };
    result.rows.forEach(user => byRole[user.role].push(user));

    // ADMIN
    console.log(`👑 ADMINISTRADORES (${byRole.ADMIN.length})`);
    console.log('───────────────────────────────────────────────────────────────────────');
    byRole.ADMIN.forEach((u, i) => {
      console.log(`${i + 1}. ${u.full_name} <${u.email}>`);
      console.log(`   ${u.is_active ? '✅' : '❌'} | Último login: ${u.last_login_at ? new Date(u.last_login_at).toLocaleString('es-CL') : 'Nunca'}`);
    });

    // REVIEWER
    console.log(`\n🔍 REVISORES (${byRole.REVIEWER.length})`);
    console.log('───────────────────────────────────────────────────────────────────────');
    if (byRole.REVIEWER.length === 0) {
      console.log('⚠️  NO HAY REVISORES EN EL SISTEMA');
    } else {
      byRole.REVIEWER.forEach((u, i) => {
        console.log(`${i + 1}. ${u.full_name} <${u.email}>`);
        console.log(`   ${u.is_active ? '✅' : '❌'} | Último login: ${u.last_login_at ? new Date(u.last_login_at).toLocaleString('es-CL') : 'Nunca'}`);
      });
    }

    // APPLICANT
    console.log(`\n📝 POSTULANTES (${byRole.APPLICANT.length})`);
    console.log('───────────────────────────────────────────────────────────────────────');
    byRole.APPLICANT.slice(0, 10).forEach((u, i) => {
      console.log(`${i + 1}. ${u.full_name} <${u.email}>`);
      console.log(`   ${u.is_active ? '✅' : '❌'} | Último login: ${u.last_login_at ? new Date(u.last_login_at).toLocaleString('es-CL') : 'Nunca'}`);
    });
    if (byRole.APPLICANT.length > 10) {
      console.log(`... y ${byRole.APPLICANT.length - 10} más`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

getAllUsers().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
