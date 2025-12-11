const FormData = require("form-data");
const fs = require("fs");
const axios = require("axios");

async function testImageUpload() {
  const form = new FormData();
  form.append("file", fs.createReadStream("test-image.png"));
  form.append("category", "PROFILE");
  form.append("uploadedBy", "476d428e-a70a-4f88-b11a-6f59dc1a6f12");
  form.append("description", "Test profile image");

  try {
    const response = await axios.post(
      "https://fcgback-production.up.railway.app/api/files/upload",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AZmNnLmxvY2FsIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzMyNTc4NjEzLCJleHAiOjE3MzI2NjUwMTN9.QRsIdHzqP3tQcVGPBjVHaLjSgVmGBiQbNT3FMSP4n1M"
        }
      }
    );

    console.log("\n✅ Imagen subida exitosamente!");
    console.log("\nFile ID:", response.data.file.id);
    console.log("Filename:", response.data.file.originalFilename);
    console.log("Size:", response.data.file.size, "bytes");
    console.log("\nURLs:");
    console.log("  View:", response.data.urls.view);
    console.log("  Download:", response.data.urls.download);
    console.log("  Thumbnail:", response.data.urls.thumbnail || "N/A");
    
    // Return file ID for thumbnail test
    return response.data.file.id;
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    console.error("Status:", error.response?.status);
  }
}

testImageUpload();
