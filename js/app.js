/* =============================================
   CAMERA OVERLAY APP - LAYOUT VERSION
   ============================================= */

class CameraOverlayApp {
    constructor() {
        // Referencias DOM
        this.video = document.getElementById('cameraVideo');
        this.canvas = document.getElementById('overlayCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.statusMessage = document.getElementById('statusMessage');
        this.gestureHint = document.getElementById('gestureHint');
        this.cameraIndicator = document.getElementById('cameraIndicator');
        this.cameraType = document.getElementById('cameraType');
        this.settingsPanel = document.getElementById('settingsPanel');
        this.settingsBtn = document.getElementById('settingsBtn');
        
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
        this.minZoom = 0.1; // Zoom mínimo permitido (10x alejado)
        this.settingsOpen = false;
        
        // Throttling para renderizado
        this.renderPending = false;
        this.lastRenderTime = 0;
        this.renderThrottleDelay = 16; // ~60fps
        
        // Inicialización
        this.initializeControls();
        this.checkCameraSupport();
        this.enumerateDevices();
        this.initializeCamera();
        this.initializeTouchGestures();
        this.initializeSettingsPanel();
        
        // Agregar cleanup al cerrar página
        window.addEventListener('beforeunload', () => {
            this.cleanupCameraStream();
        });
        
        // Mostrar hint inicialmente
        setTimeout(() => {
            this.gestureHint.classList.remove('d-none');
            this.gestureHint.style.animation = 'fadeIn 0.3s ease-out';
        }, 1000);
        
        // Ocultar hint después de 5 segundos
        setTimeout(() => {
            this.gestureHint.classList.add('d-none');
        }, 6000);
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
        document.getElementById('opacitySlider').addEventListener('input', (e) => {
            this.opacity = e.target.value / 100;
            document.getElementById('opacityValue').textContent = `${e.target.value}%`;
            this.renderOverlay();
        });

        // Rotation slider
        document.getElementById('rotationSlider').addEventListener('input', (e) => {
            this.rotation = (e.target.value * Math.PI) / 180;
            document.getElementById('rotationValue').textContent = `${e.target.value}°`;
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

        // Settings panel buttons
        document.getElementById('centerImageBtn').addEventListener('click', () => {
            this.resetPosition();
        });

        document.getElementById('clearImageBtn').addEventListener('click', () => {
            this.clearImage();
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

    initializeSettingsPanel() {
        // Toggle settings panel
        this.settingsBtn.addEventListener('click', () => {
            this.toggleSettings();
        });

        // Cerrar panel al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (this.settingsOpen && 
                !this.settingsPanel.contains(e.target) && 
                !this.settingsBtn.contains(e.target)) {
                this.closeSettings();
            }
        });

        // Cerrar panel con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.settingsOpen) {
                this.closeSettings();
            }
        });
    }

    toggleSettings() {
        this.settingsOpen = !this.settingsOpen;
        if (this.settingsOpen) {
            this.openSettings();
        } else {
            this.closeSettings();
        }
    }

    openSettings() {
        this.settingsPanel.classList.add('show');
        this.settingsOpen = true;
        this.settingsBtn.style.background = '#667eea';
        this.settingsBtn.style.color = 'white';
    }

    closeSettings() {
        this.settingsPanel.classList.remove('show');
        this.settingsOpen = false;
        this.settingsBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        this.settingsBtn.style.color = 'white';
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
        const errorMap = {
            'NotAllowedError': {
                message: 'Permiso de cámara denegado',
                solutions: [
                    'Toca el ícono de 🔒 en la barra de dirección',
                    'Permite el acceso a la cámara',
                    'Recarga la página después de permitir',
                    'Verifica configuración de permisos del navegador'
                ]
            },
            'NotFoundError': {
                message: 'No se encontró cámara',
                solutions: [
                    'Verifica que tu dispositivo tenga cámara',
                    'Reinicia tu dispositivo',
                    'Cierra otras apps que usen la cámara',
                    'Verifica que la cámara no esté desactivada en configuraciones'
                ]
            },
            'NotSupportedError': {
                message: 'Cámara no compatible',
                solutions: [
                    'Actualiza tu navegador',
                    'Usa Chrome, Safari o Firefox',
                    'Verifica que tu navegador soporte WebRTC',
                    'Evita navegadores antiguos o modo incógnito'
                ]
            },
            'NotReadableError': {
                message: 'Cámara en uso por otra aplicación',
                solutions: [
                    'Cierra otras aplicaciones que usen la cámara',
                    'Reinicia tu dispositivo',
                    'Espera unos segundos y recarga',
                    'Verifica que ninguna otra pestaña use la cámara'
                ]
            },
            'OverconstrainedError': {
                message: 'Requisitos de cámara no cumplidos',
                solutions: [
                    'Tu cámara no soporta la resolución requerida',
                    'Intenta usar otro dispositivo',
                    'Recarga la página',
                    'Verifica especificaciones de tu cámara'
                ]
            }
        };

        const errorInfo = errorMap[error.name] || {
            message: 'Error desconocido al acceder a la cámara',
            solutions: [
                'Recarga la página',
                'Reinicia tu dispositivo',
                'Intenta con otro navegador',
                'Verifica consola para más detalles'
            ]
        };

        // Manejo especial para errores HTTPS
        if (error.message && error.message.includes('HTTPS')) {
            errorInfo.message = 'Se requiere conexión segura HTTPS';
            errorInfo.solutions = [
                'Usa el servidor HTTPS: https://localhost:8443/index.html',
                'Accede desde https://[TU_IP]:8443/index.html',
                'Acepta la advertencia de certificado',
                'No uses http:// o file://'
            ];
        }

        const technicalInfo = `Error: ${error.name || 'Desconocido'} - ${error.message || 'Sin mensaje'}`;
        this.displayCameraError(errorInfo.message, errorInfo.solutions, error, technicalInfo);
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
        
        // Detener stream actual con limpieza adecuada
        await this.cleanupCameraStream();
        
        // Reintentar con nueva cámara
        await this.initializeCamera();
    }

