const argon2 = require('argon2');

async function generateHash() {
  const password = 'admin123';
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  console.log('Generated hash:', hash);
  
  // Verify immediately
  const isValid = await argon2.verify(hash, password);
  console.log('Verification:', isValid);
}

generateHash();
