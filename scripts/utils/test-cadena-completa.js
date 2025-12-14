const { Client } = require('pg');
const https = require('https');

const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';
const FORM_ID = '900c8052-f0a1-4d86-9f7e-9db0d3e43e2a';
const BACKEND_URL = 'https://fcgback-production.up.railway.app';

// Intentar leer token del archivo .token
let API_TOKEN = '';
const tokenFile = path.join(__dirname, '.token');
try {
  if (fs.existsSync(tokenFile)) {
    API_TOKEN = fs.readFileSync(tokenFile, 'utf8').trim();
    console.log('✅ Token leído desde .token\n');
  } else {
    console.log('⚠️  No se encontró archivo .token');
    console.log('   Ejecuta: node scripts/utils/get-auth-token.js\n');
  }
} catch (err) {
  console.log('⚠️  Error leyendo .token:', err.message, '\n');
}

async function testearCadenaCompleta() {
  console.log('═'.repeat(80));
  console.log('🔬 PRUEBA DE CADENA COMPLETA: DB → BACKEND → RESPUESTA');
  console.log('═'.repeat(80));
  console.log();

  // ============================================================================
  // PASO 1: CONSULTAR DIRECTAMENTE LA BASE DE DATOS
  // ============================================================================
  console.log('📊 PASO 1: CONSULTAR BASE DE DATOS DIRECTAMENTE');
  console.log('─'.repeat(80));
  
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL\n');

    const dbResult = await client.query(`
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

    if (dbResult.rows.length === 0) {
      console.log('❌ Formulario no encontrado en DB');
      await client.end();
      return;
    }

    const formInDB = dbResult.rows[0];
    const sectionsInDB = formInDB.schema?.sections || [];
    
    console.log('🗄️  DATOS EN BASE DE DATOS:');
    console.log(`   Form ID: ${formInDB.id}`);
    console.log(`   Nombre: ${formInDB.name}`);
    console.log(`   Última actualización: ${formInDB.updated_at}`);
    console.log(`   Secciones en schema: ${sectionsInDB.length}`);
    console.log();
    
    if (sectionsInDB.length > 0) {
      console.log('   Secciones encontradas:');
      sectionsInDB.forEach((section, index) => {
        console.log(`   ${index + 1}. ID: ${section.id} - "${section.title}"`);
      });
    }
    
    console.log();
    console.log('📋 Schema completo de la DB:');
    console.log(JSON.stringify(formInDB.schema, null, 2));
    console.log();

    await client.end();

    // ============================================================================
    // PASO 2: HACER REQUEST AL BACKEND (GET)
    // ============================================================================
    console.log('═'.repeat(80));
    console.log('🌐 PASO 2: REQUEST AL BACKEND (GET /forms/:id)');
    console.log('─'.repeat(80));
    
    const timestamp = Date.now();
    const url = `${BACKEND_URL}/api/forms/${FORM_ID}?_t=${timestamp}`;
    console.log(`📡 URL: ${url}`);
    console.log(`🔑 Authorization: Bearer ${API_TOKEN.substring(0, 20)}...`);
    console.log();

    // Hacer request HTTP
    const backendResponse = await new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          console.log(`📥 Status Code: ${res.statusCode}`);
          console.log(`📥 Headers:`);
          console.log(`   Cache-Control: ${res.headers['cache-control'] || 'No establecido'}`);
          console.log(`   Content-Type: ${res.headers['content-type'] || 'No establecido'}`);
          console.log();

          if (res.statusCode === 200) {
            try {
              const jsonData = JSON.parse(data);
              resolve(jsonData);
            } catch (err) {
              reject(new Error('Error parsing JSON: ' + err.message));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });

    console.log('✅ Respuesta recibida del backend\n');

    // ============================================================================
    // PASO 3: COMPARAR RESULTADOS
    // ============================================================================
    console.log('═'.repeat(80));
    console.log('🔍 PASO 3: COMPARACIÓN DE RESULTADOS');
    console.log('─'.repeat(80));
    
    const sectionsFromBackend = backendResponse.schema?.sections || backendResponse.sections || [];
    
    console.log();
    console.log('📊 RESUMEN DE COMPARACIÓN:');
    console.log(`   Secciones en DB:       ${sectionsInDB.length}`);
    console.log(`   Secciones del Backend: ${sectionsFromBackend.length}`);
    console.log(`   ¿Coinciden?            ${sectionsInDB.length === sectionsFromBackend.length ? '✅ SÍ' : '❌ NO'}`);
    console.log();

    if (sectionsInDB.length !== sectionsFromBackend.length) {
      console.log('⚠️  DISCREPANCIA DETECTADA');
      console.log();
      console.log('Secciones en DB que NO están en respuesta backend:');
      
      const backendIds = new Set(sectionsFromBackend.map(s => s.id));
      const missingSections = sectionsInDB.filter(s => !backendIds.has(s.id));
      
      if (missingSections.length > 0) {
        missingSections.forEach((section, index) => {
          console.log(`\n${index + 1}. ❌ FALTA: "${section.title}" (ID: ${section.id})`);
          console.log(`   Campos: ${section.fields?.length || 0}`);
          console.log(`   ¿Es ID temporal? ${section.id.startsWith('tmp_') ? 'SÍ ⚠️' : 'NO'}`);
        });
      }
      
      console.log();
      console.log('Secciones en Backend que NO están en DB:');
      const dbIds = new Set(sectionsInDB.map(s => s.id));
      const extraSections = sectionsFromBackend.filter(s => !dbIds.has(s.id));
      
      if (extraSections.length > 0) {
        extraSections.forEach((section, index) => {
          console.log(`${index + 1}. ➕ EXTRA: "${section.title}" (ID: ${section.id})`);
        });
      } else {
        console.log('   (Ninguna)');
      }
    } else {
      console.log('✅ Las cantidades coinciden, verificando IDs...');
      
      const dbIds = sectionsInDB.map(s => s.id).sort();
      const backendIds = sectionsFromBackend.map(s => s.id).sort();
      
      const idsMatch = JSON.stringify(dbIds) === JSON.stringify(backendIds);
      
      if (idsMatch) {
        console.log('✅ Los IDs de las secciones coinciden perfectamente');
      } else {
        console.log('⚠️  Los IDs no coinciden:');
        console.log('   IDs en DB:', dbIds);
        console.log('   IDs Backend:', backendIds);
      }
    }

    console.log();
    console.log('═'.repeat(80));
    console.log('📋 RESPUESTA COMPLETA DEL BACKEND:');
    console.log('─'.repeat(80));
    console.log(JSON.stringify(backendResponse, null, 2));
    console.log();

    // ============================================================================
    // DIAGNÓSTICO
    // ============================================================================
    console.log('═'.repeat(80));
    console.log('🩺 DIAGNÓSTICO');
    console.log('─'.repeat(80));
    console.log();

    if (sectionsInDB.length > sectionsFromBackend.length) {
      console.log('❌ PROBLEMA CONFIRMADO: Backend devuelve menos secciones que la DB');
      console.log();
      console.log('Posibles causas:');
      console.log('1. 🔍 Filtro en el backend eliminando secciones con IDs temporales');
      console.log('2. 🔍 Serialización incorrecta del campo JSONB');
      console.log('3. 🔍 Middleware interceptando y modificando la respuesta');
      console.log('4. 🔍 Caché en Railway/CDN devolviendo versión antigua');
      console.log();
      
      // Revisar si las secciones faltantes tienen IDs temporales
      const backendIds = new Set(sectionsFromBackend.map(s => s.id));
      const missing = sectionsInDB.filter(s => !backendIds.has(s.id));
      const allMissingAreTemp = missing.every(s => s.id.startsWith('tmp_'));
      
      if (allMissingAreTemp && missing.length > 0) {
        console.log('🎯 CAUSA MÁS PROBABLE:');
        console.log('   Todas las secciones faltantes tienen IDs temporales (tmp_*)');
        console.log('   → Posiblemente hay un filtro que elimina secciones temporales');
        console.log();
      }
    } else if (sectionsInDB.length < sectionsFromBackend.length) {
      console.log('⚠️  Backend devuelve MÁS secciones que la DB (raro)');
      console.log('   Posible problema de sincronización o réplica de DB');
    } else {
      console.log('✅ Backend devuelve la misma cantidad de secciones que la DB');
      console.log('   El problema podría estar en el frontend o en el cache del navegador');
    }

    console.log();
    console.log('═'.repeat(80));
    console.log('✅ Prueba completada');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error.message);
    console.error(error);
  }
}

// Ejecutar
testearCadenaCompleta().catch(console.error);
