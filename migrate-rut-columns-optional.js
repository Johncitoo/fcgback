require('dotenv').config();
const { Client } = require('pg');

async function makeRutColumnsOptional() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Conectado a PostgreSQL');

    // Hacer las columnas de RUT opcionales
    await client.query(`
      ALTER TABLE applicants 
      ALTER COLUMN rut_number DROP NOT NULL,
      ALTER COLUMN rut_dv DROP NOT NULL
    `);
    console.log('✓ Columnas rut_number y rut_dv ahora son opcionales');

    // Verificar
    const verify = await client.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'applicants' 
      AND column_name IN ('rut_number', 'rut_dv')
      ORDER BY column_name
    `);
    console.log('✓ Estado de columnas:', verify.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

makeRutColumnsOptional();
