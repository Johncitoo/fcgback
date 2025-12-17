const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'tramway.proxy.rlwy.net',
    port: 30026,
    user: 'postgres',
    password: 'LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv',
    database: 'railway',
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // 1. Ver los últimos códigos de verificación creados
    console.log('📋 Últimos códigos de verificación:\n');
    const codes = await client.query(`
      SELECT 
        id,
        code,
        pending_email,
        pending_full_name,
        used,
        expires_at,
        created_at,
        requester_user_id
      FROM admin_verification_codes
      ORDER BY created_at DESC
      LIMIT 10
    `);

    codes.rows.forEach(row => {
      console.log(`  Code: ${row.code}`);
      console.log(`  Para crear: ${row.pending_email} (${row.pending_full_name})`);
      console.log(`  Usado: ${row.used}`);
      console.log(`  Expira: ${row.expires_at}`);
      console.log(`  Creado: ${row.created_at}`);
      console.log(`  Requester: ${row.requester_user_id}`);
      console.log('  ---');
    });

    // 2. Ver los últimos usuarios admin creados
    console.log('\n👑 Últimos usuarios ADMIN creados:\n');
    const admins = await client.query(`
      SELECT 
        id,
        email,
        full_name,
        role,
        is_active,
        created_at
      FROM users
      WHERE role = 'ADMIN'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    admins.rows.forEach(row => {
      console.log(`  📧 ${row.email}`);
      console.log(`  👤 ${row.full_name}`);
      console.log(`  ✅ Activo: ${row.is_active}`);
      console.log(`  📅 Creado: ${row.created_at}`);
      console.log(`  🆔 ID: ${row.id}`);
      console.log('  ---');
    });

    // 3. Buscar el usuario específico que intentó crear
    console.log('\n🔍 Buscando cristianurqueta23@gmail.com:\n');
    const targetUser = await client.query(`
      SELECT 
        id,
        email,
        full_name,
        role,
        is_active,
        created_at
      FROM users
      WHERE email = $1
    `, ['cristianurqueta23@gmail.com']);

    if (targetUser.rows.length > 0) {
      console.log('  ✅ Usuario encontrado:');
      console.log(`  📧 ${targetUser.rows[0].email}`);
      console.log(`  👤 ${targetUser.rows[0].full_name}`);
      console.log(`  🎭 Role: ${targetUser.rows[0].role}`);
      console.log(`  ✅ Activo: ${targetUser.rows[0].is_active}`);
      console.log(`  🆔 ID: ${targetUser.rows[0].id}`);
    } else {
      console.log('  ❌ Usuario NO encontrado en la base de datos');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Desconectado de la BD');
  }
}

main();
