const axios = require('axios');

async function testApplicantsMe() {
  try {
    console.log('1. Login con NUEVO código...\n');
    const loginResp = await axios.post('https://fcgback-production.up.railway.app/api/auth/enter-invite', {
      code: 'TEST-TX5LIDK8'
    });
    
    console.log('✅ Login exitoso');
    console.log('Email:', loginResp.data.user.email);
    console.log('Token:', loginResp.data.accessToken.substring(0, 30) + '...\n');
    
    const token = loginResp.data.accessToken;
    
    console.log('2. Probando /applicants/me...\n');
    const meResp = await axios.get('https://fcgback-production.up.railway.app/api/applicants/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('✅✅✅ /applicants/me FUNCIONA!\n');
    console.log('Respuesta:', JSON.stringify(meResp.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
}

testApplicantsMe();
