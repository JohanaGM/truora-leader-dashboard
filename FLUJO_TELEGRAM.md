# 📱 Flujo de Envío de Tips a Telegram

## 📋 Descripción General

Este documento describe el flujo completo para enviar tips generados en el dashboard de Angular a un grupo de Telegram mediante n8n como intermediario.

---

## 🔄 Diagrama de Flujo

```
┌─────────────────────────────────────┐
│   PASO 1: USUARIO EN ANGULAR        │
│   - Completa título del tip         │
│   - Escribe contenido               │
│   - Click en "Generar Tip"          │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   PASO 2: GENERACIÓN DE IMAGEN      │
│   - html2canvas captura el DOM      │
│   - Convierte a imagen PNG          │
│   - Genera base64                   │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   PASO 3: ENVÍO A N8N               │
│   - Click en "Enviar a Telegram"    │
│   - tip.service.ts procesa datos    │
│   - HTTP POST al webhook de n8n     │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   PASO 4: N8N RECIBE DATOS          │
│   - Nodo Webhook recibe POST        │
│   - Extrae image, title, topic      │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   PASO 5: CONVERSIÓN BASE64→BINARIO │
│   - Nodo "Convert to File"          │
│   - base64 → archivo PNG            │
│   - Campo "data" con binario        │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   PASO 6: ENVÍO A TELEGRAM          │
│   - Nodo Telegram API               │
│   - sendPhoto con imagen            │
│   - Caption con info del tip        │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   PASO 7: GRUPO RECIBE TIP          │
│   ✅ Imagen visible en el grupo      │
│   ✅ Caption con título y contenido  │
└─────────────────────────────────────┘
```

---

## 🔧 Componentes del Sistema

### 1. Frontend - Angular 18

**Archivo:** `src/app/core/services/tip.service.ts`

**Funcionalidad:**
- Recibe la imagen generada en formato base64
- Limpia el prefijo `data:image/png;base64,`
- Crea un payload JSON con:
  - `image`: base64 limpio de la imagen
  - `title`: Título del tip (ej: "TIP MANUAL")
  - `topic`: Contenido del tip
  - `leaderName`: Nombre del líder que genera el tip
  - `timestamp`: Fecha y hora de creación

**Código:**
```typescript
sendToTelegram(tip: Tip): Observable<any> {
  // Quitar el prefijo del base64
  const base64Data = tip.imageData.split(',')[1] || tip.imageData;
  
  const payload = {
    image: base64Data,
    title: tip.title,
    topic: tip.topic,
    leaderName: tip.leaderName,
    timestamp: tip.createdAt.toISOString()
  };

  return this.http.post(environment.n8nWebhookUrl, payload);
}
```

**Endpoint:** `https://n8n.zapsign.com.br/webhook-test/d4d32508-4178-4d90-bfe9-c3f6c5889bfc`

---

### 2. Middleware - n8n Workflow

#### Nodo 1: Webhook (Trigger)

**Tipo:** Webhook
**Método:** POST
**Path:** `d4d32508-4178-4d90-bfe9-c3f6c5889bfc`

**Configuración:**
- **HTTP Method**: POST
- **Authentication**: None
- **Response Mode**: When Last Node Finishes
- **Field Name for Binary Data**: `data`

**Datos recibidos:**
```json
{
  "image": "iVBORw0KGgoAAAANSUhEUgAA...",
  "title": "TIP MANUAL",
  "topic": "La importancia de...",
  "leaderName": "Johana",
  "timestamp": "2025-11-16T10:30:00.000Z"
}
```

---

#### Nodo 2: Convert to File

**Tipo:** Convert to File
**Operación:** Move Base64 String to File

**Configuración:**
- **Operation**: Move Base64 String to File
- **Base64 Input Field**: `image`
- **Put Output File in Field**: `data`
- **Options**:
  - **File Name**: `tip.png`
  - **MIME Type**: `image/png`

**Proceso:**
1. Lee el campo `image` (base64 string)
2. Decodifica el base64
3. Crea un archivo binario PNG
4. Guarda en campo `data` con metadata (nombre, tipo MIME, tamaño)

**Salida:**
```
{
  "data": {
    "fileName": "tip.png",
    "mimeType": "image/png",
    "fileSize": 295000,
    "data": <binary PNG data>
  },
  "title": "TIP MANUAL",
  "topic": "La importancia de...",
  "leaderName": "Johana",
  "timestamp": "2025-11-16T10:30:00.000Z"
}
```

---

#### Nodo 3: Telegram (Send Photo)

**Tipo:** Telegram
**Operación:** Send Photo Message

**Configuración:**
- **Credential**: Bot Token de Telegram
- **Resource**: Message
- **Operation**: Send Photo
- **Chat ID**: ID del grupo de Telegram (ej: `-1001234567890`)
- **Binary File**: ✅ Activado
- **Input Binary Field**: `data`
- **Caption**:
  ```
  📌 {{ $json.title }}

  {{ $json.topic }}

  — {{ $json.leaderName }}
  📅 {{ new Date($json.timestamp).toLocaleString('es-ES') }}
  ```

**Proceso:**
1. Lee el archivo binario del campo `data`
2. Usa el Bot API de Telegram
3. Llama al endpoint `sendPhoto`
4. Envía la imagen al Chat ID especificado
5. Agrega el caption con la información del tip

---

## 🤖 Configuración del Bot de Telegram

### Crear el Bot

1. Abre Telegram y busca: `@BotFather`
2. Envía: `/newbot`
3. Nombre: `Truora Tips Bot`
4. Username: `truora_tips_bot`
5. Copia el **token** proporcionado

### Agregar al Grupo

