/**
 * Script para encontrar aplicaciones que comiencen con cierto prefijo
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL;

const prefix = process.argv[2];

if (!prefix) {
  console.error('❌ Uso: node scripts/find-application.js <prefix>');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();

    const result = await client.query(
      `SELECT id, status, call_id, submitted_at
       FROM applications 
       WHERE id::text LIKE $1 || '%'
       ORDER BY created_at DESC
       LIMIT 10`,
      [prefix]
    );

    console.log(`\nEncontradas ${result.rows.length} aplicaciones:\n`);
    result.rows.forEach(app => {
      console.log(`ID: ${app.id}`);
      console.log(`Status: ${app.status}`);
      console.log(`Call ID: ${app.call_id}`);
      console.log(`Submitted: ${app.submitted_at}`);
      console.log('-'.repeat(80));
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

main();
