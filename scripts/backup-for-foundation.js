const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function createBackup() {
  const client = new Client({ connectionString: DATABASE_URL });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = path.join(__dirname, `backup-fundacion-${timestamp}.sql`);
  
  try {
    await client.connect();
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║       BACKUP PARA SERVIDOR FUNDACIÓN (SIN EXTENSIONES)      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    let sqlOutput = '';
    
    // Header
    sqlOutput += `-- ================================================================\n`;
    sqlOutput += `-- BACKUP PARA SERVIDOR FUNDACIÓN\n`;
    sqlOutput += `-- Fecha: ${new Date().toISOString()}\n`;
    sqlOutput += `-- Compatibilidad: PostgreSQL 10+ sin extensiones citext/uuid-ossp\n`;
    sqlOutput += `-- Usa gen_random_uuid() nativo en lugar de uuid-ossp\n`;
    sqlOutput += `-- ================================================================\n\n`;
    sqlOutput += `SET client_encoding = 'UTF8';\n`;
    sqlOutput += `SET standard_conforming_strings = on;\n\n`;
    
    // Exportar tipos ENUM
    console.log('🔤 Exportando tipos ENUM...\n');
    const enumsResult = await client.query(`
      SELECT 
        t.typname as enum_name,
        e.enumlabel as enum_value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY t.typname, e.enumsortorder
    `);
    
    if (enumsResult.rows.length > 0) {
      sqlOutput += `-- ================================================================\n`;
      sqlOutput += `-- Tipos ENUM\n`;
      sqlOutput += `-- ================================================================\n\n`;
      
      const enumsByType = {};
      enumsResult.rows.forEach(row => {
        if (!enumsByType[row.enum_name]) {
          enumsByType[row.enum_name] = [];
        }
        enumsByType[row.enum_name].push(row.enum_value);
      });
      
      for (const [enumName, values] of Object.entries(enumsByType)) {
        const valuesList = values.map(v => `'${v}'`).join(', ');
        sqlOutput += `DROP TYPE IF EXISTS ${enumName} CASCADE;\n`;
        sqlOutput += `CREATE TYPE ${enumName} AS ENUM (${valuesList});\n\n`;
      }
    }
    
    // Obtener tablas
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`📋 Total tablas: ${tables.length}\n`);
    
    for (const tableName of tables) {
      console.log(`📊 ${tableName}...`);
      
      sqlOutput += `\n-- ================================================================\n`;
      sqlOutput += `-- Tabla: ${tableName}\n`;
      sqlOutput += `-- ================================================================\n\n`;
      sqlOutput += `DROP TABLE IF EXISTS "${tableName}" CASCADE;\n`;
      
      // Estructura (reemplazando citext y sin DEFAULT uuid)
      const createTableResult = await client.query(`
        SELECT 
          c.column_name,
          c.data_type,
          c.udt_name,
          c.is_nullable,
          c.column_default
        FROM information_schema.columns c
        WHERE c.table_name = $1
        ORDER BY c.ordinal_position
      `, [tableName]);
      
      const columns = [];
      
      for (const col of createTableResult.rows) {
        let def = `"${col.column_name}" `;
        
        // Reemplazar citext por VARCHAR(255)
        if (col.udt_name === 'citext') {
          def += 'VARCHAR(255)';
        } else if (col.udt_name === '_text') {
          def += 'TEXT[]';
        } else if (col.data_type === 'ARRAY') {
          // Es un array, usar el tipo base + []
          def += col.udt_name.replace('_', '').toUpperCase() + '[]';
        } else if (col.data_type === 'USER-DEFINED') {
          // Es un ENUM u otro tipo personalizado - usar udt_name
          def += col.udt_name;
        } else if (col.data_type === 'character varying') {
          def += 'VARCHAR';
        } else if (col.data_type === 'timestamp with time zone') {
          def += 'TIMESTAMP WITH TIME ZONE';
        } else if (col.data_type === 'timestamp without time zone') {
          def += 'TIMESTAMP WITHOUT TIME ZONE';
        } else {
          def += col.data_type.toUpperCase();
        }
        
        if (col.is_nullable === 'NO') def += ' NOT NULL';
        
        // Reemplazar DEFAULT uuid_generate_v4() por gen_random_uuid() (nativo en PostgreSQL 10+)
        if (col.column_default) {
          if (col.column_default.includes('uuid_generate_v4') || 
              col.column_default.includes('gen_random_uuid')) {
            // Reemplazar con gen_random_uuid() que es nativo
            def += ' DEFAULT gen_random_uuid()';
          } else {
            // Mantener otros defaults como now(), etc.
            def += ` DEFAULT ${col.column_default}`;
          }
        }
        
        columns.push(def);
      }
      
      sqlOutput += `CREATE TABLE "${tableName}" (${columns.join(', ')});\n\n`;
      
      // Agregar PRIMARY KEY
      const pkResult = await client.query(`
        SELECT c.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
        JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
          AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1
      `, [tableName]);
      
      if (pkResult.rows.length > 0) {
        const pkColumns = pkResult.rows.map(r => `"${r.column_name}"`).join(', ');
        sqlOutput += `ALTER TABLE "${tableName}" ADD PRIMARY KEY (${pkColumns});\n\n`;
      }
      
      // Datos
      const dataResult = await client.query(`SELECT * FROM "${tableName}"`);
      
      if (dataResult.rows.length > 0) {
        const columnNames = Object.keys(dataResult.rows[0]);
        const columnTypesResult = await client.query(`
          SELECT column_name, data_type, udt_name
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        
        const typeMap = {};
        columnTypesResult.rows.forEach(r => {
          typeMap[r.column_name] = r.udt_name || r.data_type;
        });
        
        console.log(`   → ${dataResult.rows.length} registros`);
        
        for (const row of dataResult.rows) {
          const values = columnNames.map(col => {
            const value = row[col];
            const type = typeMap[col];
            
            if (value === null) return 'NULL';
            
            // Arrays (ANTES de strings para evitar que sean capturados como strings)
            if (type === '_text' || Array.isArray(value)) {
              // Si value no es un array pero el tipo lo es, podría ser un string PostgreSQL array {val1,val2}
              let arrayValues;
              if (Array.isArray(value)) {
                arrayValues = value;
              } else if (typeof value === 'string' && value.startsWith('{')) {
                // Es un string de PostgreSQL array: {val1,val2}
                arrayValues = value.slice(1, -1).split(',');
              } else {
                // Es un valor simple que debe ir en un array
                arrayValues = [value];
              }
              
              if (arrayValues.length === 0) return 'ARRAY[]::text[]';
              const formatted = arrayValues.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',');
              return `ARRAY[${formatted}]`;
            }
            
            // Timestamps y Dates en formato ISO
            if (type === 'timestamptz' || type === 'timestamp' || type === 'date') {
              if (value instanceof Date) {
                return type === 'date' ? `'${value.toISOString().split('T')[0]}'` : `'${value.toISOString()}'`;
              }
              const dateObj = new Date(value);
              return type === 'date' ? `'${dateObj.toISOString().split('T')[0]}'` : `'${dateObj.toISOString()}'`;
            }
            
            // Strings, UUIDs y ENUMs (todos van con comillas)
            if (type === 'citext' || type === 'text' || type === 'varchar' || 
                type.includes('char') || type === 'uuid' ||
                // ENUMs (cualquier tipo que no sea básico de PostgreSQL)
                (!['int4', 'int8', 'float4', 'float8', 'numeric', 'bool', 'jsonb', 'json', '_text'].includes(type) &&
                 !type.startsWith('timestamp') && type !== 'date')) {
              // Escapar comillas simples y saltos de línea
              const escaped = String(value)
                .replace(/'/g, "''")
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r');
              return `'${escaped}'`;
            }
            
            // JSONB
            if (type === 'jsonb' || type === 'json') {
              return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
            }
            
            // Boolean
            if (type === 'bool') {
              return value ? 'true' : 'false';
            }
            
            // Números y otros valores sin comillas
            return value;
          });
          
          sqlOutput += `INSERT INTO "${tableName}" (${columnNames.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        
        sqlOutput += '\n';
      }
    }
    
    // Índices y constraints
    console.log('\n🔍 Exportando índices y constraints...');
    const indexesResult = await client.query(`
      SELECT indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
    `);
    
    if (indexesResult.rows.length > 0) {
      sqlOutput += `\n-- ================================================================\n`;
      sqlOutput += `-- Índices\n`;
      sqlOutput += `-- ================================================================\n\n`;
      
      indexesResult.rows.forEach(r => {
        sqlOutput += `${r.indexdef};\n`;
      });
    }
    
    // Foreign keys
    const fkResult = await client.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    `);
    
    if (fkResult.rows.length > 0) {
      sqlOutput += `\n-- ================================================================\n`;
      sqlOutput += `-- Foreign Keys\n`;
      sqlOutput += `-- ================================================================\n\n`;
      
      fkResult.rows.forEach(fk => {
        sqlOutput += `ALTER TABLE "${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" `;
        sqlOutput += `FOREIGN KEY ("${fk.column_name}") `;
        sqlOutput += `REFERENCES "${fk.foreign_table_name}" ("${fk.foreign_column_name}") `;
        sqlOutput += `ON UPDATE ${fk.update_rule} ON DELETE ${fk.delete_rule};\n`;
      });
    }
    
    // Guardar archivo
    fs.writeFileSync(backupFile, sqlOutput, 'utf8');
    
    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('\n✅ Backup completado:');
    console.log(`   Archivo: ${backupFile}`);
    console.log(`   Tamaño: ${fileSizeMB} MB\n`);
    
    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createBackup();
