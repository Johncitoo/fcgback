require('dotenv').config();
const axios = require('axios');

async function diagnoseConfiguration() {
  console.log('\n🔍 DIAGNÓSTICO DE CONFIGURACIÓN\n');
  
  // 1. Variables locales
  console.log('1️⃣  Variables de entorno locales:');
  console.log(`   STORAGE_SERVICE_URL: ${process.env.STORAGE_SERVICE_URL || '❌ NO CONFIGURADA'}`);
  console.log(`   STORAGE_SERVICE_API_KEY: ${process.env.STORAGE_SERVICE_API_KEY ? '✅ Configurada' : '❌ NO CONFIGURADA'}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Configurada' : '❌ NO CONFIGURADA'}`);
  
  // 2. Health check del storage
  console.log('\n2️⃣  Health check del storage service:');
  try {
    const storageHealth = await axios.get('https://fcgstorage-production.up.railway.app/health');
    console.log(`   ✅ Storage service respondiendo: ${storageHealth.data.status}`);
  } catch (error) {
    console.log(`   ❌ Storage service no responde: ${error.message}`);
  }
  
  // 3. Health check del backend
  console.log('\n3️⃣  Health check del backend principal:');
  try {
    const backendHealth = await axios.get('https://fcgback-production.up.railway.app/api/health');
    console.log(`   ✅ Backend respondiendo: ${backendHealth.data.status}`);
  } catch (error) {
    console.log(`   ❌ Backend no responde: ${error.message}`);
  }
  
  // 4. Test del endpoint de storage directamente
  console.log('\n4️⃣  Test directo del storage service:');
  const apiKey = process.env.STORAGE_SERVICE_API_KEY;
  if (!apiKey) {
    console.log('   ⚠️  No se puede probar: STORAGE_SERVICE_API_KEY no está configurada localmente');
    console.log('   ℹ️  Ve a Railway → fcgback → Variables y copia el valor de STORAGE_SERVICE_API_KEY');
  } else {
    try {
      const FormData = require('form-data');
      const fs = require('fs');
      const form = new FormData();
      form.append('file', fs.createReadStream('../test-file.txt'));
      form.append('category', 'DOCUMENT');
      form.append('uploadedBy', '476d428e-a70a-4f88-b11a-6f59dc1a6f12');
      
      const response = await axios.post(
        'https://fcgstorage-production.up.railway.app/storage/upload',
        form,
        {
          headers: {
            ...form.getHeaders(),
            'X-API-Key': apiKey
          }
        }
      );
      console.log(`   ✅ Upload directo al storage: SUCCESS`);
      console.log(`   File ID: ${response.data.id}`);
    } catch (error) {
      console.log(`   ❌ Upload directo falló: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
  }
  
  // 5. Recomendaciones
  console.log('\n📋 RECOMENDACIONES:\n');
  if (!process.env.STORAGE_SERVICE_URL || !process.env.STORAGE_SERVICE_API_KEY) {
    console.log('   ⚠️  Falta configuración local (esto es normal si no tienes .env)');
    console.log('   ✅ VERIFICA en Railway Dashboard:');
    console.log('      1. Ve a: railway.app → fcgback → Variables');
    console.log('      2. Debe tener: STORAGE_SERVICE_URL=https://fcgstorage-production.up.railway.app');
    console.log('      3. Debe tener: STORAGE_SERVICE_API_KEY=<mismo-valor-que-en-fcgstorage>');
    console.log('      4. Si falta alguna, agrégala y redeploy automático se activará');
  }
  
  console.log('\n   🔍 Para ver los logs del error 500:');
  console.log('      1. Ve a: railway.app → fcgback → Logs');
  console.log('      2. Busca líneas con [StorageClientService]');
  console.log('      3. El mensaje de error te dirá exactamente qué falta\n');
}

diagnoseConfiguration();