    async cleanupCameraStream() {
        if (this.cameraStream) {
            try {
                // Detener todos los tracks del stream
                this.cameraStream.getTracks().forEach(track => {
                    if (track.readyState === 'live') {
                        track.stop();
                    }
                });
                
                // Limpiar referencia del video
                if (this.video && this.video.srcObject === this.cameraStream) {
                    this.video.srcObject = null;
                }
                
                this.cameraStream = null;
                console.log('Camera stream cleaned up successfully');
            } catch (error) {
                console.error('Error cleaning up camera stream:', error);
            }
        }
    }

    updateCameraIndicator() {
        const isFront = this.currentCamera === 'user';
        this.cameraType.textContent = isFront ? '🤱 Frontal' : '📷 Trasera';
        this.cameraType.className = `badge ${isFront ? 'bg-danger' : 'bg-primary'}`;
    }

    /* =============================================
       CONTROL DE ZOOM DE CÁMARA
       ============================================= */

    zoomCamera(factor) {
        this.cameraZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.cameraZoom + factor));
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
            if (!videoTrack) {
                console.warn('No video track found for zoom');
                this.applyDigitalZoom();
                return;
            }

            // Verificar si el track soporta zoom
            const capabilities = videoTrack.getCapabilities();
            const settings = videoTrack.getSettings();
            
            if (capabilities && capabilities.zoom) {
                // Aplicar zoom nativo si está disponible
                const currentConstraints = {
                    width: settings.width,
                    height: settings.height,
                    facingMode: this.currentCamera
                };
                
                // Agregar zoom a las restricciones
                const constraints = {
                    video: {
                        ...currentConstraints,
                        zoom: this.cameraZoom
                    }
                };
                
                try {
                    // Aplicar nuevas restricciones
                    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
                    
                    // Limpiar stream anterior
                    await this.cleanupCameraStream();
                    
                    // Reemplazar con nuevo stream
                    this.cameraStream = newStream;
                    this.video.srcObject = newStream;
                    
                    this.showStatus(`Zoom cámara: ${Math.round(this.cameraZoom * 100)}% (nativo)`, 'info');
                } catch (constraintError) {
                    console.warn('Error applying zoom constraints:', constraintError);
                    this.applyDigitalZoom();
                    this.showStatus(`Zoom cámara: ${Math.round(this.cameraZoom * 100)}% (digital)`, 'info');
                }
            } else {
                // Fallback: zoom digital (simulado)
                this.applyDigitalZoom();
                this.showStatus(`Zoom cámara: ${Math.round(this.cameraZoom * 100)}% (digital)`, 'info');
            }
        } catch (error) {
            console.log('Error aplicando zoom:', error);
            this.applyDigitalZoom();
            this.showStatus(`Zoom cámara: ${Math.round(this.cameraZoom * 100)}% (digital)`, 'info');
        }
    }

    applyDigitalZoom() {
        // Zoom digital simulado con transform CSS
        const scaleFactor = this.cameraZoom;
        
        // Aplica transformación CSS para simular zoom óptico
        this.video.style.transform = `scale(${scaleFactor})`;
        this.video.style.transformOrigin = 'center center';
        this.video.style.objectFit = 'cover';
        
        // Ajusta el contenedor si es necesario
        const container = this.video.parentElement;
        if (container) {
            container.style.overflow = 'hidden';
        }
    }

    displayCameraError(message, solutions, error, technicalInfo) {
        const solutionsHtml = solutions.map(solution => `<li>• ${solution}</li>`).join('');
        
        const errorHtml = `
            <div class="alert alert-danger d-flex flex-column align-items-center" role="alert">
                <h5 class="alert-heading"><i class="bi bi-camera-video-off me-2"></i> ${message}</h5>
                <p class="mb-2"><strong>Error:</strong> ${error.name || 'Desconocido'}</p>
                <div class="code-block mb-3">
                    <code>${technicalInfo}</code>
                </div>
                <div class="solutions-list mb-3">
                    <h6><i class="bi bi-lightbulb me-2"></i> Soluciones:</h6>
                    <ul class="list-unstyled">
                        ${solutionsHtml}
                    </ul>
                </div>
                <div class="d-flex gap-2 justify-content-center flex-wrap">
                    <button class="btn btn-primary" onclick="location.reload()">
                        <i class="bi bi-arrow-clockwise me-2"></i> Recargar Página
                    </button>
                    <button class="btn btn-secondary" onclick="navigator.mediaDevices.getUserMedia({video: true}).then(() => location.reload()).catch(e => console.log(e))">
                        <i class="bi bi-camera-video me-2"></i> Verificar Cámara
                    </button>
                </div>
                <p class="mt-3 mb-0 text-muted small">
                    <i class="bi bi-info-circle me-2"></i> Puedes seguir usando la aplicación para cargar y ajustar imágenes sin cámara.
                </p>
                <details class="mt-3">
                    <summary class="btn btn-outline-secondary btn-sm">
                        <i class="bi bi-gear me-2"></i> Información técnica
                    </summary>
                    <div class="code-block mt-2">
                        <pre class="mb-0">Navegador: ${navigator.userAgent}
Protocolo: ${location.protocol}
Hostname: ${location.hostname}
HTTPS: ${location.protocol === 'https:' ? '✅' : '❌'}
getUserMedia: ${navigator.mediaDevices ? '✅' : '❌'}
Error completo: ${JSON.stringify(error, null, 2)}</pre>
                    </div>
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

        // Validación de tipo de archivo
        if (!file.type.startsWith('image/')) {
            this.showStatus('Por favor, selecciona un archivo de imagen válido', 'error');
            this.clearFileInput();
            return;
        }

        // Validación de tamaño (máximo 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.showStatus('El archivo es demasiado grande. Máximo 10MB', 'error');
            this.clearFileInput();
            return;
        }

        // Validación de tipos de imagen permitidos
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            this.showStatus('Tipo de imagen no soportado. Usa JPEG, PNG, GIF o WebP', 'error');
            this.clearFileInput();
            return;
        }

        // Procesar directamente sin validación estricta
        this.processImageFile(file);
    }

    processImageFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.overlayImage = img;
                this.resetPosition();
                this.renderOverlay();
                this.showStatus('Imagen cargada correctamente', 'success');
                
                // Mostrar hint de gestos
                this.gestureHint.classList.remove('d-none');
                setTimeout(() => {
                    this.gestureHint.classList.add('d-none');
                }, 3000);
            };
            img.onerror = () => {
                this.showStatus('Error al cargar la imagen', 'error');
                this.clearFileInput();
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            this.showStatus('Error al leer el archivo', 'error');
            this.clearFileInput();
        };
        reader.readAsDataURL(file);
    }

    clearFileInput() {
        const fileInput = document.getElementById('imageUpload');
        if (fileInput) {
            fileInput.value = '';
        }
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
                    this.renderOverlay();
                } else {
                    // Si no hay imagen, hacer zoom a la cámara
                    this.cameraZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.initialCameraZoom * scaleRatio));
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
       RENDERIZADO Y UTILIDADES
       ============================================= */

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Resetear posición al centro
        this.position = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    }

    renderOverlay() {
        // Throttle rendering para mejor rendimiento
        const now = performance.now();
        if (this.renderPending || (now - this.lastRenderTime) < this.renderThrottleDelay) {
            if (!this.renderPending) {
                this.renderPending = true;
                requestAnimationFrame(() => {
                    this.performRender();
                    this.renderPending = false;
                    this.lastRenderTime = performance.now();
                });
            }
            return;
        }
        
        this.performRender();
        this.lastRenderTime = now;
    }

    performRender() {
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

        // Center image at position
        this.ctx.drawImage(
            this.overlayImage,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
        );

        this.ctx.restore();
    }

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
        const alertClass = type === 'error' ? 'alert-danger' : type === 'success' ? 'alert-success' : 'alert-info';
        const icon = type === 'error' ? 'bi-exclamation-triangle-fill' : type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill';
        
        this.statusMessage.innerHTML = `
            <div class="alert ${alertClass} d-flex align-items-center" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2000; min-width: 300px;" role="alert">
                <i class="bi ${icon} me-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Auto-ocultar para mensajes que no sean de error
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

// Initialize application when DOM is loaded
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
