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

    const sql = `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'applicants' AND column_name = 'institution_id'
        ) THEN
          ALTER TABLE applicants
          ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
          
          RAISE NOTICE 'Columna institution_id agregada a tabla applicants';
        ELSE
          RAISE NOTICE 'Columna institution_id ya existe en tabla applicants';
        END IF;
      END $$;
    `;

    await client.query(sql);
    console.log('✓ Migración ejecutada correctamente');

    // Verificar que la columna existe
    const checkResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'applicants' AND column_name = 'institution_id'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✓ Columna institution_id confirmada:', checkResult.rows[0]);
    } else {
      console.log('✗ Error: columna no encontrada después de la migración');
    }
  } catch (error) {
    console.error('✗ Error ejecutando migración:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
