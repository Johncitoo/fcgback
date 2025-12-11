const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function testUpload() {
  const form = new FormData();
  form.append('file', fs.createReadStream('test-file.txt'));
  form.append('category', 'DOCUMENT');
  form.append('uploadedBy', '00000000-0000-0000-0000-000000000001');
  form.append('description', 'Archivo de prueba desde test');

  try {
    const response = await axios.post(
      'https://fcgback-production.up.railway.app/api/files/upload',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AZmNnLmxvY2FsIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzMyNTc4NjEzLCJleHAiOjE3MzI2NjUwMTN9.QRsIdHzqP3tQcVGPBjVHaLjSgVmGBiQbNT3FMSP4n1M'
        }
      }
    );

    console.log('\n Archivo subido exitosamente!');
    console.log('\nFile ID:', response.data.file.id);
    console.log('Filename:', response.data.file.originalFilename);
    console.log('Size:', response.data.file.size, 'bytes');
    console.log('\nURLs:');
    console.log('  View:', response.data.urls.view);
    console.log('  Download:', response.data.urls.download);
    console.log('\nFull Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(' Error:', error.response?.data || error.message);
  }
}

testUpload();
