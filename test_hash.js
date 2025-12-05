const argon2 = require('argon2');

async function test() {
  const password = 'admin123';
  const hash = '$argon2id$v=19$m=65536,t=3,p=4$D1YMyPdo42fJIrbir2Q1bQ$aEV5nWq5vfCVQM8FH0TzmZRsNR6sJfJqrpWP7KoQj+s';
  
  try {
    const result = await argon2.verify(hash, password);
    console.log('Verification result:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
