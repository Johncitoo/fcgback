require('dotenv').config()
const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
})

async function previewCSV() {
  await client.connect()

  console.log('=== PREVIEW CSV PARA ARTURO ===\n')

  // 1. Obtener datos del postulante
  const applicant = await client.query(`
    SELECT 
      u.id,
      u.email,
      u.full_name,
      a.rut_number,
      a.rut_dv,
      a.phone,
      a.birth_date,
      a.address,
      a.commune,
      a.region,
      i.name as institution_name,
      i.commune as institution_commune,
      u.created_at
    FROM users u
    JOIN applicants a ON a.id = u.applicant_id
    LEFT JOIN institutions i ON i.id = a.institution_id
    WHERE u.email = 'arturo321rodriguez@gmail.com'
  `)

  if (applicant.rows.length === 0) {
    console.log('No se encontró el usuario')
    await client.end()
    return
  }

  const user = applicant.rows[0]
  console.log('📋 DATOS DEL USUARIO (Primeras columnas del CSV):')
  console.log('1. Nombre Completo:', user.full_name || 'Sin nombre')
  console.log('2. Email:', user.email)
  console.log('3. RUT:', user.rut_number && user.rut_dv ? `${user.rut_number}-${user.rut_dv}` : 'Sin RUT')
  console.log('4. Teléfono:', user.phone || 'Sin teléfono')
  console.log('5. Fecha de Nacimiento:', user.birth_date || 'Sin fecha')
  console.log('6. Dirección:', user.address || 'Sin dirección')
  console.log('7. Comuna:', user.commune || 'Sin comuna')
  console.log('8. Región:', user.region || 'Sin región')
  console.log('9. Institución:', user.institution_name || 'Sin institución')
  console.log('10. Comuna Institución:', user.institution_commune || 'Sin comuna')
  console.log('11. Fecha de Registro:', new Date(user.created_at).toLocaleDateString('es-CL'))

  // 2. Obtener respuestas del formulario
  const submission = await client.query(`
    SELECT 
      fs.form_data,
      fs.submitted_at,
      m.name as milestone_name
    FROM form_submissions fs
    JOIN applications app ON app.id = fs.application_id
    JOIN users u ON u.applicant_id = app.applicant_id
    JOIN milestones m ON m.id = fs.milestone_id
    WHERE u.email = 'arturo321rodriguez@gmail.com'
    LIMIT 1
  `)

  console.log('\n📝 ESTADO DEL FORMULARIO:')
  if (submission.rows.length === 0) {
    console.log('12. Estado Formulario: No entregado')
  } else {
    const sub = submission.rows[0]
    console.log('12. Estado Formulario: Entregado')
    console.log(`    Hito: ${sub.milestone_name}`)
    console.log(`    Fecha: ${new Date(sub.submitted_at).toLocaleString('es-CL')}`)
    
    console.log('\n📄 RESPUESTAS DEL FORMULARIO:')
    const answers = sub.form_data
    let colNum = 13
    
    for (const [key, value] of Object.entries(answers)) {
      console.log(`${colNum}. ${key}:`, formatValue(value))
      colNum++
    }
  }

  await client.end()
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'Sin respuesta'
  }

  // Detectar UUID (archivo)
  if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return '✓ Entregado (archivo)'
  }

  // Array (selección múltiple)
  if (Array.isArray(value)) {
    return value.join(', ')
  }

  // Objeto
  if (typeof value === 'object') {
    if (value.value !== undefined) {
      return Array.isArray(value.value) ? value.value.join(', ') : String(value.value)
    }
    return JSON.stringify(value)
  }

  return String(value)
}

previewCSV().catch(console.error)
