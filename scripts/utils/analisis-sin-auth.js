const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';
const FORM_ID = '900c8052-f0a1-4d86-9f7e-9db0d3e43e2a';

async function analizarSinAuth() {
  console.log('═'.repeat(80));
  console.log('🔬 ANÁLISIS SIN AUTENTICACIÓN: Solo Base de Datos');
  console.log('═'.repeat(80));
  console.log();

  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL\n');

    // Consultar el formulario
    const formResult = await client.query(`
      SELECT 
        id,
        name,
        description,
        schema,
        created_at,
        updated_at
      FROM forms
      WHERE id = $1
    `, [FORM_ID]);

    if (formResult.rows.length === 0) {
      console.log('❌ Formulario no encontrado');
      await client.end();
      return;
    }

    const form = formResult.rows[0];
    const sections = form.schema?.sections || [];
    
    console.log('═'.repeat(80));
    console.log('📊 DATOS EN BASE DE DATOS');
    console.log('═'.repeat(80));
    console.log();
    console.log(`Form ID: ${form.id}`);
    console.log(`Nombre: ${form.name}`);
    console.log(`Última actualización: ${form.updated_at}`);
    console.log();
    console.log(`✨ Secciones en BD: ${sections.length}`);
    console.log();

    if (sections.length > 0) {
      sections.forEach((section, index) => {
        const isTemp = section.id.startsWith('tmp_');
        console.log(`${index + 1}. ${isTemp ? '⚠️ ' : ''}ID: ${section.id}`);
        console.log(`   Título: "${section.title}"`);
        console.log(`   Campos: ${section.fields?.length || 0}`);
        console.log(`   ${isTemp ? '⚠️  ID TEMPORAL' : '✅ ID Permanente'}`);
        console.log();
      });
    }

    console.log('═'.repeat(80));
    console.log('🔍 ANÁLISIS DE IDs');
    console.log('═'.repeat(80));
    console.log();

    const tempSections = sections.filter(s => s.id.startsWith('tmp_'));
    const permanentSections = sections.filter(s => !s.id.startsWith('tmp_'));

    console.log(`Secciones con ID permanente: ${permanentSections.length}`);
    console.log(`Secciones con ID temporal:   ${tempSections.length}`);
    console.log();

    if (tempSections.length > 0) {
      console.log('⚠️  SECCIONES CON ID TEMPORAL:');
      tempSections.forEach((section, index) => {
        console.log(`\n${index + 1}. ${section.title}`);
        console.log(`   ID: ${section.id}`);
        console.log(`   Campos: ${section.fields?.length || 0}`);
        
        // Analizar timestamp del ID
        if (section.id.startsWith('tmp_')) {
          const timestamp = section.id.replace('tmp_', '');
          if (!isNaN(timestamp)) {
            const date = new Date(parseInt(timestamp));
            console.log(`   Creado aprox: ${date.toLocaleString('es-CL')}`);
          }
        }
      });
      console.log();
    }

    console.log('═'.repeat(80));
    console.log('📋 SCHEMA COMPLETO (JSON)');
    console.log('═'.repeat(80));
    console.log();
    console.log(JSON.stringify(form.schema, null, 2));
    console.log();

    console.log('═'.repeat(80));
    console.log('🎯 CONCLUSIÓN');
    console.log('═'.repeat(80));
    console.log();
    console.log(`La base de datos contiene ${sections.length} secciones.`);
    console.log();
    
    if (tempSections.length > 0) {
      console.log(`⚠️  ${tempSections.length} sección(es) tienen IDs temporales.`);
      console.log();
      console.log('Según tu historial, el frontend solo muestra 3 secciones.');
      console.log('Si falta la sección con ID temporal, el problema podría ser:');
      console.log();
      console.log('1. 🔴 Railway devuelve código antiguo (MÁS PROBABLE)');
      console.log('   - La BD tiene 4 secciones');
      console.log('   - Railway GET devuelve solo 3');
      console.log('   - Railway ejecuta versión vieja del código');
      console.log();
      console.log('2. 🟡 Hay un filtro que elimina IDs temporales (POCO PROBABLE)');
      console.log('   - No encontramos filtros en el código revisado');
      console.log('   - PATCH funciona correctamente');
      console.log();
      console.log('Para confirmar el diagnóstico:');
      console.log('- Verificar logs de Railway en tiempo real');
      console.log('- Buscar: [FormsController] y [FormsService]');
      console.log('- Si NO aparecen → Railway ejecuta código viejo');
    }

    console.log();
    console.log('✅ Análisis completado');
    console.log('═'.repeat(80));

    await client.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

analizarSinAuth().catch(console.error);
