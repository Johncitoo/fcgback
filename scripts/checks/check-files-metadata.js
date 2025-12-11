const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const arturoAppId = '04954eed-5b40-4a89-ab40-6f513fffd78e';

    console.log('\n=== VERIFICAR ARCHIVOS DE ARTURO ===\n');

    // 1. Ver estructura de files_metadata
    console.log('1. Estructura de files_metadata:');
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'files_metadata'
      ORDER BY ordinal_position;
    `);
    structure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // 2. Buscar archivos de Arturo
    console.log('\n2. Archivos asociados a la aplicación de Arturo:');
    const files = await pool.query(`
      SELECT * FROM files_metadata
      WHERE "entityType" = 'APPLICATION' AND "entityId" = $1
      ORDER BY "uploadedAt" DESC;
    `, [arturoAppId]);

    console.log(`Total archivos: ${files.rows.length}`);
    if (files.rows.length > 0) {
      console.log('\n✅ Archivos encontrados:');
      files.rows.forEach((file, idx) => {
        console.log(`\n${idx + 1}. ${file.originalFilename}`);
        console.log(`   ID: ${file.id}`);
        console.log(`   Tipo: ${file.mimetype}`);
        console.log(`   Tamaño: ${file.size} bytes`);
        console.log(`   Category: ${file.category || 'N/A'}`);
        console.log(`   Path: ${file.path}`);
        console.log(`   Subido: ${file.uploadedAt}`);
        console.log(`   Activo: ${file.active}`);
      });
    } else {
      console.log('❌ No se encontraron archivos para esta aplicación');
    }

    // 3. Ver respuestas del formulario
    console.log('\n3. Respuestas del formulario (form_submissions):');
    const submissions = await pool.query(`
      SELECT id, form_id, milestone_id, form_data, submitted_at, created_at
      FROM form_submissions
      WHERE application_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `, [arturoAppId]);

    console.log(`Total submissions: ${submissions.rows.length}`);
    if (submissions.rows.length > 0) {
      const sub = submissions.rows[0];
      console.log(`\nSubmission ID: ${sub.id}`);
      console.log(`Form ID: ${sub.form_id}`);
      console.log(`Milestone ID: ${sub.milestone_id}`);
      console.log(`Submitted: ${sub.submitted_at || 'No enviado'}`);
      console.log(`\nRespuestas (form_data):`);
      console.log(JSON.stringify(sub.form_data, null, 2));
      
      // 4. Verificar campos de archivo específicamente
      console.log('\n4. Analizando campos de archivo:');
      const fileFields = ['certificado_notas', 'foto_personal'];
      
      fileFields.forEach(field => {
        if (sub.form_data[field]) {
          console.log(`   ✅ ${field}: ${sub.form_data[field]}`);
        } else {
          console.log(`   ❌ ${field}: NO GUARDADO`);
        }
      });
    } else {
      console.log('❌ No hay submissions');
    }

    // 5. Buscar TODOS los archivos (sin filtro de entityId)
    console.log('\n5. Todos los archivos en files_metadata:');
    const allFiles = await pool.query(`
      SELECT id, "originalFilename", "entityType", "entityId", category, "uploadedAt"
      FROM files_metadata
      ORDER BY "uploadedAt" DESC
      LIMIT 10;
    `);
    
    console.log(`Total archivos (últimos 10): ${allFiles.rows.length}`);
    if (allFiles.rows.length > 0) {
      allFiles.rows.forEach(file => {
        console.log(`  - ${file.originalFilename} (${file.entityType}: ${file.entityId?.substring(0, 8)}...)`);
      });
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

check();
