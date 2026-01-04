const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function createBackup() {
  const client = new Client({ connectionString: DATABASE_URL });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = path.join(__dirname, `backup-railway-${timestamp}.sql`);
  
  try {
    await client.connect();
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              CREANDO BACKUP DE BASE DE DATOS                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    let sqlOutput = '';
    
    // Header del backup
    sqlOutput += `-- ================================================================\n`;
    sqlOutput += `-- BACKUP COMPLETO - BASE DE DATOS RAILWAY\n`;
    sqlOutput += `-- Fecha: ${new Date().toLocaleString()}\n`;
    sqlOutput += `-- Base de datos: railway\n`;
    sqlOutput += `-- Servidor: Railway PostgreSQL\n`;
    sqlOutput += `-- ================================================================\n\n`;
    sqlOutput += `SET client_encoding = 'UTF8';\n`;
    sqlOutput += `SET standard_conforming_strings = on;\n\n`;
    
    // Obtener todas las tablas
    console.log('📋 Obteniendo lista de tablas...\n');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`   Total tablas: ${tables.length}\n`);
    
    // Para cada tabla, obtener estructura y datos
    for (const tableName of tables) {
      console.log(`📊 Procesando: ${tableName}...`);
      
      // 1. Estructura de la tabla
      const createTableResult = await client.query(`
        SELECT 
          'CREATE TABLE "' || table_name || '" (' || 
          string_agg(
            column_name || ' ' || 
            CASE 
              WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
              WHEN data_type = 'USER-DEFINED' THEN udt_name
              ELSE UPPER(data_type)
            END ||
            CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
            CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
            ', '
          ) || ');'
        FROM information_schema.columns
        WHERE table_name = $1
        GROUP BY table_name
      `, [tableName]);
      
      if (createTableResult.rows.length > 0) {
        sqlOutput += `\n-- ================================================================\n`;
        sqlOutput += `-- Tabla: ${tableName}\n`;
        sqlOutput += `-- ================================================================\n\n`;
        sqlOutput += `DROP TABLE IF EXISTS "${tableName}" CASCADE;\n`;
        sqlOutput += createTableResult.rows[0]['?column?'] + '\n\n';
      }
      
      // 2. Datos de la tabla
      const countResult = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
      const count = parseInt(countResult.rows[0].count);
      
      if (count > 0) {
        console.log(`   → Exportando ${count} registros...`);
        
        // Obtener columnas
        const columnsResult = await client.query(`
          SELECT column_name, data_type, udt_name
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        
        const columns = columnsResult.rows.map(r => r.column_name);
        const columnTypes = columnsResult.rows.map(r => r.data_type === 'USER-DEFINED' ? r.udt_name : r.data_type);
        
        // Obtener datos en lotes de 100
        const batchSize = 100;
        for (let offset = 0; offset < count; offset += batchSize) {
          const dataResult = await client.query(
            `SELECT * FROM "${tableName}" ORDER BY 1 LIMIT ${batchSize} OFFSET ${offset}`
          );
          
          for (const row of dataResult.rows) {
            const values = columns.map((col, idx) => {
              const value = row[col];
              const type = columnTypes[idx];
              
              if (value === null) return 'NULL';
              
              // Manejo de diferentes tipos de datos
              if (type === 'uuid' || type === 'text' || type === 'character varying' || 
                  type.includes('char') || type === 'citext') {
                return `'${String(value).replace(/'/g, "''")}'`;
              }
              
              if (type === 'jsonb' || type === 'json') {
                return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
              }
              
              if (type === 'timestamp with time zone' || type === 'timestamp without time zone') {
                return `'${value}'`;
              }
              
              if (type === 'boolean') {
                return value ? 'true' : 'false';
              }
              
              if (type === 'ARRAY' || Array.isArray(value)) {
                return `ARRAY[${value.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')}]`;
              }
              
              return value;
            });
            
            sqlOutput += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
          }
        }
        
        sqlOutput += '\n';
      } else {
        console.log(`   → Sin datos`);
      }
    }
    
    // Obtener y exportar secuencias
    console.log('\n🔢 Exportando secuencias...');
    const sequencesResult = await client.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
    `);
    
    for (const seq of sequencesResult.rows) {
      const seqName = seq.sequence_name;
      sqlOutput += `\n-- Secuencia: ${seqName}\n`;
      sqlOutput += `DROP SEQUENCE IF EXISTS "${seqName}" CASCADE;\n`;
      
      const seqInfoResult = await client.query(`
        SELECT * FROM "${seqName}"
      `);
      
      if (seqInfoResult.rows.length > 0) {
        const info = seqInfoResult.rows[0];
        sqlOutput += `CREATE SEQUENCE "${seqName}";\n`;
        sqlOutput += `SELECT setval('"${seqName}"', ${info.last_value}, ${info.is_called});\n\n`;
      }
    }
    
    // Exportar índices
    console.log('🔍 Exportando índices...');
    const indexesResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname
    `);
    
    if (indexesResult.rows.length > 0) {
      sqlOutput += `\n-- ================================================================\n`;
      sqlOutput += `-- ÍNDICES\n`;
      sqlOutput += `-- ================================================================\n\n`;
      
      for (const idx of indexesResult.rows) {
        sqlOutput += idx.indexdef + ';\n';
      }
    }
    
    // Exportar foreign keys
    console.log('🔗 Exportando foreign keys...');
    const fkResult = await client.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name
    `);
    
    if (fkResult.rows.length > 0) {
      sqlOutput += `\n-- ================================================================\n`;
      sqlOutput += `-- FOREIGN KEYS\n`;
      sqlOutput += `-- ================================================================\n\n`;
      
      for (const fk of fkResult.rows) {
        sqlOutput += `ALTER TABLE "${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" `;
        sqlOutput += `FOREIGN KEY ("${fk.column_name}") `;
        sqlOutput += `REFERENCES "${fk.foreign_table_name}" ("${fk.foreign_column_name}") `;
        sqlOutput += `ON UPDATE ${fk.update_rule} ON DELETE ${fk.delete_rule};\n`;
      }
    }
    
    // Guardar archivo
    console.log('\n💾 Guardando backup...');
    fs.writeFileSync(backupFile, sqlOutput, 'utf8');
    
    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                  ✅ BACKUP COMPLETADO                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log(`📁 Archivo: ${path.basename(backupFile)}`);
    console.log(`📊 Tamaño: ${fileSizeMB} MB`);
    console.log(`📍 Ubicación: ${backupFile}\n`);
    console.log(`🔐 Este archivo contiene:`);
    console.log(`   • Estructura completa de ${tables.length} tablas`);
    console.log(`   • Todos los datos`);
    console.log(`   • Índices y foreign keys`);
    console.log(`   • Secuencias\n`);
    console.log(`⚠️  IMPORTANTE: Guarda este archivo en un lugar seguro.`);
    console.log(`   Puedes usarlo para restaurar la base de datos si algo sale mal.\n`);
    
    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createBackup();
