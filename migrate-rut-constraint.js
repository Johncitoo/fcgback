const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✓ Conectado a PostgreSQL');

    // Eliminar el constraint único de RUT (permite múltiples NULL)
    await client.query(`
      ALTER TABLE applicants DROP CONSTRAINT IF EXISTS uq_applicants_rut;
    `);
    
    console.log('✓ Constraint único de RUT eliminado');

    // Crear un índice único parcial que solo valida RUTs no nulos
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_applicants_rut_unique 
      ON applicants(rut_number, rut_dv) 
      WHERE rut_number IS NOT NULL AND rut_dv IS NOT NULL;
    `);
    
    console.log('✓ Índice único parcial creado para RUT');

    // Verificar
    const checkResult = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'applicants' 
      AND indexname = 'idx_applicants_rut_unique'
    `);

    console.log('✓ Índice confirmado:', checkResult.rows[0]?.indexdef || 'No encontrado');
  } catch (error) {
    console.error('✗ Error ejecutando migración:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
