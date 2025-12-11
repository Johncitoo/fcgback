const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: { rejectUnauthorized: false }
});

async function debug() {
  try {
    // 1. Verificar si existe la tabla form_submissions
    console.log('\n=== 1. VERIFICAR TABLA form_submissions ===');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'form_submissions'
      );
    `);
    console.log('Tabla existe:', tableCheck.rows[0].exists);

    if (!tableCheck.rows[0].exists) {
      console.log('\n❌ ERROR: La tabla form_submissions NO EXISTE');
      console.log('Necesitas crear la tabla primero');
      return;
    }

    // 2. Ver estructura de la tabla
    console.log('\n=== 2. ESTRUCTURA DE form_submissions ===');
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'form_submissions'
      ORDER BY ordinal_position;
    `);
    console.log('Columnas:');
    structure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // 3. Buscar submissions para el milestone de Arturo
    const arturoMilestoneId = 'ea633a00-234f-462f-adb3-01a84483f466'; // Primer hito de Test 2029
    
    console.log('\n=== 3. SUBMISSIONS PARA MILESTONE DE ARTURO ===');
    console.log('Milestone ID:', arturoMilestoneId);
    
    const submissions = await pool.query(`
      SELECT * FROM form_submissions 
      WHERE milestone_id = $1
      ORDER BY created_at DESC;
    `, [arturoMilestoneId]);
    
    console.log(`Total submissions: ${submissions.rows.length}`);
    if (submissions.rows.length > 0) {
      console.log('Submissions:', JSON.stringify(submissions.rows, null, 2));
    } else {
      console.log('✅ No hay submissions previas (esto es normal en primera ejecución)');
    }

    // 4. Verificar application de Arturo
    console.log('\n=== 4. APPLICATION DE ARTURO ===');
    const arturoAppId = '04954eed-5b40-4a89-ab40-6f513fffd78e';
    const app = await pool.query(`
      SELECT a.*, ap.first_name, ap.last_name, ap.email
      FROM applications a
      JOIN applicants ap ON ap.id = a.applicant_id
      WHERE a.id = $1;
    `, [arturoAppId]);
    
    if (app.rows.length > 0) {
      console.log('✅ Application encontrada:');
      console.log(JSON.stringify(app.rows[0], null, 2));
    } else {
      console.log('❌ Application no encontrada');
    }

    // 5. Verificar milestone progress
    console.log('\n=== 5. MILESTONE PROGRESS DE ARTURO ===');
    const progress = await pool.query(`
      SELECT mp.*, m.name, m.order_index
      FROM milestone_progress mp
      JOIN milestones m ON m.id = mp.milestone_id
      WHERE mp.application_id = $1
      ORDER BY m.order_index;
    `, [arturoAppId]);
    
    console.log(`Total milestone_progress: ${progress.rows.length}`);
    progress.rows.forEach(mp => {
      console.log(`  ${mp.order_index}. ${mp.name} - Status: ${mp.status}`);
    });

    // 6. Simular el endpoint GET /form-submissions/milestone/:milestoneId
    console.log('\n=== 6. SIMULAR GET /form-submissions/milestone/:milestoneId ===');
    try {
      const result = await pool.query(`
        SELECT * FROM form_submissions
        WHERE milestone_id = $1
        ORDER BY created_at DESC;
      `, [arturoMilestoneId]);
      
      console.log('✅ Query ejecutada correctamente');
      console.log(`Resultado: ${result.rows.length} submissions`);
      console.log('Response que debería devolver:', JSON.stringify(result.rows, null, 2));
    } catch (err) {
      console.log('❌ ERROR ejecutando query:', err.message);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

debug();
