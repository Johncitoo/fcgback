const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const arturoAppId = '04954eed-5b40-4a89-ab40-6f513fffd78e';

    console.log('\n=== VERIFICAR ARCHIVOS DE ARTURO ===\n');

    // 1. Ver la tabla files
    console.log('1. Verificando tabla files...');
    const filesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'files'
      );
    `);
    console.log('Tabla files existe:', filesCheck.rows[0].exists);

    if (!filesCheck.rows[0].exists) {
      console.log('\n❌ ERROR: La tabla files NO EXISTE');
      return;
    }

    // 2. Ver estructura de la tabla files
    console.log('\n2. Estructura de la tabla files:');
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'files'
      ORDER BY ordinal_position;
    `);
    structure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // 3. Buscar archivos de Arturo
    console.log('\n3. Archivos asociados a la aplicación de Arturo:');
    const files = await pool.query(`
      SELECT * FROM files
      WHERE entity_type = 'APPLICATION' AND entity_id = $1
      ORDER BY uploaded_at DESC;
    `, [arturoAppId]);

    console.log(`Total archivos: ${files.rows.length}`);
    if (files.rows.length > 0) {
      console.log('\n✅ Archivos encontrados:');
      files.rows.forEach((file, idx) => {
        console.log(`\n${idx + 1}. ${file.original_filename}`);
        console.log(`   ID: ${file.id}`);
        console.log(`   Tipo: ${file.mimetype}`);
        console.log(`   Tamaño: ${file.size} bytes`);
        console.log(`   Category: ${file.category || 'N/A'}`);
        console.log(`   Path: ${file.path}`);
        console.log(`   Subido: ${file.uploaded_at}`);
        console.log(`   Activo: ${file.active}`);
      });
    } else {
      console.log('❌ No se encontraron archivos para esta aplicación');
    }

    // 4. Ver respuestas del formulario
    console.log('\n4. Respuestas del formulario (form_submissions):');
    const submissions = await pool.query(`
      SELECT id, form_id, milestone_id, form_data, submitted_at, created_at
      FROM form_submissions
      WHERE application_id = $1
      ORDER BY created_at DESC;
    `, [arturoAppId]);

    console.log(`Total submissions: ${submissions.rows.length}`);
    if (submissions.rows.length > 0) {
      submissions.rows.forEach((sub, idx) => {
        console.log(`\n${idx + 1}. Submission ID: ${sub.id}`);
        console.log(`   Form ID: ${sub.form_id}`);
        console.log(`   Milestone ID: ${sub.milestone_id}`);
        console.log(`   Submitted: ${sub.submitted_at || 'No enviado'}`);
        console.log(`   Respuestas (form_data):`, JSON.stringify(sub.form_data, null, 2));
      });
    } else {
      console.log('❌ No hay submissions');
    }

    // 5. Verificar si hay referencias a archivos en las respuestas
    console.log('\n5. Analizando referencias a archivos en respuestas:');
    if (submissions.rows.length > 0) {
      const formData = submissions.rows[0].form_data;
      const fileFields = ['certificado_notas', 'foto_personal'];
      
      fileFields.forEach(field => {
        if (formData[field]) {
          console.log(`   ${field}: ${formData[field]}`);
        } else {
          console.log(`   ${field}: ❌ NO GUARDADO`);
        }
      });
    }

    // 6. Verificar configuración de storage
    console.log('\n6. Verificando si existe tabla storage_config:');
    const storageCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'storage_config'
      );
    `);
    console.log('Tabla storage_config existe:', storageCheck.rows[0].exists);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

check();
