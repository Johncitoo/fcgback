const { Client } = require('pg');

// URL de conexión directa a Railway (visible en tus scripts)
const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function consultarHitos2029() {
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // 1. CONVOCATORIA 2029
    console.log('═'.repeat(80));
    console.log('📋 CONVOCATORIA 2029');
    console.log('═'.repeat(80));
    
    const call = await client.query(`
      SELECT * FROM calls WHERE year = 2029
    `);

    if (call.rows.length === 0) {
      console.log('❌ No se encontró la convocatoria 2029');
      await client.end();
      return;
    }

    const convocatoria = call.rows[0];
    console.log(`ID: ${convocatoria.id}`);
    console.log(`Nombre: ${convocatoria.name}`);
    console.log(`Año: ${convocatoria.year}`);
    console.log(`Estado: ${convocatoria.status}`);
    console.log(`Activa: ${convocatoria.is_active ? '✅ SÍ' : '❌ NO'}`);
    console.log(`Fecha inicio: ${convocatoria.start_date}`);
    console.log(`Fecha fin: ${convocatoria.end_date}`);
    console.log();

    // 2. HITOS (MILESTONES) DE LA CONVOCATORIA 2029
    console.log('═'.repeat(80));
    console.log('🎯 HITOS DE LA CONVOCATORIA 2029');
    console.log('═'.repeat(80));
    
    const milestones = await client.query(`
      SELECT 
        m.id,
        m.name,
        m.description,
        m.order_index,
        m.required,
        m.who_can_fill,
        m.form_id,
        m.status,
        m.due_date,
        m.created_at,
        f.name as form_name
      FROM milestones m
      LEFT JOIN forms f ON f.id = m.form_id
      WHERE m.call_id = $1
      ORDER BY m.order_index ASC
    `, [convocatoria.id]);

    if (milestones.rows.length === 0) {
      console.log('❌ No hay hitos creados para esta convocatoria\n');
    } else {
      console.log(`Total de hitos: ${milestones.rows.length}\n`);
      
      milestones.rows.forEach((hito, index) => {
        console.log(`\n┌─ HITO ${index + 1} (Orden: ${hito.order_index}) ─────────────────────────`);
        console.log(`│`);
        console.log(`│ 📌 ID: ${hito.id}`);
        console.log(`│ 📝 Nombre: ${hito.name}`);
        console.log(`│ 📄 Descripción: ${hito.description || '(sin descripción)'}`);
        console.log(`│ ✓  Requerido: ${hito.required ? 'SÍ' : 'NO'}`);
        console.log(`│ 👤 Quién llena: ${hito.who_can_fill}`);
        console.log(`│ 📋 Formulario ID: ${hito.form_id || '❌ NULL'}`);
        console.log(`│ 📋 Nombre formulario: ${hito.form_name || '❌ Sin formulario'}`);
        console.log(`│ 🔄 Estado: ${hito.status}`);
        console.log(`│ 📅 Fecha límite: ${hito.due_date || '(sin fecha)'}`);
        console.log(`│ 🕐 Creado: ${hito.created_at}`);
        console.log(`└${'─'.repeat(75)}`);
      });
    }

    // 3. PROGRESO DE HITOS (milestone_progress)
    console.log('\n\n═'.repeat(80));
    console.log('📊 PROGRESO DE HITOS (milestone_progress)');
    console.log('═'.repeat(80));

    const progress = await client.query(`
      SELECT 
        mp.id,
        mp.application_id,
        mp.milestone_id,
        mp.status,
        mp.completed_at,
        mp.review_status,
        m.name as milestone_name,
        m.order_index
      FROM milestone_progress mp
      INNER JOIN milestones m ON m.id = mp.milestone_id
      WHERE m.call_id = $1
      ORDER BY m.order_index, mp.application_id
      LIMIT 20
    `, [convocatoria.id]);

    if (progress.rows.length === 0) {
      console.log('❌ No hay progreso registrado aún\n');
    } else {
      console.log(`Registros de progreso (primeros 20): ${progress.rows.length}\n`);
      
      progress.rows.forEach((prog, index) => {
        console.log(`\n${index + 1}. ${prog.milestone_name} (orden: ${prog.order_index})`);
        console.log(`   Application ID: ${prog.application_id}`);
        console.log(`   Estado: ${prog.status}`);
        console.log(`   Completado: ${prog.completed_at || 'No'}`);
        console.log(`   Review: ${prog.review_status || 'Sin revisar'}`);
      });
    }

    // 4. FORMULARIOS ASOCIADOS
    console.log('\n\n═'.repeat(80));
    console.log('📝 FORMULARIOS ASOCIADOS A LOS HITOS');
    console.log('═'.repeat(80));

    const forms = await client.query(`
      SELECT DISTINCT 
        f.id,
        f.name,
        f.description,
        jsonb_array_length(f.schema->'fields') as num_fields,
        f.created_at
      FROM forms f
      INNER JOIN milestones m ON m.form_id = f.id
      WHERE m.call_id = $1
      ORDER BY f.created_at
    `, [convocatoria.id]);

    if (forms.rows.length === 0) {
      console.log('❌ No hay formularios asociados a los hitos\n');
    } else {
      console.log(`Total de formularios únicos: ${forms.rows.length}\n`);
      
      forms.rows.forEach((form, index) => {
        console.log(`\n${index + 1}. ${form.name || '(sin nombre)'}`);
        console.log(`   ID: ${form.id}`);
        console.log(`   Descripción: ${form.description || '(sin descripción)'}`);
        console.log(`   Número de campos: ${form.num_fields || 0}`);
        console.log(`   Creado: ${form.created_at}`);
      });
    }

    console.log('\n\n✅ Consulta completada');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

// Ejecutar
consultarHitos2029().catch(console.error);
