const https = require('https');

const BACKEND_URL = 'https://fcgback-production.up.railway.app';

async function getAuthToken() {
  console.log('🔐 Obteniendo token de autenticación (staff login)...\n');

  const credentials = {
    email: 'admin@fcg.local',
    password: 'admin123'
  };

  const postData = JSON.stringify(credentials);

  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(`${BACKEND_URL}/api/auth/login-staff`, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`📡 Status: ${res.statusCode}\n`);

        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const response = JSON.parse(data);
            console.log('✅ Login exitoso\n');
            console.log('📋 Respuesta completa:');
            console.log(JSON.stringify(response, null, 2));
            console.log('\n' + '═'.repeat(80));
            console.log('🔑 TOKEN DE ACCESO:');
            console.log('═'.repeat(80));
            console.log(response.accessToken || response.access_token || 'No encontrado');
            console.log('═'.repeat(80));
            console.log();
            
            resolve(response.accessToken || response.access_token);
          } catch (err) {
            reject(new Error('Error parsing JSON: ' + err.message));
          }
        } else {
          console.error('❌ Error en login:', data);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Error de red:', err.message);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Ejecutar y guardar token
getAuthToken()
  .then(token => {
    if (token) {
      const fs = require('fs');
      const tokenFile = __dirname + '/.token';
      fs.writeFileSync(tokenFile, token);
      console.log(`\n💾 Token guardado en: ${tokenFile}`);
      console.log('\n✅ Ahora puedes ejecutar test-cadena-completa.js\n');
    }
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
