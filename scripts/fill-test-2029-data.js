/**
 * Script para rellenar datos de prueba en postulantes de "test 2029"
 * Rellena información de applicants y submissions de formularios
 */

const { Client } = require('pg');

const DB_CONFIG = {
  host: 'tramway.proxy.rlwy.net',
  port: 30026,
  user: 'postgres',
  password: 'LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv',
  database: 'railway',
};

// Datos de ejemplo para rellenar
const NOMBRES = ['Juan', 'María', 'Pedro', 'Ana', 'Carlos', 'Laura', 'Diego', 'Sofía', 'Miguel', 'Valentina'];
const APELLIDOS = ['González', 'Rodríguez', 'López', 'Martínez', 'García', 'Fernández', 'Pérez', 'Sánchez', 'Ramírez', 'Torres'];
const COMUNAS = ['Santiago', 'Providencia', 'Las Condes', 'Ñuñoa', 'Maipú', 'La Florida', 'Puente Alto', 'San Bernardo'];
const REGIONES = ['Metropolitana', 'Valparaíso', 'Biobío', "O'Higgins", 'Maule', 'Los Lagos'];
const INSTITUCIONES = ['Universidad de Chile', 'Pontificia Universidad Católica', 'Universidad de Santiago', 'Universidad de Concepción', 'Universidad Técnica Federico Santa María'];

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomRUT() {
  const num = Math.floor(Math.random() * 20000000) + 10000000;
  const dv = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'K'][Math.floor(Math.random() * 11)];
  return { num, dv };
}

function randomPhone() {
  return `+569${Math.floor(Math.random() * 90000000) + 10000000}`;
}

function randomEmail(nombre, apellido) {
  return `${nombre.toLowerCase()}.${apellido.toLowerCase()}@test.cl`;
}

