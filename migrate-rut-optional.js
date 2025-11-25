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
      CREATE OR REPLACE FUNCTION applicants_validate_rut()
      RETURNS TRIGGER AS $$
      DECLARE dv_expected TEXT;
      BEGIN
        -- Si no hay RUT, permitir (RUT opcional)
        IF NEW.rut_number IS NULL AND NEW.rut_dv IS NULL THEN
          RETURN NEW;
        END IF;

        -- Si solo uno está NULL, es error
        IF NEW.rut_number IS NULL OR NEW.rut_dv IS NULL THEN
          RAISE EXCEPTION 'RUT incompleto: tanto rut_number como rut_dv deben estar presentes o ambos NULL';
        END IF;

        -- Validar RUT
        NEW.rut_dv := UPPER(TRIM(NEW.rut_dv));
        dv_expected := rut_calc_dv(NEW.rut_number);
        IF dv_expected IS NULL OR NEW.rut_dv <> dv_expected THEN
          RAISE EXCEPTION 'RUT inválido: %-% (dígito verificador esperado: %)',
            NEW.rut_number, NEW.rut_dv, dv_expected;
        END IF;

        RETURN NEW;
      END $$ LANGUAGE plpgsql;
    `;

    await client.query(sql);
    console.log('✓ Función applicants_validate_rut actualizada correctamente');

    // Verificar que la función existe
    const checkResult = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname = 'applicants_validate_rut'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✓ Función confirmada en la base de datos');
    } else {
      console.log('✗ Error: función no encontrada después de la migración');
    }
  } catch (error) {
    console.error('✗ Error ejecutando migración:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
