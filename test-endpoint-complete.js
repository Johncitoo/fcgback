// Simular llamada completa al endpoint de Railway
const https = require('https');

// Necesitas obtener el token del localStorage del navegador
// Abre la consola (F12) y ejecuta: localStorage.getItem('fcg.access_token')
const token = process.argv[2] || 'PONDRE_EL_TOKEN_AQUI';

const appId = '04954eed-5b40-4a89-ab40-6f513fffd78e';

const options = {
  hostname: 'fcgback-production.up.railway.app',
  port: 443,
  path: `/api/files/list?entityType=APPLICATION&entityId=${appId}`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

console.log('\n=== TEST ENDPOINT RAILWAY ===\n');
console.log('URL:', `https://${options.hostname}${options.path}\n`);

if (token === 'PONDRE_EL_TOKEN_AQUI') {
  console.log('⚠️  NECESITAS PROPORCIONAR EL TOKEN');
  console.log('\n1. Abre DevTools (F12) en el navegador');
  console.log('2. Ve a Console');
  console.log('3. Ejecuta: localStorage.getItem("fcg.access_token")');
  console.log('4. Copia el token y ejecuta:');
  console.log('   node test-endpoint-complete.js TU_TOKEN\n');
}

const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Status Message:', res.statusMessage);
  console.log('\nHeaders:', JSON.stringify(res.headers, null, 2));

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n=== RESPONSE BODY ===\n');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.files) {
        console.log(`\n✅ SUCCESS: ${parsed.files.length} archivos encontrados`);
        parsed.files.forEach((f, i) => {
          console.log(`\n${i+1}. ${f.originalFilename}`);
          console.log(`   ID: ${f.id}`);
          console.log(`   Size: ${f.size} bytes`);
          console.log(`   Type: ${f.mimetype}`);
        });
      } else {
        console.log('\n⚠️  No property "files" in response');
      }
    } catch (e) {
      console.log(data);
      console.log('\n❌ ERROR: Invalid JSON response');
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ REQUEST ERROR:', error.message);
});

req.end();
