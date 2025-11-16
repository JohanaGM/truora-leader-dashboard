# Truora Leader Dashboard

Dashboard moderno para líderes con gestión de actividades, tareas y generador de tips.

## 📋 Requisitos Previos

- Node.js 18+ y npm
- Angular CLI 18
- Git

## 🚀 Guía de Instalación Paso a Paso

### Paso 1: Instalar Angular CLI (si no lo tienes)
```powershell
npm install -g @angular/cli@18
```

### Paso 2: Clonar o navegar al proyecto
```powershell
cd C:\truora-leader-dashboard
```

### Paso 3: Instalar dependencias
```powershell
npm install
```

### Paso 4: Configurar variables de entorno
Edita el archivo `src/environments/environment.ts` y configura:
- `n8nWebhookUrl`: URL de tu webhook de n8n para enviar tips a Telegram

```typescript
export const environment = {
  production: false,
  n8nWebhookUrl: 'https://tu-instancia-n8n.com/webhook/telegram-tip'
};
```

### Paso 5: Ejecutar el proyecto en desarrollo
```powershell
ng serve
```

La aplicación estará disponible en: `http://localhost:4200`

### Paso 6: Build para producción
```powershell
ng build --configuration production
```

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── core/                    # Módulo principal
│   │   ├── guards/             # Guards de autenticación
│   │   ├── interceptors/       # HTTP interceptors
│   │   ├── services/           # Servicios singleton
│   │   └── models/             # Modelos de datos
│   │
│   ├── shared/                  # Componentes compartidos
│   │   ├── components/         # Componentes reutilizables
│   │   ├── directives/         # Directivas
│   │   └── pipes/              # Pipes
│   │
│   ├── features/                # Módulos de funcionalidades (Lazy Loading)
│   │   ├── schedule/           # Cronograma de actividades
│   │   ├── tasks/              # Tareas semanales
│   │   └── tip-generator/      # Generador de tips
│   │
│   ├── layout/                  # Componentes de layout
│   │   ├── sidebar/
│   │   ├── header/
│   │   └── dashboard/
│   │
│   └── app.routes.ts           # Configuración de rutas
│
├── assets/
│   ├── images/                 # Imágenes (logo Truora)
│   └── styles/                 # Estilos globales
│
└── environments/               # Configuración de entornos
```

## 🎯 Funcionalidades Implementadas

### 1. Cronograma de Actividades
- ✅ Vista de calendario semanal
- ✅ Listado de eventos con título, fecha, hora y estado
- ✅ Agregar, editar y eliminar actividades
- ✅ Modales para formularios
- ✅ Validaciones de formulario

### 2. Tareas de la Semana
- ✅ Lista de tareas con título, descripción, prioridad y estado
- ✅ Estados: Pendiente, En Progreso, Completada
- ✅ CRUD completo (Crear, Leer, Actualizar, Eliminar)
- ✅ Side panel para formularios
- ✅ Filtros por estado y prioridad

### 3. Generador de Tips
- ✅ Campo de entrada para el tema del tip
- ✅ Generación de imagen con Canvas API
- ✅ Vista previa de la imagen generada
- ✅ Botón "Enviar a Telegram" (habilitado solo después de generar)
- ✅ Integración con n8n mediante webhook
- ✅ Estados de carga y mensajes de éxito/error
- ✅ Diseño atractivo con logo de Truora

## 🎨 Características de Diseño

- **Colores pasteles vivos**: Paleta moderna y profesional
- **Animaciones suaves**: Transiciones de 0.2s en hover
- **Efectos interactivos**: Transform, scale, opacity
- **Layout responsive**: Adaptable a móvil, tablet y desktop
- **Dashboard moderno**: Sidebar con navegación
- **Cards elegantes**: Para cada módulo
- **Logo Truora**: Integrado en header y tips

## 🔧 Tecnologías Utilizadas

- Angular 18 (Standalone Components)
- TypeScript 5.4+
- Angular Router (Lazy Loading)
- RxJS para manejo de estado
- Canvas API para generación de imágenes
- CSS3 con animaciones y transiciones
- Responsive Design (Flexbox & Grid)

## 📡 Integración con n8n

El generador de tips envía la imagen generada a n8n mediante un webhook:

**Endpoint esperado:** `POST /webhook/telegram-tip`

**Body:**
```json
{
  "image": "data:image/png;base64,...",
  "topic": "Tema del tip",
  "leaderName": "Nombre del líder",
  "timestamp": "2025-11-15T10:30:00Z"
}
```

**Configuración en n8n:**
1. Crear un webhook node que reciba el POST
2. Extraer la imagen del base64
3. Usar el node de Telegram para enviar la imagen
4. Configurar el bot token y chat ID de Telegram

## 🧪 Scripts Disponibles

```powershell
# Desarrollo
npm start

# Build de producción
npm run build

# Tests unitarios
npm test

# Tests e2e
npm run e2e

# Linting
npm run lint
```

## 👤 Usuario de Ejemplo

El nombre del líder se puede configurar en el servicio de autenticación.
Por defecto: **"Líder de Identidad"**

## 📝 Notas Importantes

1. **LocalStorage**: Los datos se guardan localmente por defecto
2. **API Backend**: Puedes conectar un backend editando los servicios en `core/services/`
3. **Autenticación**: Actualmente mock, implementa tu sistema de auth real
4. **n8n Webhook**: Debe estar configurado para recibir y procesar las imágenes

## 🆘 Solución de Problemas

### Error: "ng no se reconoce como comando"
```powershell
npm install -g @angular/cli@18
```

### Error de CORS con n8n
Configura CORS en tu instancia de n8n o usa un proxy

### La imagen no se genera
Verifica que el canvas esté soportado en tu navegador

## 📄 Licencia

Proyecto privado para Truora

---

Desarrollado con ❤️ para Truora
