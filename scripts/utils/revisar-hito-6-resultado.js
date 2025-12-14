const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function revisarHito6Resultado() {
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // 1. Buscar el hito "Resultado" de la convocatoria 2029
    console.log('═'.repeat(80));
    console.log('🔍 BUSCANDO HITO 6 - RESULTADO (Convocatoria 2029)');
    console.log('═'.repeat(80));
    
    const hito = await client.query(`
      SELECT 
        m.id,
        m.name,
        m.description,
        m.order_index,
        m.form_id,
        m.status,
        c.name as call_name,
        c.year
      FROM milestones m
      INNER JOIN calls c ON c.id = m.call_id
      WHERE c.year = 2029 
        AND m.name LIKE '%Resultado%'
      ORDER BY m.order_index
    `);

    if (hito.rows.length === 0) {
      console.log('❌ No se encontró el hito "Resultado"\n');
      await client.end();
      return;
    }

    const hitoResultado = hito.rows[0];
    console.log(`\n📌 Hito encontrado:`);
    console.log(`   Nombre: ${hitoResultado.name}`);
    console.log(`   Orden: ${hitoResultado.order_index}`);
    console.log(`   Estado: ${hitoResultado.status}`);
    console.log(`   Form ID: ${hitoResultado.form_id || '❌ NULL'}\n`);

    if (!hitoResultado.form_id) {
      console.log('❌ Este hito NO tiene formulario asociado\n');
      await client.end();
      return;
    }

    // 2. Consultar el formulario completo con su schema
    console.log('═'.repeat(80));
    console.log('📝 CONSULTANDO FORMULARIO ASOCIADO');
    console.log('═'.repeat(80));

    const formulario = await client.query(`
      SELECT 
        id,
        name,
        description,
        schema,
        created_at,
        updated_at
      FROM forms
      WHERE id = $1
    `, [hitoResultado.form_id]);

    if (formulario.rows.length === 0) {
      console.log('❌ No se encontró el formulario en la base de datos\n');
      await client.end();
      return;
    }

    const form = formulario.rows[0];
    console.log(`\nFormulario ID: ${form.id}`);
    console.log(`Nombre: ${form.name || '(sin nombre)'}`);
    console.log(`Descripción: ${form.description || '(sin descripción)'}`);
    console.log(`Creado: ${form.created_at}`);
    console.log(`Actualizado: ${form.updated_at}`);

    // 3. Analizar el schema en detalle
    console.log('\n' + '═'.repeat(80));
    console.log('📋 ANÁLISIS DEL SCHEMA');
    console.log('═'.repeat(80));

    if (!form.schema) {
      console.log('❌ El schema es NULL\n');
      await client.end();
      return;
    }

    console.log('\n🔍 Schema completo (JSON):');
    console.log(JSON.stringify(form.schema, null, 2));

    // 4. Contar y mostrar secciones
    console.log('\n' + '═'.repeat(80));
    console.log('📊 SECCIONES DEL FORMULARIO');
    console.log('═'.repeat(80));

    const sections = form.schema.sections || [];
    
    console.log(`\n✨ Total de secciones: ${sections.length}\n`);

    if (sections.length === 0) {
      console.log('❌ No hay secciones en el formulario\n');
    } else {
      sections.forEach((section, index) => {
        console.log(`┌─ SECCIÓN ${index + 1} ─────────────────────────────────────────`);
        console.log(`│`);
        console.log(`│ 🆔 ID: ${section.id}`);
        console.log(`│ 📝 Título: ${section.title || '(sin título)'}`);
        console.log(`│ 📄 Descripción: ${section.description || '(sin descripción)'}`);
        
        const fields = section.fields || [];
        console.log(`│ 🔢 Número de campos: ${fields.length}`);
        
        if (fields.length > 0) {
          console.log(`│`);
          console.log(`│ Campos:`);
          fields.forEach((field, fieldIndex) => {
            console.log(`│   ${fieldIndex + 1}. ${field.label || field.id} (${field.type})`);
          });
        }
        
        console.log(`└${'─'.repeat(65)}\n`);
      });
    }

    // 5. Resumen final
    console.log('═'.repeat(80));
    console.log('📈 RESUMEN');
    console.log('═'.repeat(80));
    console.log(`\nHito: ${hitoResultado.name}`);
    console.log(`Formulario ID: ${form.id}`);
    console.log(`Secciones en BD: ${sections.length}`);
    console.log(`Total de campos en todas las secciones: ${sections.reduce((sum, s) => sum + (s.fields?.length || 0), 0)}`);
    console.log('\n✅ Consulta completada\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

// Ejecutar
revisarHito6Resultado().catch(console.error);
