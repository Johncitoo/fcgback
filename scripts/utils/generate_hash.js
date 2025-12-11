const argon2 = require('argon2');

async function generateHash() {
  const password = 'admin123';
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  console.log('Hash generado:', hash);
}

generateHash().catch(console.error);
