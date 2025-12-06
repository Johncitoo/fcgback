const { Client } = require('pg');

async function testFormEndpoint() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  const formId = '15edd526-2540-45d3-93af-abd94fdeea2e';
  const milestoneId = 'a195e5a0-d855-4cef-bafe-dbeef0c6e0d9';
  
  console.log('🔍 SIMULANDO GET /api/forms/:formId\n');
  console.log(`Form ID: ${formId}\n`);
  
  // Simular lo que hace getFormById
  
  // 1. Buscar call_id desde milestone
  const milestoneRows = await client.query(
    `SELECT call_id FROM milestones WHERE form_id = $1 LIMIT 1`,
    [formId]
  );
  
  if (milestoneRows.rows.length === 0) {
    console.log('❌ No se encontró milestone con ese form_id');
    await client.end();
    return;
  }
  
  const callId = milestoneRows.rows[0].call_id;
  console.log(`Call ID: ${callId}\n`);
  
  // 2. Buscar secciones
  const sectionsRows = await client.query(
    `SELECT id, title, "order", visible FROM form_sections WHERE call_id = $1 ORDER BY "order"`,
    [callId]
  );
  
  console.log(`Secciones encontradas: ${sectionsRows.rows.length}\n`);
  
  if (sectionsRows.rows.length > 0) {
    const sections = [];
    
    for (const section of sectionsRows.rows) {
      const fieldsRows = await client.query(
        `SELECT id, name, label, type, required, options, validation, help_text, "order", active 
         FROM form_fields 
         WHERE call_id = $1 AND section_id = $2 
         ORDER BY "order"`,
        [callId, section.id]
      );
      
      console.log(`Sección "${section.title}": ${fieldsRows.rows.length} campos`);
      
      sections.push({
        id: section.id,
        title: section.title,
        fields: fieldsRows.rows.map(f => ({
          id: f.id,
          name: f.name,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options || null,
          helpText: f.help_text,
          active: f.active,
        })),
      });
    }
    
    const response = {
      id: formId,
      name: `Formulario de convocatoria`,
      description: null,
      schema: { fields: sections },
    };
    
    console.log('\n📊 RESPUESTA QUE DEVOLVERÍA EL API:\n');
    console.log(JSON.stringify(response, null, 2));
    
    console.log('\n🔍 ESTRUCTURA:');
    console.log(`   schema.fields es un: ${Array.isArray(response.schema.fields) ? 'ARRAY ✅' : 'OBJETO ❌'}`);
    console.log(`   Total de secciones: ${response.schema.fields.length}`);
    
  } else {
    console.log('❌ No hay secciones en form_sections');
  }
  
  await client.end();
}

testFormEndpoint().catch(console.error);
