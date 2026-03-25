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
        this.currentCameraIndex = 0; // Índice de la cámara activa dentro de availableCameras
        this.cameraZoom = 1; // Zoom de la cámara
        this.maxZoom = 10; // Zoom máximo permitido
        this.minZoom = 0.1; // Por debajo de 1x se aplica zoom out digital (reducción del cuadro)
        this.settingsOpen = false;
        
        // Throttling para renderizado
        this.renderPending = false;
        this.lastRenderTime = 0;
        this.renderThrottleDelay = 16; // ~60fps
        
        // Inicialización
        this.initializeControls();
        this.checkCameraSupport();
        // enumerateDevices debe completarse antes de initializeCamera para usar deviceId
        this.enumerateDevices().then(() => {
            this.initializeCamera();
        });
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
            this.zoomCamera(0.1);
        });

        document.getElementById('cameraZoomOutBtn').addEventListener('click', () => {
            this.zoomCamera(-0.1);
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
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Navigator no soporta getUserMedia');
            }
            if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                throw new Error('Se requiere HTTPS para acceso a cámara');
            }

            const targetDevice = this.availableCameras[this.currentCameraIndex];
            let stream = null;

            if (targetDevice && targetDevice.deviceId) {
                // Caso normal: abrir por deviceId exacto
                this.showStatus(`Abriendo ${targetDevice.label || `Cámara ${this.currentCameraIndex + 1}`}...`, 'info');
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: { exact: targetDevice.deviceId } }
                    });
                } catch (e) {
                    console.warn('No se pudo abrir por deviceId, intentando sin exact:', e.message);
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            video: { deviceId: targetDevice.deviceId }
                        });
                    } catch (e2) {
                        console.warn('Segundo intento fallido:', e2.message);
                    }
                }
            }

            // Fallback final: pedir cualquier cámara trasera o la que sea
            if (!stream) {
                this.showStatus('Fallback: buscando cualquier cámara trasera...', 'info');
                const fallbacks = [
                    { video: { facingMode: { ideal: 'environment' } } },
                    { video: { facingMode: 'environment' } },
                    { video: true }
                ];
                for (const c of fallbacks) {
                    try { stream = await navigator.mediaDevices.getUserMedia(c); break; }
                    catch (e) { /* continuar */ }
                }
            }

            if (!stream) throw new Error('No se pudo obtener stream de ninguna cámara');

            this.cameraStream = stream;
            this.video.srcObject = stream;
            this.cameraZoom = 1;
            this.video.style.transform = '';
            this.video.style.transformOrigin = '';

            this.video.onloadedmetadata = () => {
                this.resizeCanvas();
                this.updateCameraIndicator();
                this.showStatus('Cámara iniciada correctamente', 'success');
            };
            this.video.onerror = () => this.showStatus('Error al reproducir video', 'error');

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
            // Paso 1: pedir permiso para que los labels no aparezcan vacíos
            let permStream = null;
            try {
                permStream = await navigator.mediaDevices.getUserMedia({ video: true });
            } catch (e) { /* sin permiso, continuamos */ }
            if (permStream) permStream.getTracks().forEach(t => t.stop());

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');

            // Paso 2: probar cada cámara para obtener facingMode real y capacidades de zoom
            const probed = [];
            for (const device of videoDevices) {
                let facing = 'unknown';
                let zoomCaps = null;
                let fovScore = Infinity; // campo visual estimado: menor = más gran angular
                try {
                    const s = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: { exact: device.deviceId } }
                    });
                    const track = s.getVideoTracks()[0];
                    if (track) {
                        const settings = track.getSettings();
                        facing = settings.facingMode || 'unknown';
                        // Usar zoom mínimo como proxy del campo visual:
                        // zoom.min más bajo → lente más gran angular
                        if (track.getCapabilities) {
                            const caps = track.getCapabilities();
                            if (caps.zoom) {
                                zoomCaps = caps.zoom;
                                fovScore = caps.zoom.min;
                            }
                        }
                    }
                    s.getTracks().forEach(t => t.stop());
                } catch (e) {
                    console.warn(`No se pudo probar "${device.label || device.deviceId}":`, e.message);
                }
                probed.push({ device, facing, zoomCaps, fovScore });
                console.log(
                    `Cámara: "${device.label || device.deviceId}"`,
                    `facing=${facing}`,
                    zoomCaps ? `zoom=${zoomCaps.min}–${zoomCaps.max}` : 'zoom=no'
                );
            }

            // Paso 3: separar traseras y frontales, ordenar cada grupo de gran angular a teleobjetivo
            const rear  = probed.filter(p => p.facing === 'environment')
                                .sort((a, b) => a.fovScore - b.fovScore); // gran angular primero
            const front = probed.filter(p => p.facing === 'user')
                                .sort((a, b) => a.fovScore - b.fovScore);
            const other = probed.filter(p => p.facing === 'unknown');

            // Orden final: traseras (gran angular → tele) → desconocidas → frontales
            const ordered = [...rear, ...other, ...front];
            this.availableCameras = ordered.map(p => p.device);
            this.cameraFacingMap  = new Map(ordered.map(p => [p.device.deviceId, p.facing]));
            this.cameraZoomCapsMap = new Map(ordered.map(p => [p.device.deviceId, p.zoomCaps]));

            // Paso 4: seleccionar por defecto la primera cámara trasera
            const firstRearIdx = ordered.findIndex(p => p.facing === 'environment');
            this.currentCameraIndex = firstRearIdx >= 0 ? firstRearIdx : 0;
            this.currentCamera = firstRearIdx >= 0 ? 'environment' : 'user';

            this.showStatus(`${this.availableCameras.length} cámara(s) detectada(s)`, 'success');
            console.log('Orden final:', ordered.map((p, i) => {
                const caps = p.zoomCaps;
                return `[${i}${i === this.currentCameraIndex ? '*' : ''}] "${p.device.label || p.device.deviceId}" ` +
                       `facing=${p.facing} ` +
                       (caps ? `zoom=${caps.min}–${caps.max}` : 'zoom=no');
            }));
        } catch (error) {
            console.error('Error enumerando dispositivos:', error);
        }
    }

    async switchCamera() {
        if (this.availableCameras.length === 0) {
            this.showStatus('No hay cámaras disponibles', 'error');
            return;
        }

        this.currentCameraIndex = (this.currentCameraIndex + 1) % this.availableCameras.length;
        const cam = this.availableCameras[this.currentCameraIndex];
        const label = cam.label || `Cámara ${this.currentCameraIndex + 1}`;
        const facing = (this.cameraFacingMap && this.cameraFacingMap.get(cam.deviceId)) || 'unknown';
        this.currentCamera = facing === 'user' ? 'user' : 'environment';

        this.showStatus(`Cambiando a: ${label} (${this.currentCameraIndex + 1}/${this.availableCameras.length})`, 'info');

        await this.cleanupCameraStream();
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
        const total = this.availableCameras.length;
        const idx = this.currentCameraIndex + 1;
        const cam = this.availableCameras[this.currentCameraIndex];
        const facing = (cam && this.cameraFacingMap && this.cameraFacingMap.get(cam.deviceId)) || this.currentCamera;
        const isFront = facing === 'user';
        const label = cam ? (cam.label || `Cámara ${idx}`) : (isFront ? 'Frontal' : 'Trasera');
        const shortLabel = label.length > 22 ? label.substring(0, 20) + '…' : label;

        // Mostrar rango de zoom si está disponible
        const zoomCaps = cam && this.cameraZoomCapsMap && this.cameraZoomCapsMap.get(cam.deviceId);
        const zoomInfo = zoomCaps ? ` · zoom ${zoomCaps.min}–${zoomCaps.max}` : '';

        this.cameraType.textContent = `${isFront ? '🤳' : '📷'} ${shortLabel} (${idx}/${total})${zoomInfo}`;
        this.cameraType.className = `badge ${isFront ? 'bg-danger' : 'bg-primary'}`;
    }

    /* =============================================
       CONTROL DE ZOOM DE CÁMARA
       ============================================= */

    zoomCamera(factor) {
        // Redondear a 1 decimal para evitar acumulación de errores de punto flotante
        this.cameraZoom = Math.round(
            Math.max(this.minZoom, Math.min(this.maxZoom, this.cameraZoom + factor)) * 10
        ) / 10;
        this.applyCameraZoom();
    }

    resetCameraZoom() {
        this.cameraZoom = 1;
        this.clearZoomOutStyle();
        this.applyCameraZoom();
        this.showStatus('Zoom reseteado a 1x', 'info');
    }

    async applyCameraZoom() {
        if (!this.cameraStream) return;

        // Zoom out (<1x): siempre digital por reducción del cuadro, independiente del hardware
        if (this.cameraZoom < 1) {
            this.applyZoomOut();
            this.showStatus(`Zoom: ${this.cameraZoom.toFixed(1)}x`, 'info');
            return;
        }

        // Zoom in (>=1x): intentar nativo, fallback a digital
        try {
            const videoTrack = this.cameraStream.getVideoTracks()[0];
            if (!videoTrack) { this.applyDigitalZoom(); return; }

            const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};

            if (capabilities && capabilities.zoom) {
                const hwMin = capabilities.zoom.min;
                const hwMax = capabilities.zoom.max;
                const zoomValue = Math.max(hwMin, Math.min(hwMax, hwMin * this.cameraZoom));
                try {
                    await videoTrack.applyConstraints({ advanced: [{ zoom: zoomValue }] });
                    // Limpiar zoom out por si venía de <1x
                    this.clearZoomOutStyle();
                    this.showStatus(`Zoom: ${this.cameraZoom.toFixed(1)}x (nativo)`, 'info');
                } catch (e) {
                    this.applyDigitalZoom();
                    this.showStatus(`Zoom: ${this.cameraZoom.toFixed(1)}x (digital)`, 'info');
                }
            } else {
                this.applyDigitalZoom();
                this.showStatus(`Zoom: ${this.cameraZoom.toFixed(1)}x (digital)`, 'info');
            }
        } catch (error) {
            this.applyDigitalZoom();
            this.showStatus(`Zoom: ${this.cameraZoom.toFixed(1)}x (digital)`, 'info');
        }
    }

    // Zoom in digital (>=1x): escala el video hacia afuera, el contenedor recorta el desborde
    applyDigitalZoom() {
        this.clearZoomOutStyle();
        this.video.style.transform = `scale(${this.cameraZoom})`;
        this.video.style.transformOrigin = 'center center';
        this.video.style.width = '100%';
        this.video.style.height = '100%';
        this.video.style.objectFit = 'cover';
        this.video.style.position = 'absolute';
        this.video.style.top = '0';
        this.video.style.left = '0';
        const container = this.video.parentElement;
        if (container) {
            container.style.overflow = 'hidden';
            container.style.position = 'relative';
        }
    }

    // Zoom out digital (<1x): reduce el video dentro del contenedor dejando bandas negras
    applyZoomOut() {
        const scale = Math.max(0.1, this.cameraZoom); // nunca menos de 10%
        // Quitar zoom nativo si había
        try {
            const videoTrack = this.cameraStream && this.cameraStream.getVideoTracks()[0];
            if (videoTrack) {
                const caps = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
                if (caps.zoom) {
                    videoTrack.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] }).catch(() => {});
                }
            }
        } catch (e) { /* ignorar */ }

        // Reducir el video dentro del contenedor — el contenedor mantiene su tamaño
        this.video.style.transform = `scale(${scale})`;
        this.video.style.transformOrigin = 'center center';
        this.video.style.width = '100%';
        this.video.style.height = '100%';
        this.video.style.objectFit = 'cover';
        this.video.style.position = 'absolute';
        this.video.style.top = '0';
        this.video.style.left = '0';

        const container = this.video.parentElement;
        if (container) {
            // Fondo negro para las bandas que quedan al reducir
            container.style.backgroundColor = '#000';
            container.style.overflow = 'hidden';
            container.style.position = 'relative';
        }
    }

    // Limpia los estilos aplicados por applyZoomOut sin tocar los de zoom in
    clearZoomOutStyle() {
        this.video.style.transform = '';
        this.video.style.transformOrigin = '';
        const container = this.video.parentElement;
        if (container) container.style.backgroundColor = '';
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
