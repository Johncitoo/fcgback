const axios = require('axios');

const API_URL = 'https://fcgback-production.up.railway.app/api';
const ADMIN_EMAIL = 'juanjacontrerasra@gmail.com';
const ADMIN_PASSWORD = 'AdminFCG2025!';

async function testReviewerCreation() {
  try {
    console.log('🔐 1. Iniciando sesión como admin...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    const token = loginResponse.data.access_token;
    console.log('✅ Login exitoso');
    console.log('Token:', token.substring(0, 50) + '...');

    // Esperar 2 segundos
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📝 2. Solicitando creación de reviewer...');
    const requestResponse = await axios.post(
      `${API_URL}/admin/reviewers/request`,
      {
        email: 'test.reviewer@fundacion.cl',
        fullName: 'Test Reviewer',
        password: 'ReviewerTest2025!',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log('✅ Solicitud exitosa:');
    console.log(JSON.stringify(requestResponse.data, null, 2));
    console.log('\n📧 Revisa el email de', ADMIN_EMAIL, 'para obtener el código de verificación.');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testReviewerCreation();
