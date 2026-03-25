/* =============================================
   CAMERA OVERLAY APP - MAIN JAVASCRIPT
   ============================================= */

class CameraOverlayApp {
    constructor() {
        // Referencias DOM
        this.video = document.getElementById('cameraVideo');
        this.canvas = document.getElementById('overlayCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.statusMessage = document.getElementById('statusMessage');
        this.controlsPanel = document.getElementById('controlsPanel');
        this.gestureHint = document.getElementById('gestureHint');
        this.cameraIndicator = document.getElementById('cameraIndicator');
        this.cameraType = document.getElementById('cameraType');
        
        // Estado de la aplicación
        this.overlayImage = null;
        this.opacity = 1;
        this.scale = 1;
        this.rotation = 0;
        this.position = { x: 0, y: 0 };
        this.isDragging = false;
        this.isPinching = false;
        this.dragStart = { x: 0, y: 0 };
        this.cameraStream = null;
        this.lastTouchDistance = 0;
        this.initialPinchScale = 1;
        this.currentCamera = 'environment'; // 'user' para frontal, 'environment' para trasera
        this.availableCameras = [];
        this.cameraZoom = 1; // Zoom de la cámara
        this.maxZoom = 10; // Zoom máximo permitido
        
        // Inicialización
        this.initializeControls();
        this.checkCameraSupport();
        this.enumerateDevices();
        this.initializeCamera();
        this.initializeTouchGestures();
        this.initializePanelInteraction();
        
        // Ocultar hint después de 5 segundos
        setTimeout(() => {
            this.gestureHint.style.opacity = '0';
            setTimeout(() => {
                this.gestureHint.style.display = 'none';
            }, 300);
        }, 5000);
    }

    /* =============================================
       INICIALIZACIÓN
       ============================================= */

    initializeControls() {
        // File upload
        document.getElementById('imageUpload').addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });

        // Opacity slider
        const opacitySlider = document.getElementById('opacitySlider');
        opacitySlider.addEventListener('input', (e) => {
            this.opacity = e.target.value / 100;
            document.getElementById('opacityValue').textContent = `${e.target.value}%`;
            this.renderOverlay();
        });

        // Size slider
        const sizeSlider = document.getElementById('sizeSlider');
        sizeSlider.addEventListener('input', (e) => {
            this.scale = e.target.value / 100;
            document.getElementById('sizeValue').textContent = `${e.target.value}%`;
            this.renderOverlay();
        });

        // Rotation slider
        const rotationSlider = document.getElementById('rotationSlider');
        rotationSlider.addEventListener('input', (e) => {
            this.rotation = (e.target.value * Math.PI) / 180;
            document.getElementById('rotationValue').textContent = `${e.target.value}°`;
            this.renderOverlay();
        });

        // Zoom buttons
        document.getElementById('zoomInBtn').addEventListener('click', () => {
            this.scale = Math.min(this.scale + 0.1, 2);
            this.updateSizeSlider();
            this.renderOverlay();
        });

        document.getElementById('zoomOutBtn').addEventListener('click', () => {
            this.scale = Math.max(this.scale - 0.1, 0.25);
            this.updateSizeSlider();
            this.renderOverlay();
        });

        // Camera zoom buttons
        document.getElementById('cameraZoomInBtn').addEventListener('click', () => {
            this.zoomCamera(0.5);
        });

        document.getElementById('cameraZoomOutBtn').addEventListener('click', () => {
            this.zoomCamera(-0.5);
        });

        document.getElementById('cameraZoomResetBtn').addEventListener('click', () => {
            this.resetCameraZoom();
        });

        // Action buttons
        document.getElementById('resetPositionBtn').addEventListener('click', () => {
            this.resetPosition();
        });

        document.getElementById('clearImageBtn').addEventListener('click', () => {
            this.clearImage();
        });

        document.getElementById('retryCameraBtn').addEventListener('click', () => {
            this.retryCamera();
        });

