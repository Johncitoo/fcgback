const { Client } = require('pg');

async function checkAPIData() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  const appId = '64a71894-ce93-40b0-8613-70d802484d82';
  
  console.log('🔍 SIMULANDO RESPUESTA DEL API /milestones/progress/:appId\n');
  
  // Simular exactamente lo que hace el backend
  const progress = await client.query(`
    SELECT 
      mp.id AS "mp_id",
      mp.milestone_id AS "milestoneId",
      mp.status AS "status",
      mp.completed_at AS "completedAt",
      mp.created_at AS "createdAt",
      mp.updated_at AS "updatedAt",
      mp.review_status AS "reviewStatus",
      mp.review_notes AS "reviewNotes",
      mp.reviewed_by AS "reviewedBy",
      mp.reviewed_at AS "reviewedAt",
      m.name AS "milestoneName",
      m.order_index AS "orderIndex",
      m.required,
      m.who_can_fill AS "whoCanFill",
      m.status AS "milestoneStatus",
      m.form_id AS "formId"
    FROM milestone_progress mp
    INNER JOIN milestones m ON m.id = mp.milestone_id
    WHERE mp.application_id = $1
    ORDER BY m.order_index ASC
  `, [appId]);
  
  console.log('📊 RESPUESTA DEL API:\n');
  console.log(JSON.stringify({ progress: progress.rows }, null, 2));
  
  console.log('\n\n🔎 ANÁLISIS PARA EL FRONTEND:\n');
  
  progress.rows.forEach((p, i) => {
    const isInProgress = p.status === 'IN_PROGRESS';
    const isPending = p.status === 'PENDING';
    const isActive = p.milestoneStatus === 'ACTIVE';
    const isApplicant = p.whoCanFill === 'APPLICANT';
    const hasFormId = p.formId !== null;
    
    const shouldShowButton = isApplicant && (isInProgress || isPending) && isActive && hasFormId;
    
    console.log(`${i + 1}. ${p.milestoneName}`);
    console.log(`   Progress Status: ${p.status} ${isInProgress ? '✅' : isPending ? '⚠️' : '❌'}`);
    console.log(`   Milestone Status: ${p.milestoneStatus} ${isActive ? '✅' : '❌'}`);
    console.log(`   Who Can Fill: ${p.whoCanFill} ${isApplicant ? '✅' : '❌'}`);
    console.log(`   Form ID: ${p.formId ? '✅ ' + p.formId : '❌ NULL'}`);
    console.log(`   ${shouldShowButton ? '✅ DEBE MOSTRAR BOTÓN "Continuar formulario"' : '❌ NO MOSTRARÁ BOTÓN'}`);
    console.log('');
  });
  
  await client.end();
}

checkAPIData().catch(console.error);
