// Script para ejecutar migración de activación de convocatorias en Railway
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Usa la URL de entorno o solicita al usuario
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL no está configurada');
  console.log('Por favor ejecuta: $env:DATABASE_URL="tu-connection-string"; node run-activation-migration.js');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Conectando a Railway...');
    await client.connect();
    console.log('✅ Conectado\n');

    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, '..', 'BD', 'migrations', '005_add_call_activation_control.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Ejecutando migración...');
    await client.query(migrationSQL);
    console.log('✅ Migración ejecutada exitosamente\n');

    // Verificar los cambios
    console.log('🔍 Verificando estructura de tabla calls...');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'calls'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Columnas de la tabla calls:');
    console.table(result.rows);

    // Verificar funciones creadas
    console.log('\n🔍 Verificando funciones creadas...');
    const functions = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_name IN ('is_call_active', 'auto_close_expired_calls')
      ORDER BY routine_name;
    `);

    console.log('\n📊 Funciones de activación:');
    console.table(functions.rows);

    // Verificar vista creada
    console.log('\n🔍 Verificando vista active_calls...');
    const views = await client.query(`
      SELECT table_name, view_definition
      FROM information_schema.views
      WHERE table_name = 'active_calls';
    `);

    if (views.rows.length > 0) {
      console.log('✅ Vista active_calls creada correctamente');
    }

    // Mostrar estado actual de convocatorias
    console.log('\n📊 Estado actual de convocatorias:');
    const calls = await client.query(`
      SELECT 
        id, 
        name, 
        year, 
        status, 
        is_active, 
        start_date, 
        end_date, 
        auto_close
      FROM calls
      ORDER BY year DESC, name;
    `);

    console.table(calls.rows);

  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Desconectado de Railway');
  }
}

runMigration();
