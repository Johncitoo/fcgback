const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
});

async function checkUser() {
  try {
    await client.connect();
    
    const result = await client.query(
      `SELECT id, email, full_name, role, LEFT(password_hash, 50) as hash_preview 
       FROM users 
       WHERE email = $1`,
      ['juanjacontrerasra@gmail.com']
    );

    console.log('Usuario encontrado:', JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkUser();
