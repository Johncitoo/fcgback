const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function documentDatabase() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    
    let doc = '';
    
    doc += '═══════════════════════════════════════════════════════════════\n';
    doc += '        DOCUMENTACIÓN COMPLETA DE BASE DE DATOS\n';
    doc += '        Railway PostgreSQL 17.6\n';
    doc += `        Fecha: ${new Date().toLocaleString()}\n`;
    doc += '═══════════════════════════════════════════════════════════════\n\n';

    // 1. LISTAR TODAS LAS TABLAS
    const tablesResult = await client.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    doc += '╔═══════════════════════════════════════════════════════════════╗\n';
    doc += '║  1. RESUMEN DE TABLAS (${tablesResult.rows.length} tablas)\n';
    doc += '╚═══════════════════════════════════════════════════════════════╝\n\n';
    
    for (const table of tablesResult.rows) {
      const countResult = await client.query(`SELECT COUNT(*) FROM "${table.table_name}"`);
      doc += `  • ${table.table_name.padEnd(40)} | ${table.column_count} cols | ${countResult.rows[0].count} registros\n`;
    }
    doc += '\n\n';

    // 2. DETALLE DE CADA TABLA
    doc += '╔═══════════════════════════════════════════════════════════════╗\n';
    doc += '║  2. ESTRUCTURA DETALLADA DE CADA TABLA\n';
    doc += '╚═══════════════════════════════════════════════════════════════╝\n\n';
    
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      
      doc += `\n${'='.repeat(70)}\n`;
      doc += `TABLA: ${tableName.toUpperCase()}\n`;
      doc += `${'='.repeat(70)}\n\n`;
      
      // Columnas
      const columnsResult = await client.query(`
        SELECT 
          column_name,
          data_type,
          udt_name,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      doc += 'COLUMNAS:\n';
      doc += '-'.repeat(70) + '\n';
      for (const col of columnsResult.rows) {
        const type = col.data_type === 'USER-DEFINED' ? col.udt_name : col.data_type;
        const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        
        doc += `  ${col.column_name.padEnd(30)} ${(type + maxLen).padEnd(25)} ${nullable.padEnd(10)}${defaultVal}\n`;
      }
      
      // Primary Key
      const pkResult = await client.query(`
        SELECT a.attname as column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary
      `, [tableName]);
      
      if (pkResult.rows.length > 0) {
        doc += '\nPRIMARY KEY:\n';
        doc += '-'.repeat(70) + '\n';
        doc += `  ${pkResult.rows.map(r => r.column_name).join(', ')}\n`;
      }
      
      // Foreign Keys
      const fkResult = await client.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.update_rule,
          rc.delete_rule,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1
      `, [tableName]);
      
      if (fkResult.rows.length > 0) {
        doc += '\nFOREIGN KEYS:\n';
        doc += '-'.repeat(70) + '\n';
        for (const fk of fkResult.rows) {
          doc += `  ${fk.column_name} → ${fk.foreign_table_name}(${fk.foreign_column_name})\n`;
          doc += `     ON UPDATE ${fk.update_rule} | ON DELETE ${fk.delete_rule}\n`;
        }
      }
      
      // Índices
      const indexResult = await client.query(`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = $1
        AND schemaname = 'public'
        ORDER BY indexname
      `, [tableName]);
      
      if (indexResult.rows.length > 0) {
        doc += '\nÍNDICES:\n';
        doc += '-'.repeat(70) + '\n';
        for (const idx of indexResult.rows) {
          doc += `  ${idx.indexname}\n`;
        }
      }
      
      // Constraints únicos
      const uniqueResult = await client.query(`
        SELECT 
          tc.constraint_name,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1
        AND tc.constraint_type = 'UNIQUE'
      `, [tableName]);
      
      if (uniqueResult.rows.length > 0) {
        doc += '\nUNIQUE CONSTRAINTS:\n';
        doc += '-'.repeat(70) + '\n';
        for (const uniq of uniqueResult.rows) {
          doc += `  ${uniq.constraint_name}: ${uniq.column_name}\n`;
        }
      }
      
      doc += '\n';
    }

    // 3. MAPA DE RELACIONES
    doc += '\n\n╔═══════════════════════════════════════════════════════════════╗\n';
    doc += '║  3. MAPA DE RELACIONES ENTRE TABLAS\n';
    doc += '╚═══════════════════════════════════════════════════════════════╝\n\n';
    
    const allFKResult = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);
    
    const relationsMap = {};
    for (const fk of allFKResult.rows) {
      if (!relationsMap[fk.table_name]) {
        relationsMap[fk.table_name] = [];
      }
      relationsMap[fk.table_name].push({
        from: fk.column_name,
        to: `${fk.foreign_table_name}.${fk.foreign_column_name}`
      });
    }
    
    for (const [tableName, relations] of Object.entries(relationsMap)) {
      doc += `\n${tableName}:\n`;
      for (const rel of relations) {
        doc += `  └─ ${rel.from} → ${rel.to}\n`;
      }
    }

    // 4. ENUMS
    doc += '\n\n╔═══════════════════════════════════════════════════════════════╗\n';
    doc += '║  4. TIPOS ENUM PERSONALIZADOS\n';
    doc += '╚═══════════════════════════════════════════════════════════════╝\n\n';
    
    const enumsResult = await client.query(`
      SELECT 
        t.typname as enum_name,
        e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder
    `);
    
    const enumsMap = {};
    for (const row of enumsResult.rows) {
      if (!enumsMap[row.enum_name]) {
        enumsMap[row.enum_name] = [];
      }
      enumsMap[row.enum_name].push(row.enum_value);
    }
    
    for (const [enumName, values] of Object.entries(enumsMap)) {
      doc += `${enumName}:\n`;
      doc += `  ${values.join(', ')}\n\n`;
    }

    // 5. TRIGGERS
    doc += '\n╔═══════════════════════════════════════════════════════════════╗\n';
    doc += '║  5. TRIGGERS ACTIVOS\n';
    doc += '╚═══════════════════════════════════════════════════════════════╝\n\n';
    
    const triggersResult = await client.query(`
      SELECT 
        event_object_table as table_name,
        trigger_name,
        event_manipulation,
        action_timing,
        action_statement
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `);
    
    if (triggersResult.rows.length > 0) {
      for (const trigger of triggersResult.rows) {
        doc += `${trigger.table_name}.${trigger.trigger_name}:\n`;
        doc += `  ${trigger.action_timing} ${trigger.event_manipulation}\n`;
        doc += `  ${trigger.action_statement}\n\n`;
      }
    } else {
      doc += '  (No hay triggers definidos)\n\n';
    }

    // 6. RESUMEN DE DATOS
    doc += '\n╔═══════════════════════════════════════════════════════════════╗\n';
    doc += '║  6. RESUMEN DE DATOS ACTUALES\n';
    doc += '╚═══════════════════════════════════════════════════════════════╝\n\n';
    
    const statsResult = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'ADMIN') as admins,
        (SELECT COUNT(*) FROM users WHERE role = 'REVIEWER') as reviewers,
        (SELECT COUNT(*) FROM users WHERE role = 'APPLICANT') as applicants,
        (SELECT COUNT(*) FROM applicants) as applicants_profiles,
        (SELECT COUNT(*) FROM applications) as applications,
        (SELECT COUNT(*) FROM calls) as calls,
        (SELECT COUNT(*) FROM milestones) as milestones,
        (SELECT COUNT(*) FROM forms) as forms,
        (SELECT COUNT(*) FROM forms WHERE is_template = true) as templates,
        (SELECT COUNT(*) FROM form_submissions) as submissions,
        (SELECT COUNT(*) FROM institutions) as institutions,
        (SELECT COUNT(*) FROM invites) as invites,
        (SELECT COUNT(*) FROM user_sessions) as sessions,
        (SELECT COUNT(*) FROM audit_logs) as audit_logs
    `);
    
    const stats = statsResult.rows[0];
    doc += 'USUARIOS Y PERFILES:\n';
    doc += `  Total usuarios:        ${stats.total_users}\n`;
    doc += `  ├─ Admins:             ${stats.admins}\n`;
    doc += `  ├─ Reviewers:          ${stats.reviewers}\n`;
    doc += `  └─ Applicants:         ${stats.applicants}\n`;
    doc += `  Perfiles applicants:   ${stats.applicants_profiles}\n\n`;
    
    doc += 'CONVOCATORIAS Y FORMULARIOS:\n';
    doc += `  Convocatorias:         ${stats.calls}\n`;
    doc += `  Hitos:                 ${stats.milestones}\n`;
    doc += `  Formularios:           ${stats.forms}\n`;
    doc += `  Plantillas:            ${stats.templates}\n`;
    doc += `  Form submissions:      ${stats.submissions}\n\n`;
    
    doc += 'APLICACIONES:\n';
    doc += `  Total aplicaciones:    ${stats.applications}\n`;
    doc += `  Instituciones:         ${stats.institutions}\n`;
    doc += `  Invitaciones:          ${stats.invites}\n\n`;
    
    doc += 'SISTEMA:\n';
    doc += `  Sesiones:              ${stats.sessions}\n`;
    doc += `  Logs de auditoría:     ${stats.audit_logs}\n\n`;

    // Guardar archivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputFile = path.join(__dirname, `DATABASE_STRUCTURE_${timestamp}.txt`);
    fs.writeFileSync(outputFile, doc, 'utf8');
    
    console.log(doc);
    console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ DOCUMENTACIÓN GENERADA');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`\n📄 Archivo guardado: ${outputFile}\n`);
    
    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

documentDatabase();
