const https = require('https');

const FORM_ID = '900c8052-f0a1-4d86-9f7e-9db0d3e43e2a';
const BACKEND_URL = 'https://fcgback-production.up.railway.app';

// Token de admin (puedes obtenerlo del frontend o usar el script get-auth-token.js)
const TOKEN = 'AQUI_TU_TOKEN'; // Reemplaza con tu token

console.log('🔬 TEST DIRECTO AL BACKEND (sin navegador, sin cache)');
console.log('═'.repeat(80));
console.log();

const timestamp = Date.now();
const url = `${BACKEND_URL}/api/forms/${FORM_ID}?nocache=${timestamp}`;

console.log(`📡 Request: GET ${url}`);
console.log(`🔑 Token: ${TOKEN.substring(0, 20)}...`);
console.log();

const options = {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
};

const req = https.request(url, options, (res) => {
  let data = '';
  
  console.log(`📥 Status: ${res.statusCode}`);
  console.log(`📥 Headers:`);
  console.log(`   Cache-Control: ${res.headers['cache-control'] || 'none'}`);
  console.log(`   Date: ${res.headers['date']}`);
  console.log();
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const sections = json.schema?.sections || [];
      
      console.log('═'.repeat(80));
      console.log('📊 RESULTADO:');
      console.log('═'.repeat(80));
      console.log();
      console.log(`Secciones recibidas: ${sections.length}`);
      console.log();
      
      if (sections.length > 0) {
        sections.forEach((section, index) => {
          console.log(`${index + 1}. ID: ${section.id}`);
          console.log(`   Título: "${section.title}"`);
          console.log(`   Campos: ${section.fields?.length || 0}`);
          console.log();
        });
      }
      
      console.log('═'.repeat(80));
      console.log(sections.length === 4 ? '✅ CORRECTO: 4 secciones' : `❌ ERROR: Solo ${sections.length} secciones (deberían ser 4)`);
      console.log('═'.repeat(80));
      
    } catch (err) {
      console.error('❌ Error parsing JSON:', err.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request error:', err.message);
});

req.end();
