const axios = require('axios');

const API_BASE = 'https://fcgback-production.up.railway.app/api';

async function test() {
  try {
    console.log('🔐 1. Haciendo login...\n');
    
    // 1. Login como staff (ADMIN/REVIEWER)
    const loginResponse = await axios.post(`${API_BASE}/auth/login-staff`, {
      email: 'juanjacontrerasra@gmail.com',
      password: 'AdminFCG2025!'
    });

    const token = loginResponse.data.accessToken || loginResponse.data.access_token;
    const user = loginResponse.data.user;
    
    console.log('✅ Login exitoso:');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    if (token) {
      console.log(`   Token (primeros 50 chars): ${token.substring(0, 50)}...\n`);
    } else {
      console.log(`   Token response:`, JSON.stringify(loginResponse.data, null, 2));
    }

    if (user.role !== 'ADMIN') {
      console.log('❌ ERROR: Usuario no es ADMIN\n');
      return;
    }

    console.log('🚀 2. Probando endpoint /admin/users/request...\n');

    // 2. Probar crear admin
    try {
      const createResponse = await axios.post(
        `${API_BASE}/admin/users/request`,
        {
          email: 'test.admin@fundacion.cl',
          fullName: 'Test Admin',
          password: 'TestPass123!'
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Endpoint funciona correctamente:');
      console.log(JSON.stringify(createResponse.data, null, 2));
      console.log('\n✅ TODO FUNCIONANDO CORRECTAMENTE\n');

    } catch (error) {
      if (error.response) {
        console.log('❌ Error del servidor:');
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Message: ${error.response.data?.message || error.response.statusText}`);
        console.log(`   Data:`, JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('❌ Error de conexión:', error.message);
      }
    }

  } catch (error) {
    if (error.response) {
      console.log('❌ Error en login:');
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

test();