function randomBirthDate() {
  const year = 1990 + Math.floor(Math.random() * 15); // 1990-2004
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function randomAddress() {
  const calle = ['Los Pinos', 'Las Rosas', 'El Bosque', 'La Alameda', 'Los Aromos'][Math.floor(Math.random() * 5)];
  const numero = Math.floor(Math.random() * 9000) + 1000;
  return `${calle} ${numero}`;
}

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('✅ Conectado a la base de datos\n');

  try {
    // 1. Buscar convocatoria "test 2029"
    const callRes = await client.query(
      `SELECT id, name, year FROM calls WHERE name ILIKE '%test%' AND year = 2029 LIMIT 1`
    );

    if (callRes.rows.length === 0) {
      console.log('❌ No se encontró convocatoria "test 2029"');
      return;
    }

    const call = callRes.rows[0];
    console.log(`📋 Convocatoria encontrada: ${call.name} (${call.year})`);
    console.log(`   ID: ${call.id}\n`);

    // 2. Obtener todas las aplicaciones de esta convocatoria
    const appsRes = await client.query(
      `SELECT a.id, a.applicant_id, a.status, a.created_at
       FROM applications a
       WHERE a.call_id = $1`,
      [call.id]
    );

    console.log(`📝 Aplicaciones encontradas: ${appsRes.rows.length}\n`);

    if (appsRes.rows.length === 0) {
      console.log('⚠️  No hay aplicaciones para esta convocatoria');
      return;
    }

    // 3. Para cada aplicación, rellenar datos del applicant
    for (let i = 0; i < appsRes.rows.length; i++) {
      const app = appsRes.rows[i];
      const nombre = randomItem(NOMBRES);
      const apellido = randomItem(APELLIDOS);
      const rut = randomRUT();

      console.log(`\n[${i + 1}/${appsRes.rows.length}] Procesando aplicación ${app.id.substring(0, 8)}...`);

      // Actualizar datos del applicant
      await client.query(
        `UPDATE applicants
         SET 
           first_name = $1,
           last_name = $2,
           email = $3,
           rut_number = $4,
           rut_dv = $5,
           phone = $6,
           birth_date = $7,
           address = $8,
           commune = $9,
           region = $10
         WHERE id = $11`,
        [
          nombre,
          apellido,
          randomEmail(nombre, apellido),
          rut.num,
          rut.dv,
          randomPhone(),
          randomBirthDate(),
          randomAddress(),
          randomItem(COMUNAS),
          randomItem(REGIONES),
          app.applicant_id
        ]
      );

      console.log(`   ✅ Datos de applicant actualizados: ${nombre} ${apellido}`);

      // 4. Obtener hitos activos para esta convocatoria
      const milestonesRes = await client.query(
        `SELECT mp.id, mp.milestone_id, m.name, m.form_id, m.order_index
         FROM milestone_progress mp
         INNER JOIN milestones m ON m.id = mp.milestone_id
         WHERE mp.application_id = $1 AND mp.status != 'COMPLETED'
         ORDER BY m.order_index ASC`,
        [app.id]
      );

      console.log(`   📋 Hitos encontrados: ${milestonesRes.rows.length}`);

      // 5. Para cada hito, crear o actualizar form_submission
      for (const mp of milestonesRes.rows) {
        if (!mp.form_id) {
          console.log(`      ⚠️  Hito "${mp.name}" sin formulario asociado`);
          continue;
        }

        // Obtener estructura del formulario
        const formRes = await client.query(
          `SELECT schema FROM forms WHERE id = $1`,
          [mp.form_id]
        );

        if (formRes.rows.length === 0) {
          console.log(`      ⚠️  Formulario no encontrado para hito "${mp.name}"`);
          continue;
        }

        const form = formRes.rows[0].schema;
        const formData = {};

        // Generar respuestas de prueba según el tipo de campo
        for (const section of form.sections || []) {
          for (const field of section.fields || []) {
            switch (field.type) {
              case 'text':
              case 'textarea':
                formData[field.name] = `Respuesta de prueba para ${field.label}`;
                break;
              case 'email':
                formData[field.name] = randomEmail(nombre, apellido);
                break;
              case 'number':
                formData[field.name] = Math.floor(Math.random() * 100) + 1;
                break;
              case 'date':
                formData[field.name] = randomBirthDate();
                break;
              case 'select':
              case 'radio':
                if (field.options && field.options.length > 0) {
                  formData[field.name] = randomItem(field.options);
                }
                break;
              case 'checkbox':
                if (field.options && field.options.length > 0) {
                  formData[field.name] = [randomItem(field.options)];
                }
                break;
              case 'file':
                formData[field.name] = null; // No subimos archivos en este script
                break;
              default:
                formData[field.name] = 'Valor de prueba';
            }
          }
        }

        // Verificar si ya existe un submission
        const existingRes = await client.query(
          `SELECT id FROM form_submissions 
           WHERE application_id = $1 AND milestone_id = $2`,
          [app.id, mp.milestone_id]
        );

        if (existingRes.rows.length > 0) {
          // Actualizar
          await client.query(
            `UPDATE form_submissions
             SET form_data = $1, submitted_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(formData), existingRes.rows[0].id]
          );
          console.log(`      ✅ Submission actualizado para hito "${mp.name}"`);
        } else {
          // Crear nuevo
          await client.query(
            `INSERT INTO form_submissions (application_id, milestone_id, form_data, submitted_at, created_at)
             VALUES ($1, $2, $3, NOW(), NOW())`,
            [app.id, mp.milestone_id, JSON.stringify(formData)]
          );
          console.log(`      ✅ Submission creado para hito "${mp.name}"`);
        }

        // Marcar milestone_progress como completado
        await client.query(
          `UPDATE milestone_progress
           SET status = 'COMPLETED'
           WHERE id = $1`,
          [mp.id]
        );
        console.log(`      ✅ Hito marcado como completado`);
      }
    }

    console.log('\n\n🎉 Proceso completado exitosamente!');
    console.log(`📊 Resumen:`);
    console.log(`   - Aplicaciones procesadas: ${appsRes.rows.length}`);
    console.log(`   - Convocatoria: ${call.name} ${call.year}`);
    console.log(`\n💡 Ahora puedes descargar el Excel desde el panel de admin para verificar los datos.`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n👋 Desconectado de la base de datos');
  }
}

main();
