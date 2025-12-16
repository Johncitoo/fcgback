/**
 * Script para verificar invitaciones por email
 * Útil para debugging de problemas de envío masivo
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://postgres:bVEVpQwCDcKpRkMAHblZOqBmzDZSnjCq@autoridad-argentina-de-transicion-postgres.railway.internal:5432/railway';

async function checkInvites() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos\n');

    const emails = [
      'cristianurqueta23@gmail.com',
      'cristian.urqueta@alumnos.ucn.cl'
    ];

    for (const email of emails) {
      console.log(`\n📧 Buscando invitaciones para: ${email}`);
      console.log('='.repeat(60));

      // Buscar en invites
      const invitesQuery = `
        SELECT 
          i.id,
          i.call_id,
          i.email_sent,
          i.sent_at,
          i.sent_count,
          i.used_at,
          i.created_at,
          c.name as call_name,
          c.year as call_year
        FROM invites i
        LEFT JOIN calls c ON c.id = i.call_id
        WHERE LOWER(i.email) = LOWER($1)
        ORDER BY i.created_at DESC
      `;

      const invites = await client.query(invitesQuery, [email]);

      if (invites.rows.length === 0) {
        console.log('❌ No hay invitaciones para este email');
      } else {
        console.log(`✅ Encontradas ${invites.rows.length} invitación(es):\n`);
        invites.rows.forEach((inv, idx) => {
          console.log(`   Invitación #${idx + 1}:`);
          console.log(`   ID: ${inv.id}`);
          console.log(`   Convocatoria: ${inv.call_name} (${inv.call_year})`);
          console.log(`   Email enviado: ${inv.email_sent ? '✅ SÍ' : '❌ NO'}`);
          console.log(`   Enviado el: ${inv.sent_at || 'N/A'}`);
          console.log(`   Veces enviado: ${inv.sent_count || 0}`);
          console.log(`   Código usado: ${inv.used_at ? '✅ SÍ' : '❌ NO'}`);
          console.log(`   Creada: ${inv.created_at}`);
          console.log('');
        });
      }

      // Buscar en applicants
      const applicantsQuery = `
        SELECT 
          a.id,
          a.call_id,
          a.firstName as first_name,
          a.lastName as last_name,
          a.created_at,
          c.name as call_name,
          c.year as call_year
        FROM applicants a
        LEFT JOIN calls c ON c.id = a.call_id
        WHERE LOWER(a.email) = LOWER($1)
        ORDER BY a.created_at DESC
      `;

      const applicants = await client.query(applicantsQuery, [email]);

      if (applicants.rows.length === 0) {
        console.log('❌ No es postulante en el sistema');
      } else {
        console.log(`✅ Encontrado(s) ${applicants.rows.length} postulante(s):\n`);
        applicants.rows.forEach((app, idx) => {
          console.log(`   Postulante #${idx + 1}:`);
          console.log(`   ID: ${app.id}`);
          console.log(`   Nombre: ${app.first_name} ${app.last_name}`);
          console.log(`   Convocatoria: ${app.call_name} (${app.call_year})`);
          console.log(`   Creado: ${app.created_at}`);
          console.log('');
        });
      }
    }

    // Verificar columnas de email tracking
    console.log('\n🔍 Verificando estructura de tabla invites...');
    console.log('='.repeat(60));
    
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'invites'
      AND column_name IN ('email', 'email_sent', 'sent_at', 'sent_count')
      ORDER BY column_name
    `;

    const columns = await client.query(columnsQuery);
    
    if (columns.rows.length === 0) {
      console.log('⚠️  No se encontraron las columnas de email tracking');
    } else {
      console.log('Columnas encontradas:');
      columns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'N/A'})`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 El host no se puede resolver. Posibles soluciones:');
      console.log('   1. Ejecutar desde Railway CLI: railway run node scripts/check-invites-by-email.js');
      console.log('   2. Usar DATABASE_URL público de Railway (Settings → Connect)');
    } else if (error.code === '42P01') {
      console.log('\n💡 La tabla no existe. Verifica que las migraciones estén aplicadas.');
    } else if (error.code === '42703') {
      console.log('\n💡 Las columnas email_sent, sent_at, sent_count NO EXISTEN en la tabla invites');
      console.log('   Tu compañero mencionó migración 008, pero no se encuentra.');
      console.log('   Necesitas agregar estas columnas a la base de datos.');
    }
  } finally {
    await client.end();
    console.log('\n👋 Conexión cerrada');
  }
}

checkInvites();
