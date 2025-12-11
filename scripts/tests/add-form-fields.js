const { Client } = require('pg');

async function addFieldsToForm() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log('📝 AGREGANDO CAMPOS AL FORMULARIO DE POSTULACIÓN\n');
  
  const callId = '96177fc7-e733-4238-b846-5ab6a1fade09';
  
  try {
    // 1. Limpiar campos y secciones existentes
    console.log('🧹 Limpiando formulario existente...');
    await client.query(`DELETE FROM form_fields WHERE call_id = $1`, [callId]);
    await client.query(`DELETE FROM form_sections WHERE call_id = $1`, [callId]);
    console.log('   ✅ Limpiado\n');
    
    // 2. Crear sección de información personal
    console.log('📋 Creando sección "Información Personal"...');
    const section1 = await client.query(`
      INSERT INTO form_sections (id, call_id, title, "order", visible)
      VALUES (gen_random_uuid(), $1, 'Información Personal', 0, true)
      RETURNING id
    `, [callId]);
    const section1Id = section1.rows[0].id;
    console.log(`   ✅ Sección creada: ${section1Id}\n`);
    
    // 3. Agregar campos a la sección
    console.log('➕ Agregando campos...\n');
    
    // Campo: Nombre completo
    await client.query(`
      INSERT INTO form_fields (
        id, call_id, section_id, name, label, type, 
        required, help_text, "order", active
      ) VALUES (
        gen_random_uuid(), $1, $2, 'nombre_completo', 'Nombre Completo', 'INPUT',
        true, 'Ingresa tu nombre completo', 0, true
      )
    `, [callId, section1Id]);
    console.log('   ✅ Campo: Nombre Completo (INPUT)');
    
    // Campo: RUT
    await client.query(`
      INSERT INTO form_fields (
        id, call_id, section_id, name, label, type, 
        required, help_text, "order", active
      ) VALUES (
        gen_random_uuid(), $1, $2, 'rut', 'RUT', 'INPUT',
        true, 'Formato: 12345678-9', 1, true
      )
    `, [callId, section1Id]);
    console.log('   ✅ Campo: RUT (INPUT)');
    
    // Campo: Fecha de nacimiento
    await client.query(`
      INSERT INTO form_fields (
        id, call_id, section_id, name, label, type, 
        required, help_text, "order", active
      ) VALUES (
        gen_random_uuid(), $1, $2, 'fecha_nacimiento', 'Fecha de Nacimiento', 'DATE',
        true, 'Selecciona tu fecha de nacimiento', 2, true
      )
    `, [callId, section1Id]);
    console.log('   ✅ Campo: Fecha de Nacimiento (DATE)');
    
    // Campo: Teléfono
    await client.query(`
      INSERT INTO form_fields (
        id, call_id, section_id, name, label, type, 
        required, help_text, "order", active
      ) VALUES (
        gen_random_uuid(), $1, $2, 'telefono', 'Teléfono', 'INPUT',
        true, 'Ingresa tu número de contacto', 3, true
      )
    `, [callId, section1Id]);
    console.log('   ✅ Campo: Teléfono (INPUT)');
    
    // 4. Crear sección de documentos
    console.log('\n📋 Creando sección "Documentos"...');
    const section2 = await client.query(`
      INSERT INTO form_sections (id, call_id, title, "order", visible)
      VALUES (gen_random_uuid(), $1, 'Documentos', 1, true)
      RETURNING id
    `, [callId]);
    const section2Id = section2.rows[0].id;
    console.log(`   ✅ Sección creada: ${section2Id}\n`);
    
    // Campo: Certificado de notas (archivo)
    await client.query(`
      INSERT INTO form_fields (
        id, call_id, section_id, name, label, type, 
        required, help_text, "order", active
      ) VALUES (
        gen_random_uuid(), $1, $2, 'certificado_notas', 'Certificado de Notas', 'FILE',
        true, 'Sube tu certificado en formato PDF', 0, true
      )
    `, [callId, section2Id]);
    console.log('   ✅ Campo: Certificado de Notas (FILE)');
    
    // Campo: Foto personal (imagen)
    await client.query(`
      INSERT INTO form_fields (
        id, call_id, section_id, name, label, type, 
        required, help_text, "order", active
      ) VALUES (
        gen_random_uuid(), $1, $2, 'foto_personal', 'Foto Personal', 'IMAGE',
        true, 'Sube una foto tipo carnet (JPG o PNG)', 1, true
      )
    `, [callId, section2Id]);
    console.log('   ✅ Campo: Foto Personal (IMAGE)');
    
    // 5. Crear sección de motivación
    console.log('\n📋 Creando sección "Motivación"...');
    const section3 = await client.query(`
      INSERT INTO form_sections (id, call_id, title, "order", visible)
      VALUES (gen_random_uuid(), $1, 'Motivación', 2, true)
      RETURNING id
    `, [callId]);
    const section3Id = section3.rows[0].id;
    console.log(`   ✅ Sección creada: ${section3Id}\n`);
    
    // Campo: Motivación (textarea)
    await client.query(`
      INSERT INTO form_fields (
        id, call_id, section_id, name, label, type, 
        required, help_text, "order", active
      ) VALUES (
        gen_random_uuid(), $1, $2, 'motivacion', '¿Por qué quieres postular?', 'TEXTAREA',
        true, 'Cuéntanos en máximo 500 palabras por qué deseas esta beca', 0, true
      )
    `, [callId, section3Id]);
    console.log('   ✅ Campo: Motivación (TEXTAREA)');
    
    console.log('\n✅ ¡FORMULARIO CREADO EXITOSAMENTE!');
    console.log('\n📊 RESUMEN:');
    console.log('   - 3 secciones creadas');
    console.log('   - 8 campos agregados');
    console.log('   - 2 campos de archivo (file + image) para probar storage');
    console.log('\n💡 Ahora recarga la página de Arturo y haz clic en "Continuar formulario"');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
  
  await client.end();
}

addFieldsToForm().catch(console.error);
