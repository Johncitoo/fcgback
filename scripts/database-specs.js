const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function getDatabaseSpecs() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║          ESPECIFICACIONES DE LA BASE DE DATOS                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // 1. Versión de PostgreSQL
    const versionResult = await client.query('SELECT version()');
    console.log('📊 MOTOR DE BASE DE DATOS:');
    console.log('─'.repeat(60));
    console.log(versionResult.rows[0].version);
    console.log();

    // 2. Información del servidor
    console.log('🌐 CONEXIÓN:');
    console.log('─'.repeat(60));
    console.log(`Host: tramway.proxy.rlwy.net`);
    console.log(`Puerto: 30026`);
    console.log(`Base de datos: railway`);
    console.log(`Usuario: postgres`);
    console.log(`Proveedor: Railway (PostgreSQL Cloud)`);
    console.log();

    // 3. Tamaño de la base de datos
    const sizeResult = await client.query(`
      SELECT 
        pg_database.datname as database_name,
        pg_size_pretty(pg_database_size(pg_database.datname)) AS size
      FROM pg_database
      WHERE datname = 'railway'
    `);
    
    console.log('💾 TAMAÑO ACTUAL:');
    console.log('─'.repeat(60));
    console.log(`Base de datos: ${sizeResult.rows[0].database_name}`);
    console.log(`Tamaño: ${sizeResult.rows[0].size}`);
    console.log();

    // 4. Número de tablas
    const tablesResult = await client.query(`
      SELECT COUNT(*) as total
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    console.log('📋 TABLAS:');
    console.log('─'.repeat(60));
    console.log(`Total tablas: ${tablesResult.rows[0].total}`);
    console.log();

    // 5. Lista de todas las tablas con row count
    const tablesList = await client.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as columns
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('📊 DETALLE DE TABLAS:');
    console.log('─'.repeat(60));
    
    for (const table of tablesList.rows) {
      const countResult = await client.query(`SELECT COUNT(*) FROM "${table.table_name}"`);
      const count = countResult.rows[0].count;
      console.log(`  • ${table.table_name.padEnd(35)} | ${table.columns} columnas | ${count} registros`);
    }
    console.log();

    // 6. Índices
    const indexResult = await client.query(`
      SELECT COUNT(*) as total
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    
    console.log('🔍 ÍNDICES:');
    console.log('─'.repeat(60));
    console.log(`Total índices: ${indexResult.rows[0].total}`);
    console.log();

    // 7. Características de PostgreSQL utilizadas
    console.log('⚙️  CARACTERÍSTICAS UTILIZADAS:');
    console.log('─'.repeat(60));
    console.log('  ✓ JSONB (para schemas de formularios)');
    console.log('  ✓ UUID (para IDs primarias)');
    console.log('  ✓ Foreign Keys (relaciones entre tablas)');
    console.log('  ✓ Timestamps con timezone');
    console.log('  ✓ Arrays (para whoCanFill en milestones)');
    console.log('  ✓ Argon2 (para hasheo de contraseñas)');
    console.log('  ✓ Triggers y constraints');
    console.log();

    // 8. Compatibilidad
    console.log('═'.repeat(60));
    console.log('⚠️  ANÁLISIS DE COMPATIBILIDAD CON MySQL/phpMyAdmin');
    console.log('═'.repeat(60));
    console.log();
    console.log('🔴 INCOMPATIBLE DIRECTO:');
    console.log('  ✗ PostgreSQL vs MySQL son motores diferentes');
    console.log('  ✗ JSONB no existe en MySQL (usar JSON)');
    console.log('  ✗ UUID nativo vs CHAR(36) en MySQL');
    console.log('  ✗ Sintaxis SQL diferente en algunos casos');
    console.log('  ✗ Arrays nativos vs strings separados por comas');
    console.log();
    console.log('🟡 REQUIERE MIGRACIÓN:');
    console.log('  • Convertir JSONB a JSON');
    console.log('  • Cambiar UUID a CHAR(36) o BINARY(16)');
    console.log('  • Adaptar timestamps (timestamptz)');
    console.log('  • Reescribir queries específicas de PostgreSQL');
    console.log('  • Adaptar funciones y triggers');
    console.log();
    console.log('✅ ALTERNATIVAS:');
    console.log('  1. Mantener PostgreSQL en Railway (recomendado)');
    console.log('  2. Migrar a MySQL en Railway');
    console.log('  3. Usar herramienta de migración: pgloader');
    console.log('  4. Export/Import manual con adaptaciones');
    console.log();

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getDatabaseSpecs();
