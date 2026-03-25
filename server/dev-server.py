#!/usr/bin/env python3
import http.server
import socketserver
import ssl
import os
import sys
from pathlib import Path

# Obtener la ruta del directorio raíz del proyecto
SERVER_DIR = Path(__file__).parent
ROOT_DIR = SERVER_DIR.parent  # Carpeta raíz del proyecto

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)
    
    def end_headers(self):
        # Headers necesarios para PWA y desarrollo
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # Log simplificado y claro
        print(f"📁 {self.address_string()} - {format % args}")

def get_local_ip():
    """Obtener IP local para acceso desde otros dispositivos"""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "localhost"

def main():
    # Verificar certificados SSL
    cert_path = SERVER_DIR / "cert.pem"
    key_path = SERVER_DIR / "key.pem"
    
    if not cert_path.exists() or not key_path.exists():
        print("❌ Certificados SSL no encontrados en la carpeta server/")
        print("📋 Genera certificados con:")
        print("   openssl req -x509 -newkey rsa:2048 -keyout server/key.pem -out server/cert.pem -days 365 -nodes -subj '/CN=localhost'")
        return
    
    # Configuración del servidor
    PORT = 8443
    local_ip = get_local_ip()
    
    # Crear contexto SSL
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=str(cert_path), keyfile=str(key_path))
    
    # Crear servidor HTTPS
    httpd = socketserver.TCPServer(('0.0.0.0', PORT), CustomHTTPRequestHandler)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    
    print("\n" + "="*70)
    print("🌐 SERVIDOR DE DESARROLLO HTTPS")
    print("="*70)
    print(f"📁 Sirviendo desde: {ROOT_DIR}")
    print(f"🔗 Acceso local: https://localhost:{PORT}/")
    print(f"📱 Acceso móvil: https://{local_ip}:{PORT}/")
    print(f"📂 Aplicación: https://localhost:{PORT}/index.html")
    print("\n" + "─"*70)
    print("📋 INSTRUCCIONES:")
    print("1. Abre https://localhost:{PORT}/ en tu navegador")
    print("2. Acepta el certificado auto-firmado (avanzado → continuar)")
    print("3. La aplicación funcionará con cámara HTTPS")
    print("4. Para acceso móvil, usa la IP local")
    print("\n🛑 Presiona Ctrl+C para detener el servidor")
    print("─"*70)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido")
        httpd.server_close()

if __name__ == "__main__":
    main()
