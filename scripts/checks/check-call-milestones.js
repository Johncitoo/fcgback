// Script para verificar milestones y formularios de la convocatoria activa
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

async function checkCallForm() {
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
    console.log(`   ID: ${call.id}\n`);

    // Buscar milestones de esta convocatoria
    const milestonesResult = await client.query(`
      SELECT 
        m.id,
        m.name,
        m.description,
        m.order_index,
        m.form_id,
        f.name as form_name,
        f.schema
      FROM milestones m
      LEFT JOIN forms f ON f.id = m.form_id
      WHERE m.call_id = $1
      ORDER BY m.order_index ASC
    `, [call.id]);

    console.log(`🎯 Milestones encontrados: ${milestonesResult.rows.length}\n`);

    if (milestonesResult.rows.length === 0) {
      console.log('❌ Esta convocatoria NO tiene milestones configurados\n');
      console.log('🔧 SOLUCIÓN:');
      console.log('1. Crear milestones para esta convocatoria en /admin/milestones');
      console.log('2. Asociar un formulario a al menos el primer milestone');
      return;
    }

    milestonesResult.rows.forEach((m, i) => {
      console.log(`${i + 1}. ${m.name}`);
      console.log(`   Order: ${m.order_index}`);
      console.log(`   Form ID: ${m.form_id || '❌ SIN FORMULARIO'}`);
      if (m.form_id && m.form_name) {
        console.log(`   Form Name: ${m.form_name}`);
        if (m.schema && m.schema.sections) {
          const fields = m.schema.sections.flatMap(s => s.fields || []);
          const required = fields.filter(f => f.required && f.active !== false);
          console.log(`   Campos: ${fields.length} (${required.length} obligatorios)`);
        }
      }
      console.log('');
    });

    // Verificar si hay al menos un milestone con formulario
    const withForm = milestonesResult.rows.filter(m => m.form_id);
    
    if (withForm.length === 0) {
      console.log('\n⚠️  PROBLEMA: Ningún milestone tiene formulario asociado');
      console.log('🔧 SOLUCIÓN: Asociar un formulario al primer milestone');
    } else {
      console.log(`\n✅ ${withForm.length} milestone(s) tienen formulario asociado`);
      
      // Verificar el primer milestone (el que se usa para postulación inicial)
      const firstWithForm = milestonesResult.rows.find(m => m.form_id);
      if (firstWithForm && firstWithForm.schema) {
        console.log(`\n📝 Formulario de postulación inicial:`);
        console.log(`   Milestone: ${firstWithForm.name}`);
        console.log(`   Form: ${firstWithForm.form_name}`);
        
        const schema = firstWithForm.schema;
        if (schema.sections) {
          console.log(`   Secciones: ${schema.sections.length}`);
          
          const allFields = schema.sections.flatMap(s => s.fields || []);
          const requiredFields = allFields.filter(f => f.required && f.active !== false);
          
          console.log(`   Campos totales: ${allFields.length}`);
          console.log(`   Campos obligatorios: ${requiredFields.length}`);
          
          if (requiredFields.length > 0) {
            console.log(`\n   📋 Campos obligatorios que el usuario debe completar:`);
            requiredFields.forEach((f, i) => {
              console.log(`      ${i + 1}. ${f.label || f.name} (${f.type})`);
              console.log(`         name: "${f.name}"`);
            });
          }
        } else {
          console.log('   ⚠️  El schema no tiene secciones');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

checkCallForm();
