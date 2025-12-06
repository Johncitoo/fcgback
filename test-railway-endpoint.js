// Test endpoint desde Node.js
const https = require('https');

const token = 'TU_TOKEN_AQUI'; // Cambia esto por el token real del localStorage

const options = {
  hostname: 'fcgback-production.up.railway.app',
  port: 443,
  path: '/api/files/list?entityType=APPLICATION&entityId=04954eed-5b40-4a89-ab40-6f513fffd78e',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

console.log('\n=== TESTING RAILWAY ENDPOINT ===\n');
console.log('URL:', `https://${options.hostname}${options.path}`);
console.log('\nSi ves error 401, copia el token del localStorage y ejecútalo con:');
console.log('node test-railway-endpoint.js TU_TOKEN\n');

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\nResponse Body:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.files) {
        console.log(`\n✅ Total archivos: ${parsed.files.length}`);
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ ERROR:', error.message);
});

req.end();
