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

    // Hacer first_name y last_name opcionales
    await client.query(`
      ALTER TABLE applicants 
      ALTER COLUMN first_name DROP NOT NULL,
      ALTER COLUMN last_name DROP NOT NULL;
    `);
    
    console.log('✓ Columnas first_name y last_name ahora son opcionales');

    // Verificar cambios
    const checkResult = await client.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'applicants' 
      AND column_name IN ('first_name', 'last_name')
      ORDER BY column_name
    `);

    console.log('✓ Estado de columnas:', checkResult.rows);
  } catch (error) {
    console.error('✗ Error ejecutando migración:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
