# Camera Overlay Application Plan

Create a self-contained HTML application that enables users to overlay images from their device onto a live camera feed with adjustable opacity and size controls.

## Key Features
- **Camera Access**: Request and display live camera feed using getUserMedia API
- **Image Upload**: File input to select images from device storage
- **Overlay System**: Superimpose uploaded image over camera feed using CSS positioning
- **Opacity Control**: Slider to adjust transparency of overlay image (0-100%)
- **Size Control**: Slider to adjust scale of overlay image (25-200%)
- **Position Control**: Drag-and-drop functionality to position overlay image
- **Reset Controls**: Buttons to reset opacity, size, and position to defaults

## Technical Implementation
- **HTML Structure**: Semantic layout with video element for camera, canvas for overlay, and control panel
- **CSS Styling**: Modern design using flexbox/grid, responsive layout, smooth transitions
- **JavaScript Logic**: 
  - MediaDevices API for camera access
  - FileReader API for image loading
  - Canvas manipulation for overlay rendering
  - Event handlers for controls and drag functionality
  - Error handling for camera permissions

## UI Components
- Camera preview area with overlay capability
- Control panel with sliders for opacity and size
- File upload button with modern styling
- Reset and clear buttons
- Status messages for user feedback

## File Structure
Single HTML file containing all HTML, CSS, and JavaScript code for portability.
