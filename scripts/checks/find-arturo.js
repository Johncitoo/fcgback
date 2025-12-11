require('dotenv').config()
const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
})

async function main() {
  await client.connect()

  console.log('\n=== BUSCANDO USUARIOS CON "ARTURO" ===')
  const users = await client.query(`
    SELECT 
      id,
      email,
      full_name,
      applicant_id,
      created_at
    FROM users
    WHERE LOWER(full_name) LIKE '%arturo%' OR LOWER(email) LIKE '%arturo%'
    ORDER BY created_at DESC
  `)

  console.log(`\nEncontrados: ${users.rows.length}`)
  users.rows.forEach(u => {
    console.log(`\n- ${u.full_name}`)
    console.log(`  Email: ${u.email}`)
    console.log(`  Applicant ID: ${u.applicant_id}`)
    console.log(`  Created: ${u.created_at}`)
  })

  if (users.rows.length > 0) {
    const applicantId = users.rows[0].applicant_id
    
    console.log('\n=== APLICACIONES DE ESTE USUARIO ===')
    const apps = await client.query(`
      SELECT 
        a.id,
        a.status,
        a.submitted_at,
        a.created_at,
        c.name as call_name,
        c.year
      FROM applications a
      JOIN calls c ON c.id = a.call_id
      WHERE a.applicant_id = $1
      ORDER BY a.created_at DESC
    `, [applicantId])

    console.log(`\nTotal aplicaciones: ${apps.rows.length}`)
    apps.rows.forEach(app => {
      console.log(`\n- ${app.call_name} ${app.year}`)
      console.log(`  Status: ${app.status}`)
      console.log(`  Submitted: ${app.submitted_at}`)
      console.log(`  App ID: ${app.id}`)
    })

    if (apps.rows.length > 0) {
      const appId = apps.rows[0].id
      
      console.log('\n=== FORM_SUBMISSIONS ===')
      const subs = await client.query(`
        SELECT 
          fs.id,
          fs.form_id,
          fs.milestone_id,
          fs.submitted_at,
          fs.form_data,
          m.name as milestone_name,
          f.name as form_name
        FROM form_submissions fs
        LEFT JOIN milestones m ON m.id = fs.milestone_id
        LEFT JOIN forms f ON f.id = fs.form_id
        WHERE fs.application_id = $1
      `, [appId])

      console.log(`\nTotal submissions: ${subs.rows.length}`)
      subs.rows.forEach(sub => {
        console.log(`\n- ${sub.form_name} (${sub.milestone_name})`)
        console.log(`  Submitted: ${sub.submitted_at}`)
        console.log(`  Form data keys: ${sub.form_data ? Object.keys(sub.form_data).join(', ') : 'null'}`)
        if (sub.form_data) {
          console.log(`  Total campos: ${Object.keys(sub.form_data).length}`)
          console.log(`  Preview:`, JSON.stringify(sub.form_data).substring(0, 300))
        }
      })
    }
  }

  await client.end()
}

main().catch(console.error)
