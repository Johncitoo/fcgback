/**
 * Script para sincronizar milestone_progress con postulaciones existentes
 * 
 * PROBLEMA: Si se crea un hito nuevo después de que ya existen postulantes,
 * esos postulantes no tienen registros en milestone_progress para el nuevo hito.
 * 
 * SOLUCIÓN: Este script crea los registros faltantes de milestone_progress
 * para todas las postulaciones existentes.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function syncMilestoneProgress() {
  try {
    console.log('🔄 Sincronizando milestone_progress con postulaciones existentes...\n');

    // Obtener todas las convocatorias
    const calls = await pool.query(`
      SELECT id, name, year 
      FROM calls 
      ORDER BY year DESC, name
    `);

    if (calls.rows.length === 0) {
      console.log('⚠️  No hay convocatorias en el sistema\n');
      return;
    }

    let totalCreated = 0;

    for (const call of calls.rows) {
      console.log(`📢 Procesando: ${call.name} (${call.year})`);
      console.log(`   ID: ${call.id}\n`);

      // Para cada convocatoria, crear los milestone_progress faltantes
      const result = await pool.query(
        `INSERT INTO milestone_progress (application_id, milestone_id, status, created_at, updated_at)
         SELECT 
           a.id AS application_id,
           m.id AS milestone_id,
           'PENDING' AS status,
           NOW() AS created_at,
           NOW() AS updated_at
         FROM applications a
         CROSS JOIN milestones m
         WHERE a.call_id = $1
         AND m.call_id = $1
         AND NOT EXISTS (
           SELECT 1 
           FROM milestone_progress mp 
           WHERE mp.application_id = a.id 
           AND mp.milestone_id = m.id
         )
         RETURNING *`,
        [call.id]
      );

      if (result.rows.length > 0) {
        console.log(`   ✅ Creados ${result.rows.length} registros de milestone_progress`);
        totalCreated += result.rows.length;
      } else {
        console.log(`   ℹ️  No se necesitaron crear registros (ya están sincronizados)`);
      }
      console.log('');
    }

    // Resumen
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMEN DE SINCRONIZACIÓN\n');

    // Estadísticas por convocatoria
    const stats = await pool.query(`
      SELECT 
        c.name AS call_name,
        c.year,
        COUNT(DISTINCT a.id) AS total_applications,
        COUNT(DISTINCT m.id) AS total_milestones,
        COUNT(mp.id) AS total_progress_records,
        COUNT(DISTINCT a.id) * COUNT(DISTINCT m.id) AS expected_records
      FROM calls c
      LEFT JOIN applications a ON a.call_id = c.id
      LEFT JOIN milestones m ON m.call_id = c.id
      LEFT JOIN milestone_progress mp ON mp.application_id = a.id AND mp.milestone_id = m.id
      GROUP BY c.id, c.name, c.year
      ORDER BY c.year DESC, c.name
    `);

    stats.rows.forEach(stat => {
      console.log(`📢 ${stat.call_name} (${stat.year})`);
      console.log(`   Postulaciones: ${stat.total_applications}`);
      console.log(`   Hitos: ${stat.total_milestones}`);
      console.log(`   Registros esperados: ${stat.expected_records}`);
      console.log(`   Registros actuales: ${stat.total_progress_records}`);
      
      if (stat.total_progress_records === stat.expected_records) {
        console.log(`   ✅ 100% sincronizado`);
      } else {
        console.log(`   ⚠️  Faltantes: ${stat.expected_records - stat.total_progress_records}`);
      }
      console.log('');
    });

    console.log(`✅ Total de registros creados en esta ejecución: ${totalCreated}\n`);

    if (totalCreated > 0) {
      console.log('🎉 ¡Sincronización completada exitosamente!');
      console.log('   Los postulantes antiguos ahora verán los hitos nuevos en el frontend\n');
    } else {
      console.log('✅ Todo estaba ya sincronizado, no se requirieron cambios\n');
    }

  } catch (error) {
    console.error('❌ Error en sincronización:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar
console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║   SINCRONIZACIÓN DE MILESTONE_PROGRESS               ║');
console.log('║   Crear registros faltantes para postulantes         ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

syncMilestoneProgress()
  .then(() => {
    console.log('✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script finalizado con errores');
    process.exit(1);
  });
