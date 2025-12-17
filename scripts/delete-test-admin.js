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

    const email = 'test.admin@fundacion.cl';

    const userResult = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      
      await client.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM admin_verification_codes WHERE requester_user_id = $1', [userId]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      
      console.log(`✅ Usuario ${email} eliminado correctamente`);
    } else {
      console.log(`⚠️  Usuario ${email} no encontrado`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Desconectado de la BD');
  }
}

main();
