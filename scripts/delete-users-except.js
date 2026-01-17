const { Client } = require('pg');

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const KEEP_EMAIL = process.env.KEEP_EMAIL;
  const CONFIRM_DELETE = process.env.CONFIRM_DELETE;

  if (!DATABASE_URL) {
    throw new Error('Falta DATABASE_URL en el entorno.');
  }
  if (!KEEP_EMAIL) {
    throw new Error('Falta KEEP_EMAIL en el entorno.');
  }
  if (CONFIRM_DELETE !== 'YES') {
    throw new Error('Protección activa: define CONFIRM_DELETE=YES para ejecutar.');
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const keepRes = await client.query(
      'SELECT id, applicant_id FROM users WHERE email = $1 LIMIT 1',
      [KEEP_EMAIL],
    );

    if (keepRes.rows.length === 0) {
      throw new Error(`No se encontró el usuario a mantener: ${KEEP_EMAIL}`);
    }

    const keepUserId = keepRes.rows[0].id;

    const usersRes = await client.query(
      'SELECT id, applicant_id FROM users WHERE id <> $1',
      [keepUserId],
    );

    if (usersRes.rows.length === 0) {
      console.log('No hay usuarios para eliminar.');
      return;
    }

    const userIds = usersRes.rows.map((r) => r.id);
    const applicantIds = usersRes.rows
      .map((r) => r.applicant_id)
      .filter((id) => !!id);

    await client.query('BEGIN');

    // Tablas con referencias directas a users
    await client.query(
      'DELETE FROM user_sessions WHERE user_id = ANY($1::uuid[])',
      [userIds],
    );
    await client.query(
      'DELETE FROM password_set_tokens WHERE user_id = ANY($1::uuid[])',
      [userIds],
    );
    await client.query(
      'DELETE FROM password_change_tokens WHERE user_id = ANY($1::uuid[])',
      [userIds],
    );
    await client.query(
      'DELETE FROM admin_verification_codes WHERE requester_user_id = ANY($1::uuid[])',
      [userIds],
    );
    await client.query(
      'DELETE FROM reviewer_verification_codes WHERE requester_user_id = ANY($1::uuid[])',
      [userIds],
    );

    // Mantener trazabilidad sin borrar todo
    await client.query(
      'UPDATE audit_logs SET actor_user_id = NULL WHERE actor_user_id = ANY($1::uuid[])',
      [userIds],
    );
    await client.query(
      'UPDATE invites SET created_by_user_id = NULL WHERE created_by_user_id = ANY($1::uuid[])',
      [userIds],
    );
    await client.query(
      'UPDATE invites SET used_by_applicant = NULL WHERE used_by_applicant = ANY($1::uuid[])',
      [userIds],
    );
    await client.query(
      'DELETE FROM application_notes WHERE author_user_id = ANY($1::uuid[])',
      [userIds],
    );
    await client.query(
      'DELETE FROM application_status_history WHERE actor_user_id = ANY($1::uuid[])',
      [userIds],
    );

    // Aplicaciones y applicants
    if (applicantIds.length > 0) {
      await client.query(
        'DELETE FROM applications WHERE applicant_id = ANY($1::uuid[])',
        [applicantIds],
      );
      await client.query(
        'DELETE FROM applicants WHERE id = ANY($1::uuid[])',
        [applicantIds],
      );
    }

    // Finalmente eliminar usuarios
    await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);

    await client.query('COMMIT');

    console.log(`Usuarios eliminados: ${userIds.length}. Usuario conservado: ${KEEP_EMAIL}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
