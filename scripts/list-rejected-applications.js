/**
 * Script para listar aplicaciones rechazadas (NOT_SELECTED)
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();

    const result = await client.query(
      `SELECT 
        a.id,
        a.status,
        a.call_id,
        a.submitted_at,
        a.updated_at
       FROM applications a
       WHERE a.status = 'NOT_SELECTED'
       ORDER BY a.updated_at DESC
       LIMIT 20`
    );

    console.log(`\n📋 Aplicaciones Rechazadas (NOT_SELECTED): ${result.rows.length}\n`);
    console.log('='.repeat(100));
    
    result.rows.forEach((app, idx) => {
      console.log(`\n${idx + 1}. Aplicación ID: ${app.id}`);
      console.log(`   Call ID: ${app.call_id}`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Última actualización: ${app.updated_at}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

main();
