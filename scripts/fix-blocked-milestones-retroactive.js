/**
 * Script para FORZAR el bloqueo de hitos subsecuentes cuando ya hay un hito rechazado
 * Esto es útil para arreglar aplicaciones que fueron rechazadas antes de implementar
 * la lógica de bloqueo en cascada
 * 
 * Uso:
 * node scripts/fix-blocked-milestones-retroactive.js
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no está definida');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos\n');

    // 1. Encontrar todas las aplicaciones con hitos rechazados pero sin status NOT_SELECTED
    console.log('🔍 Buscando aplicaciones con hitos rechazados que necesitan corrección...\n');
    
    const needsFixResult = await client.query(`
      SELECT DISTINCT
        a.id AS application_id,
        a.status AS current_status,
        a.call_id,
        a.updated_at,
        mp.id AS rejected_progress_id,
        m.name AS rejected_milestone_name,
        m.order_index AS rejected_order_index
      FROM applications a
      INNER JOIN milestone_progress mp ON mp.application_id = a.id
      INNER JOIN milestones m ON m.id = mp.milestone_id
      WHERE mp.review_status = 'REJECTED'
      AND a.status != 'NOT_SELECTED'
      ORDER BY a.updated_at DESC
    `);

    if (needsFixResult.rows.length === 0) {
      console.log('✅ No hay aplicaciones que necesiten corrección');
      return;
    }

    console.log(`📋 Encontradas ${needsFixResult.rows.length} aplicaciones que necesitan corrección:\n`);
    console.log('='.repeat(100));
    
    needsFixResult.rows.forEach((app, idx) => {
      console.log(`\n${idx + 1}. Application ID: ${app.application_id}`);
      console.log(`   Status actual: ${app.current_status} (debería ser NOT_SELECTED)`);
      console.log(`   Hito rechazado: ${app.rejected_milestone_name} (orderIndex: ${app.rejected_order_index})`);
    });

    console.log('\n' + '='.repeat(100));
    console.log('\n⚠️  ¿APLICAR CORRECCIONES? (Esto actualizará la base de datos)');
    console.log('   - Cambiará status de applications a NOT_SELECTED');
    console.log('   - Bloqueará todos los hitos subsecuentes');
    console.log('   - Creará entradas en application_status_history\n');

    // En producción, normalmente pedirías confirmación
    // Por ahora, lo vamos a hacer automático para testing
    console.log('🔧 Aplicando correcciones...\n');

    let fixedCount = 0;

    for (const app of needsFixResult.rows) {
      console.log(`\n📌 Procesando aplicación ${app.application_id}...`);
      
      // 1. Actualizar status de application
      await client.query(
        `UPDATE applications 
         SET status = 'NOT_SELECTED', updated_at = NOW()
         WHERE id = $1`,
        [app.application_id]
      );
      console.log(`   ✅ Status actualizado a NOT_SELECTED`);

      // 2. Bloquear hitos subsecuentes
      const blockedResult = await client.query(
        `UPDATE milestone_progress mp
         SET status = 'BLOCKED'
         FROM milestones m
         WHERE mp.milestone_id = m.id
         AND mp.application_id = $1
         AND m.call_id = $2
         AND m.order_index > $3
         AND mp.status IN ('PENDING', 'IN_PROGRESS')
         RETURNING mp.id, m.name, m.order_index`,
        [app.application_id, app.call_id, app.rejected_order_index]
      );

      console.log(`   ✅ Bloqueados ${blockedResult.rows.length} hitos:`);
      blockedResult.rows.forEach(blocked => {
        console.log(`      - [${blocked.order_index}] ${blocked.name}`);
      });

      // 3. Crear entrada en historial (opcional - puede fallar si FK es required)
      try {
        await client.query(
          `INSERT INTO application_status_history 
           (application_id, from_status, to_status, reason, created_at)
           VALUES ($1, $2, 'NOT_SELECTED', $3, NOW())`,
          [
            app.application_id,
            app.current_status,
            `[CORRECCIÓN RETROACTIVA] Rechazado en hito: ${app.rejected_milestone_name}`
          ]
        );
        console.log(`   ✅ Registrado en historial`);
      } catch (histErr) {
        console.log(`   ⚠️  No se pudo crear historial (campo actor_user_id es obligatorio)`);
      }

      fixedCount++;
    }

    console.log('\n' + '='.repeat(100));
    console.log(`\n✅ Proceso completado. ${fixedCount} aplicaciones corregidas.`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

main();
