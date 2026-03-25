# 📸 Camera Overlay App

Aplicación web progresiva (PWA) para superponer imágenes sobre la cámara en tiempo real.

## ✨ Características

### 🎥 **Cámara**
- ✅ Cámara trasera por defecto
- ✅ Cambio entre frontal/trasera
- ✅ Detección automática de cámaras
- ✅ Indicador visual de cámara activa
- ✅ **Control de zoom digital (0.1x - 10x)**
- ✅ **Zoom nativo si el dispositivo lo soporta**
- ✅ **Fallback automático a zoom digital**
- ✅ **Zoom con botones táctiles**
- ✅ **Zoom con gestos (pellizco sin imagen)**
- ✅ **Zoom con rueda + Ctrl/Cmd**
- ✅ **Indicador de tipo de zoom (nativo/digital)**

### 🖼️ **Superposición de Imágenes**
- ✅ Carga desde dispositivo
- ✅ Opacidad ajustable (0-100%)
- ✅ Tamaño ajustable (25-200%)
- ✅ Rotación 360°
- ✅ Posición con arrastre

### 📱 **Interfaz Táctil**
- ✅ Un dedo: arrastrar imagen
- ✅ Dos dedos: pellizco para resize de imagen
- ✅ Dos dedos: pellizco para zoom de cámara (sin imagen)
- ✅ Rueda: zoom con mouse
- ✅ Ctrl/Cmd + rueda: zoom de cámara
- ✅ Panel deslizante minimalista

### 🌐 **PWA**
- ✅ Instalable como app nativa
- ✅ Funciona offline parcialmente
- ✅ Iconos para todos los dispositivos
- ✅ Diseño responsive

## 🚁 **Estructura del Proyecto**

```
camera-overlay-app/
├── index.html              # HTML principal (Bootstrap + layout optimizado)
├── manifest.json           # Configuración PWA
├── sw.js                 # Service Worker
├── css/
│   └── bootstrap-custom.css # Estilos Bootstrap personalizados
├── js/
│   └── app.js           # Lógica principal
├── assets/
│   ├── icon-72.png      # Iconos PWA
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-192.png
│   └── icon-512.png
├── server/                # Servidor de desarrollo
│   ├── dev-server.py    # Servidor HTTPS Python
│   ├── package.json      # Scripts y dependencias
│   ├── README.md         # Documentación del servidor
│   ├── start-dev.bat    # Inicio Windows
│   └── start-dev.sh     # Inicio Linux/Mac
├── .gitignore             # Archivos ignorados por Git
└── README.md              # Documentación principal
```

## 🎨 **Características del Layout**

### **Distribución de Controles:**
```
 🔎🔎🔄                              📷 Trasera
 ┌─────────────────────────────────────────────────────┐
│                                             │
│                                             │
│                                             │
│                                             │
│                                             │
│                                             │
│                                             │
│                                             │
│                                             │
│                                             │
│                                             │
│                                             │
├─────────────────────────────────────────────────────┤
│ 🖼️  ─────o─────── ⚙️                         │
└─────────────────────────────────────────────────────┘
```

### **📍 Controles Optimizados:**
- **🔝 Superior Izquierdo**: Zoom de cámara (compacto, 35x35px)
- **🔝 Superior Derecho**: Indicador de cámara actual (badge)
- **🔽 Inferior Central**: Cargar imagen, opacidad slider, settings
- **📋 Settings Desplegable**: Rotación, centrar, borrar, cambiar cámara

### **🎨 Framework Bootstrap:**
- **Bootstrap 5.3.0**: Componentes profesionales
- **Bootstrap Icons**: Iconos consistentes
- **CSS Personalizado**: Variables y overrides
- **Responsive**: Breakpoints automáticos

## 🌐 **Despliegue**

### **GitHub Pages (Recomendado)**
1. Subir todos los archivos a un repositorio GitHub
2. Activar GitHub Pages en Settings → Pages
3. Acceder: `https://[username].github.io/[repo]/`

### **Netlify (Alternativa)**
1. Arrastrar carpeta a netlify.com
2. Obtener URL HTTPS automática

### **Vercel (Alternativa)**
1. Conectar repositorio GitHub
2. Despliegue automático con cada push

## 📋 **Requisitos**

### **Navegador**
- ✅ Chrome 80+
- ✅ Safari 13+
- ✅ Firefox 75+
- ✅ Edge 80+

### **Dispositivo**
- ✅ Cámara web compatible
- ✅ HTTPS obligatorio para cámara
- ✅ Touch events (móvil)

## 🔧 **Desarrollo Local**

### **Servidor de Desarrollo (Recomendado)**
```bash
cd server
python dev-server.py
# O ejecuta start-dev.bat (Windows) o start-dev.sh (Linux/Mac)
```

**Acceso:**
- Local: `https://localhost:8443/`
- Móvil: `https://[tu-ip]:8443/`

### **Características del Servidor**
- ✅ HTTPS con certificado SSL
- ✅ Sirve carpeta raíz automáticamente
- ✅ CORS habilitado
- ✅ No cache para desarrollo
- ✅ Logs detallados
- ✅ Acceso móvil en red local

### **Con HTTPS Manual**
```bash
# Usar servidor HTTPS existente
python -m http.server 8443 --bind localhost

# O crear certificado con mkcert
mkcert -install && mkcert localhost
```

### **Sin HTTPS**
- Abrir `index.html` directamente
- Funciona todo excepto cámara
- Ideal para testing de UI

## 🛡️ **Seguridad**

- ✅ Sin envío de datos a servidores
- ✅ Validación de archivos de imagen
- ✅ Permisos explícitos de cámara
- ✅ Sin tracking ni cookies
- ✅ Sanitización de entradas

## 📱 **Instalación PWA**

1. Acceder a la URL HTTPS
2. Chrome: Menú → "Añadir a pantalla de inicio"
3. Safari: Compartir → "Añadir a pantalla de inicio"
4. Funcionará como app nativa

## 🔄 **Actualizaciones**

- Service Worker actualiza caché automáticamente
- Manifest controla versiones
- Los usuarios reciben actualizaciones al recargar

## 📄 **Licencia**

MIT License - Uso libre y comercial

## 🤝 **Contribuciones**

1. Fork del repositorio
2. Crear feature branch
3. Pull request con mejoras

---

**Desarrollado con ❤️ usando HTML5, CSS3 y JavaScript vanilla**
