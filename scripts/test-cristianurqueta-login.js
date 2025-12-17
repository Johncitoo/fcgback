const axios = require('axios');

const API_BASE = 'https://fcgback-production.up.railway.app/api';

async function test() {
  try {
    console.log('🔐 Probando login con cristianurqueta23@gmail.com...\n');
    
    const loginResponse = await axios.post(`${API_BASE}/auth/login-staff`, {
      email: 'cristianurqueta23@gmail.com',
      password: 'AdminFCG2025!'
    });

    const token = loginResponse.data.accessToken || loginResponse.data.access_token;
    const user = loginResponse.data.user;
    
    console.log('✅ LOGIN EXITOSO:');
    console.log(`   📧 Email: ${user.email}`);
    console.log(`   👤 Nombre: ${user.fullName || user.full_name}`);
    console.log(`   🎭 Role: ${user.role}`);
    console.log(`   🆔 ID: ${user.id}`);
    
    if (token) {
      console.log(`   🔑 Token generado correctamente\n`);
    }

    console.log('✅ TODO FUNCIONANDO - Puedes iniciar sesión desde el frontend\n');

  } catch (error) {
    if (error.response) {
      console.log('❌ Error en login:');
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Message:`, error.response.data);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

test();
