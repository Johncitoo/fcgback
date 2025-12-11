// Script para verificar el schema del formulario de la convocatoria activa
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

async function checkFormSchema() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Buscar convocatoria activa
    const callResult = await client.query(`
      SELECT id, name, year, status, is_active
      FROM calls 
      WHERE status = 'OPEN' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (callResult.rows.length === 0) {
      console.log('❌ No hay convocatoria con status = OPEN');
      return;
    }

    const call = callResult.rows[0];
    console.log(`📋 Convocatoria activa: ${call.name} ${call.year}`);
    console.log(`   ID: ${call.id}`);
    console.log(`   Status: ${call.status}`);
    console.log(`   is_active: ${call.is_active}\n`);

    // Buscar formulario asociado
    const formResult = await client.query(`
      SELECT id, title, description, schema, created_at
      FROM forms
      WHERE call_id = $1
      LIMIT 1
    `, [call.id]);

    if (formResult.rows.length === 0) {
      console.log('❌ No hay formulario asociado a esta convocatoria\n');
      console.log('🔧 SOLUCIÓN: Crear formulario para esta convocatoria usando SimpleFormBuilder o FormBuilderV2');
      return;
    }

    const form = formResult.rows[0];
    console.log(`📝 Formulario encontrado: ${form.title}`);
    console.log(`   ID: ${form.id}`);
    console.log(`   Creado: ${form.created_at}\n`);

    // Analizar schema
    const schema = form.schema;
    
    if (!schema || !schema.sections) {
      console.log('❌ El schema del formulario está vacío o mal formado');
      return;
    }

    console.log(`📊 Schema del formulario:`);
    console.log(`   Título: ${schema.title || 'Sin título'}`);
    console.log(`   Secciones: ${schema.sections.length}\n`);

    // Analizar campos por sección
    schema.sections.forEach((section, i) => {
      console.log(`\n📂 Sección ${i + 1}: ${section.title || section.name || 'Sin nombre'}`);
      console.log(`   Descripción: ${section.description || 'N/A'}`);
      console.log(`   Campos: ${section.fields.length}`);
      
      const requiredFields = section.fields.filter(f => f.required && f.active !== false);
      const optionalFields = section.fields.filter(f => !f.required && f.active !== false);
      const inactiveFields = section.fields.filter(f => f.active === false);
      
      console.log(`   - Obligatorios: ${requiredFields.length}`);
      console.log(`   - Opcionales: ${optionalFields.length}`);
      console.log(`   - Inactivos: ${inactiveFields.length}`);

      if (requiredFields.length > 0) {
        console.log(`\n   Campos obligatorios:`);
        requiredFields.forEach(f => {
          console.log(`   ✓ ${f.label || f.name} (${f.type})`);
          if (f.name) console.log(`      name: "${f.name}"`);
        });
      }
    });

    // Resumen
    const allFields = schema.sections.flatMap(s => s.fields);
    const allRequired = allFields.filter(f => f.required && f.active !== false);
    
    console.log(`\n\n📊 RESUMEN TOTAL:`);
    console.log(`   Total de campos: ${allFields.length}`);
    console.log(`   Campos obligatorios: ${allRequired.length}`);
    console.log(`   Campos opcionales: ${allFields.filter(f => !f.required && f.active !== false).length}`);
    console.log(`   Campos inactivos: ${allFields.filter(f => f.active === false).length}`);

    console.log(`\n\n⚠️  Para que el formulario sea válido, el usuario debe completar estos ${allRequired.length} campos obligatorios:`);
    allRequired.forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.label || f.name} (${f.type}) - name: "${f.name}"`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

checkFormSchema();
