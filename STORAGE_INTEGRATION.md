# Integración Storage Service

## Variables de Entorno Requeridas

Agregar en Railway (proyecto fcgback):

```env
STORAGE_SERVICE_URL=https://tu-storage-service.up.railway.app
STORAGE_SERVICE_API_KEY=c3494e2a10724f4bb0ca8729f5cea62df651648ec1744361b12597b2a26d3070
```

## Endpoints Disponibles

### Upload de Archivo
`POST /api/files/upload`

**Form Data:**
- `file`: archivo
- `category`: PROFILE | DOCUMENT | FORM_FIELD | ATTACHMENT | OTHER
- `entityType`: USER | APPLICATION | FORM_ANSWER | INSTITUTION | OTHER
- `entityId`: UUID de la entidad
- `uploadedBy`: UUID del usuario que sube
- `description`: descripción opcional

**Response:**
```json
{
  "success": true,
  "file": {
    "id": "uuid",
    "originalFilename": "foto.jpg",
    "mimetype": "image/jpeg",
    "size": 12345,
    ...
  },
  "urls": {
    "view": "https://storage.../view/uuid",
    "download": "https://storage.../download/uuid",
    "thumbnail": "https://storage.../thumbnail/uuid"
  }
}
```

### Otros Endpoints
- `GET /api/files/:id/download` - Descargar archivo
- `GET /api/files/:id/view` - Ver archivo inline
- `GET /api/files/:id/thumbnail` - Thumbnail (solo imágenes)
- `GET /api/files/:id/metadata` - Metadata del archivo
- `GET /api/files/list?category=...&entityId=...` - Listar archivos
- `DELETE /api/files/:id` - Eliminar archivo (soft delete)

## Ejemplo de Uso en Frontend

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('category', 'PROFILE');
formData.append('uploadedBy', userId);

const response = await fetch(`${API_BASE}/files/upload`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`
  },
  body: formData
});

const { file, urls } = await response.json();
// Usar urls.view para mostrar en <img src="..." />
```
