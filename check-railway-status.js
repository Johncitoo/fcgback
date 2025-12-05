require('dotenv').config();
const { Pool } = require('pg');

// Usar la conexión de Railway directamente
const pool = new Pool({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkRailwayDatabase() {
  try {
    console.log('🔍 Conectando a Railway...\n');

    // 1. Verificar milestone_progress
    console.log('📋 1. COLUMNAS DE milestone_progress:');
    const mpColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'milestone_progress'
      ORDER BY ordinal_position;
    `);
    
    const hasReviewColumns = {
      review_status: false,
      review_notes: false,
      reviewed_by: false,
      reviewed_at: false
    };

    mpColumns.rows.forEach(col => {
      if (col.column_name in hasReviewColumns) {
        hasReviewColumns[col.column_name] = true;
      }
      console.log(`   ${col.column_name.padEnd(30)} | ${col.data_type.padEnd(20)} | ${col.is_nullable}`);
    });

    console.log('\n   Estado de columnas de revisión:');
    Object.entries(hasReviewColumns).forEach(([col, exists]) => {
      console.log(`   ${exists ? '✅' : '❌'} ${col}`);
    });

    // 2. Verificar calls
    console.log('\n📋 2. COLUMNAS DE calls:');
    const callsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'calls'
      ORDER BY ordinal_position;
    `);

    const hasCallsColumns = {
      is_active: false,
      start_date: false,
      end_date: false,
      auto_close: false
    };

    callsColumns.rows.forEach(col => {
      if (col.column_name in hasCallsColumns) {
        hasCallsColumns[col.column_name] = true;
      }
      console.log(`   ${col.column_name.padEnd(30)} | ${col.data_type.padEnd(20)} | ${col.is_nullable}`);
    });

    console.log('\n   Estado de columnas de control:');
    Object.entries(hasCallsColumns).forEach(([col, exists]) => {
      console.log(`   ${exists ? '✅' : '❌'} ${col}`);
    });

    // 3. Verificar convocatorias
    console.log('\n📋 3. CONVOCATORIAS EXISTENTES:');
    const calls = await pool.query(`
      SELECT id, name, year, status, is_active
      FROM calls
      ORDER BY year DESC, name;
    `);

    if (calls.rows.length === 0) {
      console.log('   ⚠️  No hay convocatorias');
    } else {
      calls.rows.forEach(call => {
        console.log(`   ${call.is_active ? '🟢' : '⚪'} ${call.name} (${call.year})`);
        console.log(`      └─ ID: ${call.id}`);
        console.log(`      └─ Status: ${call.status}`);
      });
    }

    // 4. Verificar hitos
    console.log('\n📋 4. HITOS CONFIGURADOS:');
    const milestones = await pool.query(`
      SELECT m.id, m.name, m.order_index, m.status, m.who_can_fill, c.name as call_name
      FROM milestones m
      JOIN calls c ON c.id = m.call_id
      ORDER BY c.name, m.order_index;
    `);

    if (milestones.rows.length === 0) {
      console.log('   ⚠️  No hay hitos configurados');
    } else {
      let currentCall = '';
      milestones.rows.forEach(m => {
        if (currentCall !== m.call_name) {
          console.log(`\n   Convocatoria: ${m.call_name}`);
          currentCall = m.call_name;
        }
        console.log(`   ${m.order_index}. ${m.name}`);
        console.log(`      └─ Status: ${m.status} | Quien: ${m.who_can_fill}`);
      });
    }

    // 5. Verificar trigger de RUT
    console.log('\n📋 5. TRIGGER DE VALIDACIÓN DE RUT:');
    const trigger = await pool.query(`
      SELECT tgname, tgenabled
      FROM pg_trigger
      WHERE tgname = 'trg_applicants_rut_validate';
    `);

    if (trigger.rows.length === 0) {
      console.log('   ℹ️  Trigger no existe');
    } else {
      const enabled = trigger.rows[0].tgenabled === 'O';
      console.log(`   ${enabled ? '🟢' : '🔴'} ${trigger.rows[0].tgname}`);
      console.log(`      └─ Estado: ${enabled ? 'HABILITADO' : 'DESHABILITADO'}`);
    }

    // RESUMEN
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMEN DEL ESTADO ACTUAL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const needsMigration = [];
    
    if (!hasReviewColumns.review_status || !hasReviewColumns.review_notes || 
        !hasReviewColumns.reviewed_by || !hasReviewColumns.reviewed_at) {
      needsMigration.push('Columnas de revisión en milestone_progress');
    }
    
    if (!hasCallsColumns.is_active || !hasCallsColumns.start_date || 
        !hasCallsColumns.end_date || !hasCallsColumns.auto_close) {
      needsMigration.push('Columnas de control en calls');
    }

    const hasBecase2025 = calls.rows.some(c => c.name === 'Becas 2025' && c.year === 2025);
    if (!hasBecase2025) {
      needsMigration.push('Convocatoria "Becas 2025"');
    }

    if (milestones.rows.length < 5) {
      needsMigration.push('Hitos del sistema (faltan algunos)');
    }

    if (needsMigration.length === 0) {
      console.log('✅ La base de datos YA TIENE todos los cambios necesarios');
      console.log('   No se requiere migración\n');
    } else {
      console.log('⚠️  Se necesitan las siguientes migraciones:');
      needsMigration.forEach(item => {
        console.log(`   - ${item}`);
      });
      console.log('\n💡 Ejecuta: node migrate-changelog-hitos.js\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

checkRailwayDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
