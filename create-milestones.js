const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function createMilestones() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL');
    
    // Obtener la convocatoria más reciente
    const callResult = await client.query(
      'SELECT id, name, year FROM calls ORDER BY created_at DESC LIMIT 1'
    );
    
    if (callResult.rows.length === 0) {
      console.log('❌ No hay convocatorias en la base de datos');
      return;
    }
    
    const callId = callResult.rows[0].id;
    console.log(`📋 Usando convocatoria: ${callResult.rows[0].name} ${callResult.rows[0].year}`);
    console.log(`   ID: ${callId}`);
    
    // Crear formularios
    const form1 = await client.query(
      `INSERT INTO forms (name, description) VALUES ($1, $2) RETURNING id`,
      ['Formulario de Postulación', 'Información personal y académica']
    );
    
    const form2 = await client.query(
      `INSERT INTO forms (name, description) VALUES ($1, $2) RETURNING id`,
      ['Documentación', 'Upload de documentos requeridos']
    );
    
    const form3 = await client.query(
      `INSERT INTO forms (name, description) VALUES ($1, $2) RETURNING id`,
      ['Entrevista', 'Registro de entrevista personal']
    );
    
    console.log('📄 Formularios creados');
    
    // Crear hitos
    const milestones = [
      { form_id: form1.rows[0].id, name: '📝 Postulación', description: 'Completa tu postulación inicial', order: 1, required: true },
      { form_id: form2.rows[0].id, name: '📄 Documentos', description: 'Sube los documentos requeridos', order: 2, required: true },
      { form_id: null, name: '✅ Verificación', description: 'Revisión interna', order: 3, required: true },
      { form_id: form3.rows[0].id, name: '💬 Entrevista', description: 'Entrevista personal', order: 4, required: true },
      { form_id: null, name: '⭐ Evaluación', description: 'Evaluación final del comité', order: 5, required: true },
      { form_id: null, name: '🎓 Resultado', description: 'Notificación de resultado', order: 6, required: false }
    ];
    
    for (const milestone of milestones) {
      await client.query(
        `INSERT INTO milestones (call_id, form_id, name, description, order_index, required, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [callId, milestone.form_id, milestone.name, milestone.description, milestone.order, milestone.required, 'ACTIVE']
      );
      console.log(`  ✓ ${milestone.name}`);
    }
    
    console.log('');
    console.log('🎉 ¡6 hitos creados exitosamente!');
    console.log('');
    
    // Verificar
    const result = await client.query(`
      SELECT m.name, m.order_index, m.required, f.name as formulario
      FROM milestones m
      LEFT JOIN forms f ON m.form_id = f.id
      WHERE m.call_id = $1
      ORDER BY m.order_index
    `, [callId]);
    
    console.log('📊 Hitos creados:');
    console.table(result.rows);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createMilestones();
