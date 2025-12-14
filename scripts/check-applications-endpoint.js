/**
 * Script para verificar qué devuelve el endpoint de applications
 */

const https = require('https');

async function checkApplicationsEndpoint() {
  console.log('\n🔍 Verificando endpoint de applications...\n');
  
  // Primero hacer login como revisor
  const loginData = JSON.stringify({
    email: 'reviewer@fcg.local',
    password: 'Reviewer123!'
  });

  const loginOptions = {
    hostname: 'fcgback-production.up.railway.app',
    port: 443,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  };

  return new Promise((resolve, reject) => {
    const loginReq = https.request(loginOptions, (loginRes) => {
      let loginBody = '';
      
      loginRes.on('data', chunk => {
        loginBody += chunk;
      });

      loginRes.on('end', () => {
        if (loginRes.statusCode !== 200 && loginRes.statusCode !== 201) {
          console.error('❌ Error en login:', loginRes.statusCode);
          console.error(loginBody);
          reject(new Error('Login failed'));
          return;
        }

        const loginResult = JSON.parse(loginBody);
        const token = loginResult.accessToken;
        console.log('✅ Login exitoso\n');

        // Ahora consultar applications
        const appsOptions = {
          hostname: 'fcgback-production.up.railway.app',
          port: 443,
          path: '/api/applications?status=SUBMITTED,IN_REVIEW',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        };

        const appsReq = https.request(appsOptions, (appsRes) => {
          let appsBody = '';
          
          appsRes.on('data', chunk => {
            appsBody += chunk;
          });

          appsRes.on('end', () => {
            console.log('═══════════════════════════════════════════════════════════════════════');
            console.log('📋 ENDPOINT: GET /api/applications?status=SUBMITTED,IN_REVIEW\n');
            console.log(`Status Code: ${appsRes.statusCode}\n`);
            console.log('Response Body:');
            console.log('───────────────────────────────────────────────────────────────────────');
            
            try {
              const parsed = JSON.parse(appsBody);
              console.log(JSON.stringify(parsed, null, 2));
              console.log('───────────────────────────────────────────────────────────────────────');
              console.log(`\n📊 Tipo de respuesta: ${Array.isArray(parsed) ? 'Array' : typeof parsed}`);
              if (Array.isArray(parsed)) {
                console.log(`   Cantidad de items: ${parsed.length}`);
              } else {
                console.log(`   Estructura: ${Object.keys(parsed).join(', ')}`);
              }
              console.log('\n═══════════════════════════════════════════════════════════════════════');
            } catch (e) {
              console.log(appsBody);
              console.log('───────────────────────────────────────────────────────────────────────');
              console.log('\n⚠️  No es JSON válido');
              console.log('═══════════════════════════════════════════════════════════════════════');
            }
            
            resolve();
          });
        });

        appsReq.on('error', (e) => {
          console.error('❌ Error consultando applications:', e.message);
          reject(e);
        });

        appsReq.end();
      });
    });

    loginReq.on('error', (e) => {
      console.error('❌ Error en login request:', e.message);
      reject(e);
    });

    loginReq.write(loginData);
    loginReq.end();
  });
}

checkApplicationsEndpoint().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
