const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function checkAdminUser() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Buscar usuarios ADMIN
    const result = await client.query(`
      SELECT 
        id,
        email,
        full_name,
        role,
        is_active,
        created_at
      FROM users
      WHERE role IN ('ADMIN', 'REVIEWER')
      ORDER BY created_at DESC
    `);

    console.log(`📊 Total usuarios ADMIN/REVIEWER: ${result.rows.length}\n`);

    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Nombre: ${user.full_name}`);
      console.log(`   Rol: ${user.role}`);
      console.log(`   Activo: ${user.is_active}`);
      console.log(`   Creado: ${user.created_at}`);
      console.log('');
    });

    // Buscar específicamente weycarlitos193
    const weycarlitos = await client.query(`
      SELECT * FROM users WHERE email = 'weycarlitos193@gmail.com'
    `);

    if (weycarlitos.rows.length > 0) {
      console.log('🔍 Usuario weycarlitos193@gmail.com EXISTE:');
      console.log(JSON.stringify(weycarlitos.rows[0], null, 2));
    } else {
      console.log('❌ Usuario weycarlitos193@gmail.com NO EXISTE en la base de datos');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkAdminUser();
