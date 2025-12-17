/**
 * Script para diagnosticar por qué los hitos no se bloquean después de un rechazo
 * 
 * Uso:
 * node scripts/debug-blocked-milestones.js <applicationId>
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no está definida');
  process.exit(1);
}

const applicationId = process.argv[2];

if (!applicationId) {
  console.error('❌ Uso: node scripts/debug-blocked-milestones.js <applicationId>');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos\n');

    // 1. Obtener información de la aplicación
    console.log('📋 INFORMACIÓN DE LA APLICACIÓN:');
    console.log('='.repeat(80));
    const appResult = await client.query(
      `SELECT id, status, call_id, submitted_at 
       FROM applications 
       WHERE id = $1`,
      [applicationId]
    );

    if (appResult.rows.length === 0) {
      console.error('❌ No se encontró la aplicación');
      process.exit(1);
    }

    const app = appResult.rows[0];
    console.log(`ID: ${app.id}`);
    console.log(`Status: ${app.status}`);
    console.log(`Call ID: ${app.call_id}`);
    console.log(`Submitted: ${app.submitted_at}\n`);

    // 2. Obtener todos los hitos de la convocatoria
    console.log('📌 HITOS DE LA CONVOCATORIA:');
    console.log('='.repeat(80));
    const milestonesResult = await client.query(
      `SELECT id, name, order_index, call_id, status
       FROM milestones
       WHERE call_id = $1
       ORDER BY order_index ASC`,
      [app.call_id]
    );

    console.log(`Total de hitos: ${milestonesResult.rows.length}\n`);
    milestonesResult.rows.forEach(m => {
      console.log(`  ${m.order_index}. ${m.name} (${m.id})`);
    });
    console.log('');

    // 3. Obtener el progreso de los hitos
    console.log('📊 PROGRESO DE HITOS (milestone_progress):');
    console.log('='.repeat(80));
    const progressResult = await client.query(
      `SELECT 
        mp.id AS mp_id,
        mp.status,
        mp.review_status,
        mp.completed_at,
        mp.reviewed_at,
        m.name AS milestone_name,
        m.order_index,
        m.call_id AS milestone_call_id
       FROM milestone_progress mp
       INNER JOIN milestones m ON m.id = mp.milestone_id
       WHERE mp.application_id = $1
       ORDER BY m.order_index ASC`,
      [applicationId]
    );

    console.log(`Total registros: ${progressResult.rows.length}\n`);
    
    progressResult.rows.forEach(p => {
      const emoji = 
        p.status === 'COMPLETED' ? '✅' :
        p.status === 'IN_PROGRESS' ? '🔵' :
        p.status === 'BLOCKED' ? '🚫' :
        p.status === 'PENDING' ? '⏳' : '❓';
      
      const reviewEmoji = 
        p.review_status === 'APPROVED' ? '✅' :
        p.review_status === 'REJECTED' ? '❌' : '';
      
      console.log(`  ${emoji} [${p.order_index}] ${p.milestone_name}`);
      console.log(`     Status: ${p.status} ${reviewEmoji}${p.review_status ? ` (${p.review_status})` : ''}`);
      console.log(`     milestone_call_id: ${p.milestone_call_id}`);
      console.log(`     Completed: ${p.completed_at || 'N/A'}`);
      console.log(`     Reviewed: ${p.reviewed_at || 'N/A'}`);
      console.log('');
    });

    // 4. Identificar hito rechazado
    const rejectedMilestone = progressResult.rows.find(p => p.review_status === 'REJECTED');
    
    if (rejectedMilestone) {
      console.log('❌ HITO RECHAZADO DETECTADO:');
      console.log('='.repeat(80));
      console.log(`  Nombre: ${rejectedMilestone.milestone_name}`);
      console.log(`  Order Index: ${rejectedMilestone.order_index}`);
      console.log(`  Status: ${rejectedMilestone.status}`);
      console.log(`  Review Status: ${rejectedMilestone.review_status}\n`);

      // 5. Verificar qué hitos DEBERÍAN estar bloqueados
      console.log('🔍 HITOS QUE DEBERÍAN ESTAR BLOQUEADOS:');
      console.log('='.repeat(80));
      const shouldBeBlocked = progressResult.rows.filter(
        p => p.order_index > rejectedMilestone.order_index
      );
      
      console.log(`Total: ${shouldBeBlocked.length}\n`);
      shouldBeBlocked.forEach(p => {
        const isBlocked = p.status === 'BLOCKED';
        const emoji = isBlocked ? '✅ CORRECTO' : '❌ ERROR';
        console.log(`  ${emoji} [${p.order_index}] ${p.milestone_name} - Status actual: ${p.status}`);
      });
      console.log('');

      // 6. Simular la query de bloqueo
      console.log('🧪 SIMULACIÓN DE QUERY DE BLOQUEO:');
      console.log('='.repeat(80));
      console.log('Query que se ejecutaría:');
      console.log(`
UPDATE milestone_progress mp
SET status = 'BLOCKED'
FROM milestones m
WHERE mp.milestone_id = m.id
AND mp.application_id = '${applicationId}'
AND m.call_id = '${app.call_id}'
AND m.order_index > ${rejectedMilestone.order_index}
AND mp.status IN ('PENDING', 'IN_PROGRESS')
RETURNING mp.id, m.name, m.order_index;
      `);

      // Ejecutar la query de diagnóstico
      const simulationResult = await client.query(
        `SELECT 
          mp.id AS mp_id,
          mp.status AS current_status,
          m.name AS milestone_name,
          m.order_index,
          m.call_id
         FROM milestone_progress mp
         INNER JOIN milestones m ON mp.milestone_id = m.id
         WHERE mp.application_id = $1
         AND m.call_id = $2
         AND m.order_index > $3
         AND mp.status IN ('PENDING', 'IN_PROGRESS')`,
        [applicationId, app.call_id, rejectedMilestone.order_index]
      );

      console.log(`\nResultados que coinciden con la query: ${simulationResult.rows.length}`);
      simulationResult.rows.forEach(r => {
        console.log(`  - [${r.order_index}] ${r.milestone_name} (Status: ${r.current_status})`);
      });
    } else {
      console.log('ℹ️  No hay hitos rechazados en esta aplicación');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

main();