1. Abre el grupo de Telegram
2. Click en nombre del grupo → "Agregar miembros"
3. Busca `@truora_tips_bot`
4. Agrégalo como **administrador** (necesario para enviar mensajes)

### Obtener Chat ID

**Método 1 - API de Telegram:**
1. Envía un mensaje al grupo mencionando al bot
2. Abre: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Busca: `"chat":{"id":-1001234567890}`
4. Copia el número (incluye el signo negativo)

**Método 2 - n8n:**
1. Crea un nodo Telegram temporal
2. Operation: Get Chat
3. Chat: `@nombre_del_grupo`
4. Ejecuta y obtén el ID

---

## 📊 Estructura de Datos

### Payload enviado desde Angular

```typescript
interface TipPayload {
  image: string;        // Base64 limpio (sin prefijo)
  title: string;        // "TIP MANUAL"
  topic: string;        // Contenido del tip
  leaderName: string;   // "Johana García"
  timestamp: string;    // ISO 8601: "2025-11-16T10:30:00.000Z"
}
```

### Tip Model en Angular

```typescript
interface Tip {
  id: string;
  title: string;
  topic: string;
  imageData: string;     // Base64 completo con prefijo
  createdAt: Date;
  sentToTelegram: boolean;
  leaderName: string;
}
```

---

## ⚙️ Configuración de Entornos

### Angular - environment.ts

```typescript
export const environment = {
  production: false,
  n8nWebhookUrl: 'https://n8n.zapsign.com.br/webhook-test/d4d32508-4178-4d90-bfe9-c3f6c5889bfc'
};
```

### Angular - environment.prod.ts

```typescript
export const environment = {
  production: true,
  n8nWebhookUrl: 'https://n8n.zapsign.com.br/webhook/d4d32508-4178-4d90-bfe9-c3f6c5889bfc'
};
```

---

## 🔍 Debugging y Solución de Problemas

### Error: IMAGE_PROCESS_FAILED

**Causa:** La imagen base64 tiene el prefijo `data:image/png;base64,`

**Solución:** El código ya lo maneja:
```typescript
const base64Data = tip.imageData.split(',')[1] || tip.imageData;
```

---

### Error: Cannot read properties of undefined (reading 'fileName')

**Causa:** El nodo Telegram está buscando el archivo en el campo incorrecto

**Solución:** 
- En "Convert to File": `Put Output File in Field` = `data`
- En "Telegram": `Input Binary Field` = `data`

---

### Error: Bad Request: chat not found

**Causa:** El Chat ID es incorrecto o el bot no está en el grupo

**Solución:**
1. Verifica que el bot sea administrador del grupo
2. Confirma el Chat ID (debe empezar con `-100`)
3. Usa `getUpdates` para verificar el ID correcto

---

### Error: Unauthorized

**Causa:** El token del bot es incorrecto o expiró

**Solución:**
1. Ve a @BotFather
2. Envía `/token` y selecciona tu bot
3. Actualiza el token en las credenciales de n8n

---

## 🧪 Pruebas

### Flujo de Testing

1. **Verificar Webhook:**
   - Click en "Listen for test event" en n8n
   - Genera un tip en Angular
   - Click "Enviar a Telegram"
   - Verifica que n8n recibe los datos

2. **Verificar Conversión:**
   - Ejecuta el nodo "Convert to File"
   - Click en "View" para ver la imagen
   - Debe mostrar el tip generado

3. **Verificar Envío a Telegram:**
   - Ejecuta el nodo "Telegram"
   - Verifica que la imagen llega al grupo
   - Confirma que el caption es correcto

---

## 📈 Mejoras Futuras

### Funcionalidades Sugeridas

1. **Historial de Tips:**
   - Guardar tips enviados en localStorage
   - Mostrar lista de tips enviados
   - Opción de reenviar tips anteriores

2. **Programación de Tips:**
   - Permitir agendar envío de tips
   - Cola de tips pendientes
   - Envío automático en horarios específicos

3. **Analytics:**
   - Contador de tips enviados
   - Estadísticas por líder
   - Tracking de engagement en Telegram

4. **Personalización:**
   - Diferentes plantillas de diseño
   - Temas de color personalizables
   - Fuentes y estilos variables

5. **Multi-canal:**
   - Envío a múltiples grupos
   - Integración con Slack
   - Integración con WhatsApp Business API

---

## 📝 Checklist de Implementación

- [x] Crear bot en Telegram con @BotFather
- [x] Agregar bot al grupo como administrador
- [x] Obtener Chat ID del grupo
- [x] Configurar webhook en n8n
- [x] Configurar nodo "Convert to File"
- [x] Configurar nodo Telegram
- [x] Configurar credenciales del bot en n8n
- [x] Actualizar environment.ts con URL del webhook
- [x] Limpiar base64 antes de enviar
- [x] Probar flujo completo
- [x] Documentar proceso

---

## 🚀 Deploy a Producción

### Pasos para Producción

1. **n8n:**
   - Cambiar webhook de test a producción
   - Configurar dominio personalizado
   - Habilitar HTTPS
   - Configurar rate limiting

2. **Angular:**
   - Actualizar `environment.prod.ts` con URL de producción
   - Build de producción: `ng build --configuration production`
   - Deploy en servidor/hosting

3. **Telegram:**
   - Verificar que el bot funciona en producción
   - Monitorear logs de errores
   - Configurar alertas

---

## 📞 Soporte

### Recursos Útiles

- **Documentación n8n**: https://docs.n8n.io/
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **Angular HttpClient**: https://angular.io/guide/http

### Contacto

- **Desarrollador**: Johana GM
- **Repositorio**: https://github.com/JohanaGM/truora-leader-dashboard
- **Branch**: master

---

**Última actualización:** 16 de noviembre de 2025
