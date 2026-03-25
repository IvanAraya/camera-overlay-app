# 🌐 Servidor de Desarrollo HTTPS

Servidor de desarrollo local con HTTPS para la aplicación Camera Overlay.

## 🚀 Inicio Rápido

### Opción 1: Python (Recomendado)
```bash
cd server
python dev-server.py
```

### Opción 2: Node.js
```bash
cd server
npm install
npm run serve-simple
```

## 📋 Requisitos

### Python (Opción 1)
- Python 3.6+
- Módulos: `http.server`, `ssl`, `socketserver` (incluidos)

### Node.js (Opción 2)
- Node.js 14+
- http-server global o local

## 🔐 Certificados SSL

El servidor requiere certificados SSL para HTTPS. Ya existen en la carpeta:

- `cert.pem` - Certificado
- `key.pem` - Clave privada

### Generar nuevos certificados:
```bash
cd server
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
```

## 🌐 Acceso a la Aplicación

Una vez iniciado el servidor:

### Local
```
https://localhost:8443/
```

### Móvil (misma red WiFi)
```
https://[TU_IP_LOCAL]:8443/
```

### Aplicación directa
```
https://localhost:8443/index.html
```

## 📱 Configuración Móvil

1. **Conecta el móvil a la misma WiFi**
2. **Abre la URL HTTPS** con tu IP local
3. **Acepta el certificado** (avanzado → continuar)
4. **Permite acceso a cámara** cuando lo solicite

## 🛠️ Scripts Disponibles

```bash
# Iniciar servidor Python
npm start

# Iniciar servidor Python (alias)
npm run dev

# Generar certificados SSL
npm run generate-certs

# Servidor Node.js simple
npm run serve-simple

# Instalar http-server globalmente
npm run install-global
```

## 🔧 Configuración

### Puerto
- **Por defecto**: 8443
- **Cambiar**: Edita `dev-server.py` línea `PORT = 8443`

### Carpeta servida
- **Por defecto**: Carpeta raíz del proyecto (`../`)
- **Cambiar**: Edita `ROOT_DIR` en `dev-server.py`

## 📋 Características

- ✅ **HTTPS** con certificado SSL
- ✅ **CORS** habilitado para desarrollo
- ✅ **Headers de seguridad** configurados
- ✅ **No cache** para desarrollo
- ✅ **Logs claros** y simplificados
- ✅ **Acceso móvil** en red local
- ✅ **Soporte PWA** completo

## 🐛 Solución de Problemas

### Puerto en uso
```bash
# Cambiar puerto en dev-server.py
PORT = 8444
```

### Certificado no confiable
1. En Chrome: `chrome://flags/#allow-insecure-localhost`
2. O accede con `https://localhost:8443` y acepta manualmente

### Acceso móvil no funciona
1. Verifica firewall
2. Confirma misma red WiFi
3. Usa IP local correcta

## 🔄 Desarrollo

El servidor recarga automáticamente los cambios en archivos estáticos. No es necesario reiniciar al modificar:
- HTML
- CSS  
- JavaScript
- Imágenes

## 📱 PWA Testing

El servidor HTTPS permite probar completamente:
- ✅ Acceso a cámara
- ✅ Instalación PWA
- ✅ Service Workers
- ✅ Manifest.json
- ✅ Todos los gestos táctiles