        document.getElementById('switchCameraBtn').addEventListener('click', () => {
            this.switchCamera();
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.renderOverlay();
        });
    }

    updateSizeSlider() {
        const percentage = Math.round(this.scale * 100);
        document.getElementById('sizeSlider').value = percentage;
        document.getElementById('sizeValue').textContent = `${percentage}%`;
    }

    initializePanelInteraction() {
        const controlHandle = this.controlsPanel.querySelector('.control-handle');
        let isExpanded = false;

        const togglePanel = () => {
            isExpanded = !isExpanded;
            this.controlsPanel.classList.toggle('expanded', isExpanded);
        };

        controlHandle.addEventListener('click', togglePanel);
        
        // También expandir/colapsar al tocar en el canvas
        let tapTimer;
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                tapTimer = setTimeout(() => {
                    togglePanel();
                }, 500);
            }
        });

        this.canvas.addEventListener('touchend', () => {
            clearTimeout(tapTimer);
        });
    }

    /* =============================================
       CÁMARA
       ============================================= */

    async initializeCamera() {
        try {
            this.showStatus('Verificando soporte de cámara...', 'info');
            
            // Verificar soporte básico
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Navigator no soporta getUserMedia');
            }

            // Verificar HTTPS
            if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                throw new Error('Se requiere HTTPS para acceso a cámara');
            }

            this.showStatus('Solicitando acceso a la cámara...', 'info');
            
            // Intentar diferentes configuraciones para móvil
            const constraints = [
                // Configuración ideal para móvil - cámara trasera
                {
                    video: {
                        width: { ideal: window.innerWidth },
                        height: { ideal: window.innerHeight },
                        facingMode: this.currentCamera
                    }
                },
                // Configuración alternativa - cámara trasera
                {
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: this.currentCamera
                    }
                },
                // Configuración básica - cámara trasera
                {
                    video: {
                        facingMode: this.currentCamera
                    }
                },
                // Fallback a cualquier cámara
                {
                    video: true
                }
            ];

            let stream = null;
            let error = null;

            // Intentar cada configuración
            for (let i = 0; i < constraints.length; i++) {
                try {
                    this.showStatus(`Intentando configuración ${i + 1}...`, 'info');
                    stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
                    this.showStatus('¡Stream obtenido!', 'success');
                    break;
                } catch (e) {
                    error = e;
                    console.log(`Configuración ${i + 1} falló:`, e.name, e.message);
                    continue;
                }
            }

            if (stream) {
                this.cameraStream = stream;
                this.video.srcObject = this.cameraStream;
                
                this.video.onloadedmetadata = () => {
                    this.resizeCanvas();
                    this.updateCameraIndicator();
                    this.showStatus('Cámara iniciada correctamente', 'success');
                };

                // Verificar que el video realmente está reproduciendo
                this.video.onplay = () => {
                    this.showStatus('Video reproduciéndose', 'success');
                };

                this.video.onerror = (e) => {
                    console.error('Error en video:', e);
                    this.showStatus('Error al reproducir video', 'error');
                };

            } else {
                throw error || new Error('No se pudo obtener stream de cámara');
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.handleCameraError(error);
        }
    }

    handleCameraError(error) {
        let message = '';
        let solutions = [];
        let technicalInfo = '';

        // Analizar el tipo de error
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            message = 'Permiso de cámara denegado';
            solutions = [
                'Toca el ícono de 🔒 en la barra de dirección',
                'Permite el acceso a la cámara',
                'Recarga la página después de permitir',
                'Verifica configuración de permisos del navegador'
            ];
            technicalInfo = `Error: ${error.name} - El usuario denegó el permiso`;
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            message = 'No se encontró cámara';
            solutions = [
                'Verifica que tu dispositivo tenga cámara',
                'Reinicia tu dispositivo',
                'Cierra otras apps que usen la cámara',
                'Verifica que la cámara no esté desactivada en configuraciones'
            ];
            technicalInfo = `Error: ${error.name} - No hay dispositivos de cámara disponibles`;
        } else if (error.name === 'NotSupportedError' || error.name === 'ConstraintNotSatisfiedError') {
            message = 'Cámara no compatible';
            solutions = [
                'Actualiza tu navegador',
                'Usa Chrome, Safari o Firefox',
                'Verifica que tu navegador soporte WebRTC',
                'Evita navegadores antiguos o modo incógnito'
            ];
            technicalInfo = `Error: ${error.name} - Navegador no soporta getUserMedia`;
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            message = 'Cámara en uso por otra app';
            solutions = [
                'Cierra otras aplicaciones que usen la cámara',
                'Reinicia tu dispositivo',
                'Espera unos segundos y recarga',
                'Verifica que ninguna otra pestaña use la cámara'
            ];
            technicalInfo = `Error: ${error.name} - Cámara siendo usada por otro proceso`;
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
            message = 'Requisitos de cámara no cumplidos';
            solutions = [
                'Tu cámara no soporta la resolución requerida',
                'Intenta usar otro dispositivo',
                'Recarga la página',
                'Verifica especificaciones de tu cámara'
            ];
            technicalInfo = `Error: ${error.name} - Constraints no pueden ser satisfechas`;
        } else if (error.message && error.message.includes('HTTPS')) {
            message = 'Se requiere conexión segura HTTPS';
            solutions = [
                'Usa el servidor HTTPS: https://localhost:8443/camera-overlay.html',
                'Accede desde https://[TU_IP]:8443/camera-overlay.html',
                'Acepta la advertencia de certificado',
                'No uses http:// o file://'
            ];
            technicalInfo = `Error: Se requiere HTTPS para acceso a cámara en móviles`;
        } else {
            message = 'Error desconocido al acceder a la cámara';
            solutions = [
                'Recarga la página',
                'Reinicia tu dispositivo',
                'Intenta con otro navegador',
                'Verifica consola para más detalles'
            ];
            technicalInfo = `Error: ${error.name || 'Desconocido'} - ${error.message || 'Sin mensaje'}`;
        }

        this.displayCameraError(message, solutions, error, technicalInfo);
    }

    checkCameraSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showStatus('Tu navegador no soporta acceso a cámara', 'error');
            this.displayCameraError(
                'Navegador no compatible',
                [
                    'Usa Chrome, Safari, Firefox o Edge',
                    'Actualiza tu navegador a la última versión',
                    'Evita navegadores antiguos o modo incógnito'
                ],
                { name: 'NotSupportedError' }
            );
            return false;
        }
        return true;
    }

    async enumerateDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableCameras = devices.filter(device => device.kind === 'videoinput');
            
            console.log('Cámaras disponibles:', this.availableCameras.map(cam => ({
                id: cam.deviceId,
                label: cam.label || `Cámara ${this.availableCameras.indexOf(cam) + 1}`
            })));

            // Si no hay cámara trasera, cambiar a frontal
            if (this.availableCameras.length === 1) {
                this.currentCamera = 'user';
                this.showStatus('Solo cámara frontal disponible', 'info');
            } else {
                this.showStatus(`${this.availableCameras.length} cámaras encontradas`, 'success');
            }
        } catch (error) {
            console.error('Error enumerando dispositivos:', error);
        }
    }

    async switchCamera() {
        // Cambiar entre cámara frontal y trasera
        this.currentCamera = this.currentCamera === 'user' ? 'environment' : 'user';
        
        this.showStatus(`Cambiando a cámara ${this.currentCamera === 'user' ? 'frontal' : 'trasera'}...`, 'info');
        
        // Detener stream actual
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        
        // Reintentar con nueva cámara
        await this.initializeCamera();
    }

    async retryCamera() {
        // Detener stream actual si existe
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        
        // Limpiar mensajes de error
        this.statusMessage.innerHTML = '';
        
        // Reintentar inicialización
        await this.initializeCamera();
    }

    updateCameraIndicator() {
        const isFront = this.currentCamera === 'user';
        this.cameraType.textContent = isFront ? '🤱 Frontal' : '📷 Trasera';
        this.cameraType.style.color = isFront ? '#ff6b9d' : '#4ecdc4';
    }

    /* =============================================
       CONTROL DE ZOOM DE CÁMARA
       ============================================= */

    zoomCamera(factor) {
        this.cameraZoom = Math.max(1, Math.min(this.maxZoom, this.cameraZoom + factor));
        this.applyCameraZoom();
        this.showStatus(`Zoom cámara: ${Math.round(this.cameraZoom * 100)}%`, 'info');
    }

    resetCameraZoom() {
        this.cameraZoom = 1;
        this.applyCameraZoom();
        this.showStatus('Zoom cámara reseteado', 'info');
    }

    async applyCameraZoom() {
        if (!this.cameraStream) return;

        try {
            // Obtener el track de video
            const videoTrack = this.cameraStream.getVideoTracks()[0];
            if (!videoTrack) return;

            // Verificar si el track soporta zoom
            const capabilities = videoTrack.getCapabilities();
            if (capabilities.zoom) {
                // Aplicar zoom si está disponible
                const constraints = {
                    advanced: [{
                        zoom: this.cameraZoom
                    }]
                };
                await videoTrack.applyConstraints(constraints);
            } else {
                // Fallback: zoom digital (simulado)
                this.applyDigitalZoom();
            }
        } catch (error) {
            console.log('Error aplicando zoom:', error);
            this.applyDigitalZoom();
        }
    }

    applyDigitalZoom() {
        // Zoom digital simulado con transform CSS
        const zoomLevel = this.cameraZoom;
        this.video.style.transform = `scale(${zoomLevel})`;
        this.video.style.transformOrigin = 'center center';
    }

    displayCameraError(message, solutions, error, technicalInfo) {
        const solutionsHtml = solutions.map(solution => `<li>• ${solution}</li>`).join('');
        
        const errorHtml = `
            <div class="no-camera-message">
                <h3>📷 ${message}</h3>
                <p><strong>Error:</strong> ${error.name || 'Desconocido'}</p>
                <div style="background: rgba(255,255,255,0.1); padding: 0.5rem; border-radius: 5px; margin: 0.5rem 0; font-size: 0.8rem;">
                    <code>${technicalInfo}</code>
                </div>
                <div style="text-align: left; margin: 1.5rem 0;">
                    <p><strong>✅ Soluciones:</strong></p>
                    <ul style="list-style: none; padding: 0;">
                        ${solutionsHtml}
                    </ul>
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                    <button class="btn-icon btn-primary" onclick="location.reload()" style="margin: 1rem auto; display: inline-block; width: auto; padding: 0.5rem 1rem;">
                        🔄 Recargar Página
                    </button>
                    <button class="btn-icon btn-secondary" onclick="navigator.mediaDevices.getUserMedia({video: true}).then(() => location.reload()).catch(e => console.log(e))" style="margin: 1rem auto; display: inline-block; width: auto; padding: 0.5rem 1rem;">
                        🎥 Verificar Cámara
                    </button>
                </div>
                <p style="margin-top: 1rem; font-size: 0.8rem; opacity: 0.8;">
                    💡 Puedes seguir usando la aplicación para cargar y ajustar imágenes sin cámara.
                </p>
                <details style="margin-top: 1rem;">
                    <summary style="cursor: pointer; color: #66d9ef;">🔍 Información técnica</summary>
                    <pre style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 5px; font-size: 0.7rem; overflow-x: auto;">
Navegador: ${navigator.userAgent}
Protocolo: ${location.protocol}
Hostname: ${location.hostname}
HTTPS: ${location.protocol === 'https:' ? '✅' : '❌'}
getUserMedia: ${navigator.mediaDevices ? '✅' : '❌'}
Error completo: ${JSON.stringify(error, null, 2)}
                    </pre>
                </details>
            </div>
        `;
        this.statusMessage.innerHTML = errorHtml;
    }

    /* =============================================
       MANEJO DE ARCHIVOS
       ============================================= */

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showStatus('Por favor, selecciona un archivo de imagen válido', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.overlayImage = img;
                this.resetPosition();
                this.renderOverlay();
                this.showStatus('Imagen cargada correctamente', 'success');
                
                // Mostrar hint de gestos
                this.gestureHint.style.display = 'block';
                this.gestureHint.style.opacity = '1';
                setTimeout(() => {
                    this.gestureHint.style.opacity = '0';
                    setTimeout(() => {
                        this.gestureHint.style.display = 'none';
                    }, 300);
                }, 3000);
            };
            img.onerror = () => {
                this.showStatus('Error al cargar la imagen', 'error');
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            this.showStatus('Error al leer el archivo', 'error');
        };
        reader.readAsDataURL(file);
    }

    /* =============================================
       GESTOS Y EVENTOS TÁCTILES
       ============================================= */

    initializeTouchGestures() {
        // Mouse events para desktop
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.overlayImage) {
                this.isDragging = true;
                const rect = this.canvas.getBoundingClientRect();
                this.dragStart.x = e.clientX - rect.left - this.position.x;
                this.dragStart.y = e.clientY - rect.top - this.position.y;
                this.canvas.style.cursor = 'grabbing';
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.overlayImage) {
                const rect = this.canvas.getBoundingClientRect();
                this.position.x = e.clientX - rect.left - this.dragStart.x;
                this.position.y = e.clientY - rect.top - this.dragStart.y;
                this.renderOverlay();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'move';
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'move';
        });

        // Touch events para móvil
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 1) {
                // Un dedo - arrastrar imagen
                if (this.overlayImage) {
                    this.isDragging = true;
                    const rect = this.canvas.getBoundingClientRect();
                    const touch = e.touches[0];
                    this.dragStart.x = touch.clientX - rect.left - this.position.x;
                    this.dragStart.y = touch.clientY - rect.top - this.position.y;
                }
            } else if (e.touches.length === 2) {
                // Dos dedos - pellizco para resize de imagen O zoom de cámara
                this.isPinching = true;
                this.isDragging = false;
                this.lastTouchDistance = this.getTouchDistance(e.touches);
                this.initialPinchScale = this.scale;
                this.initialCameraZoom = this.cameraZoom;
            }
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 1 && this.isDragging) {
                // Arrastrar con un dedo - imagen
                const rect = this.canvas.getBoundingClientRect();
                const touch = e.touches[0];
                this.position.x = touch.clientX - rect.left - this.dragStart.x;
                this.position.y = touch.clientY - rect.top - this.dragStart.y;
                this.renderOverlay();
            } else if (e.touches.length === 2 && this.isPinching) {
                // Dos dedos - detectar dirección del pellizco
                const currentDistance = this.getTouchDistance(e.touches);
                const scaleRatio = currentDistance / this.lastTouchDistance;
                
                // Si hay imagen superpuesta, hacer zoom a la imagen
                if (this.overlayImage) {
                    this.scale = Math.max(0.25, Math.min(2, this.initialPinchScale * scaleRatio));
                    this.updateSizeSlider();
                    this.renderOverlay();
                } else {
                    // Si no hay imagen, hacer zoom a la cámara
                    this.cameraZoom = Math.max(1, Math.min(this.maxZoom, this.initialCameraZoom * scaleRatio));
                    this.applyCameraZoom();
                    this.showStatus(`Zoom cámara: ${Math.round(this.cameraZoom * 100)}%`, 'info');
                }
            }
        });

        this.canvas.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                this.isDragging = false;
                this.isPinching = false;
            }
        });

        // Wheel event para zoom con mouse wheel
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd + wheel = zoom de cámara
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.zoomCamera(delta);
            } else if (this.overlayImage) {
                // Wheel normal = zoom de imagen
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.scale = Math.max(0.25, Math.min(2, this.scale + delta));
                this.updateSizeSlider();
                this.renderOverlay();
            }
        });
    }

    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /* =============================================
       RENDERIZADO Y CANVAS
       ============================================= */

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Resetear posición al centro
        this.position = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    }

    renderOverlay() {
        if (!this.overlayImage) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();

        // Apply opacity
        this.ctx.globalAlpha = this.opacity;

        // Move to position and apply transformations
        this.ctx.translate(this.position.x, this.position.y);
        this.ctx.rotate(this.rotation);
        this.ctx.scale(this.scale, this.scale);

        // Calculate image dimensions to fit canvas
        const imgRatio = this.overlayImage.width / this.overlayImage.height;
        const canvasRatio = this.canvas.width / this.canvas.height;
        
        let drawWidth, drawHeight;
        if (imgRatio > canvasRatio) {
            drawWidth = this.canvas.width * 0.6;
            drawHeight = drawWidth / imgRatio;
        } else {
            drawHeight = this.canvas.height * 0.6;
            drawWidth = drawHeight * imgRatio;
        }

        // Center the image at the position
        this.ctx.drawImage(
            this.overlayImage,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
        );

        this.ctx.restore();
    }

    /* =============================================
       UTILIDADES
       ============================================= */

    resetPosition() {
        this.position = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
        this.renderOverlay();
        this.showStatus('Posición reseteada', 'info');
    }

    clearImage() {
        this.overlayImage = null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        document.getElementById('imageUpload').value = '';
        this.showStatus('Imagen eliminada', 'info');
    }

    showStatus(message, type = 'info') {
        this.statusMessage.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
        
        if (type !== 'error') {
            setTimeout(() => {
                if (this.statusMessage.innerHTML.includes(message)) {
                    this.statusMessage.innerHTML = '';
                }
            }, 3000);
        }
    }
}

/* =============================================
   INICIALIZACIÓN DE LA APLICACIÓN
   ============================================= */

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    }
    
    new CameraOverlayApp();
});
