require('dotenv').config();
const { Client } = require('pg');

async function getUserUUID() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Conectado a PostgreSQL');

    // Obtener el primer usuario (admin)
    const result = await client.query(`
      SELECT id, email, role 
      FROM users 
      ORDER BY created_at 
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('\n✓ Usuario encontrado:');
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  UUID: ${user.id}`);
      return user.id;
    } else {
      console.log('\n⚠ No se encontraron usuarios');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

getUserUUID();
