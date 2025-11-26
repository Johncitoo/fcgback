// Script para obtener el token de password de un email específico
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

const email = process.argv[2] || 'postulante.prueba@test.cl';

async function getPasswordToken() {
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        email,
        token,
        expires_at,
        created_at,
        CASE 
          WHEN expires_at < NOW() THEN '⚠️ EXPIRADO'
          ELSE '✅ VÁLIDO'
        END as estado
      FROM password_set_tokens
      WHERE email = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [email]);

    if (result.rows.length === 0) {
      console.log(`\n❌ No se encontró token para: ${email}\n`);
      console.log('Posibles razones:');
      console.log('- El código de invitación no se validó correctamente');
      console.log('- El email no coincide');
      console.log('- El token ya fue usado y eliminado\n');
    } else {
      const token = result.rows[0];
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔑 TOKEN DE CONTRASEÑA ENCONTRADO');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📧 Email:   ${token.email}`);
      console.log(`🎫 Token:   ${token.token}`);
      console.log(`📅 Expira:  ${new Date(token.expires_at).toLocaleString()}`);
      console.log(`${token.estado === '✅ VÁLIDO' ? '✅' : '⚠️'} Estado:  ${token.estado}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      if (token.estado === '✅ VÁLIDO') {
        console.log('📋 Para usar el token:');
        console.log(`1. Ir a: http://localhost:5173/#/set-password?email=${encodeURIComponent(email)}`);
        console.log(`2. Ingresar token: ${token.token}`);
        console.log(`3. Definir contraseña nueva\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

getPasswordToken();
