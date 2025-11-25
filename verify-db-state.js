require('dotenv').config();
const { Client } = require('pg');

async function verifyDatabaseState() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Conectado a PostgreSQL');

    // Verificar columnas
    const columns = await client.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'applicants' 
      AND column_name IN ('first_name', 'last_name', 'rut_number', 'rut_dv', 'institution_id')
      ORDER BY column_name
    `);
    console.log('\n✓ Estado de columnas:');
    console.log(JSON.stringify(columns.rows, null, 2));

    // Verificar índice de RUT
    const rutIndex = await client.query(`
      SELECT indexdef 
      FROM pg_indexes 
      WHERE indexname = 'idx_applicants_rut_unique'
    `);
    console.log('\n✓ Índice de RUT:');
    console.log(rutIndex.rows[0]?.indexdef || 'No encontrado');

    // Verificar trigger de validación
    const trigger = await client.query(`
      SELECT pg_get_functiondef(p.oid) as function_def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'applicants_validate_rut'
      AND n.nspname = 'public'
    `);
    console.log('\n✓ Trigger de validación RUT:');
    console.log(trigger.rows[0]?.function_def || 'No encontrado');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyDatabaseState();
