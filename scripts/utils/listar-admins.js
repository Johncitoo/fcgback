const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function listarUsuariosAdmin() {
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL\n');

    console.log('═'.repeat(80));
    console.log('👥 USUARIOS CON ROL ADMIN');
    console.log('═'.repeat(80));
    console.log();
    
    const users = await client.query(`
      SELECT 
        id,
        email,
        full_name,
        role,
        is_active,
        created_at
      FROM users
      WHERE role = 'ADMIN'
      ORDER BY created_at
    `);

    if (users.rows.length === 0) {
      console.log('❌ No hay usuarios con rol ADMIN\n');
    } else {
      console.log(`Total de admins: ${users.rows.length}\n`);
      
      users.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Nombre: ${user.full_name || '(sin nombre)'}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Activo: ${user.is_active ? 'SÍ' : 'NO'}`);
        console.log(`   Creado: ${user.created_at}`);
        console.log();
      });
    }

    console.log('═'.repeat(80));
    console.log('📝 NOTA: Para hacer login necesitas el email exacto de arriba');
    console.log('═'.repeat(80));

    await client.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listarUsuariosAdmin().catch(console.error);
