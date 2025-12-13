require('dotenv').config();
const { Client } = require('pg');

async function checkForms() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    console.log('🔍 Buscando convocatoria Test 2029 y sus hitos...\n');
    
    const result = await client.query(`
      SELECT 
        c.id as call_id,
        c.name as call_name,
        c.year,
        m.id as milestone_id,
        m.name as milestone_name,
        m.form_id,
        f.name as form_name,
        f.schema
      FROM calls c
      LEFT JOIN milestones m ON m.call_id = c.id
      LEFT JOIN forms f ON f.id = m.form_id
      WHERE c.name ILIKE '%test%' 
        AND c.year = 2029
        AND m.name IN ('Resultados', 'Postulación', '📝 Postulación', '🎓 Resultado')
      ORDER BY m.order_index
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No se encontró la convocatoria Test 2029 o no tiene los hitos especificados');
      return;
    }
    
    for (const row of result.rows) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Convocatoria: ${row.call_name} ${row.year}`);
      console.log(`Hito: ${row.milestone_name}`);
      console.log(`Form ID: ${row.form_id || 'SIN FORMULARIO'}`);
      console.log(`Nombre Form: ${row.form_name || 'N/A'}`);
      
      if (row.schema) {
        const schema = typeof row.schema === 'string' ? JSON.parse(row.schema) : row.schema;
        console.log(`\nSecciones en schema:`);
        if (schema.sections && Array.isArray(schema.sections)) {
          console.log(`  Total: ${schema.sections.length} secciones`);
          schema.sections.forEach((section, idx) => {
            console.log(`  ${idx + 1}. ${section.title || section.name || 'Sin título'}`);
            console.log(`     ID: ${section.id}`);
            console.log(`     Campos: ${section.fields?.length || 0}`);
          });
        } else {
          console.log('  ⚠️  Schema sin sections array');
        }
        console.log(`\nSchema completo:`);
        console.log(JSON.stringify(schema, null, 2));
      } else {
        console.log('\n⚠️  SIN SCHEMA');
      }
      console.log('');
    }
    
  } finally {
    await client.end();
  }
}

checkForms().catch(console.error);
