/**
 * Script para revisar estructura de audit_logs en Railway
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Ver estructura de audit_logs
    console.log('📊 ESTRUCTURA DE audit_logs:');
    console.log('============================');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'audit_logs' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
