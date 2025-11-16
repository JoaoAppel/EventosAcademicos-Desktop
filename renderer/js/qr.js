

// Uses getUserMedia + jsQR
async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio:false });
  videoEl.srcObject = stream;
  await videoEl.play();
  
  // Wait for video to be ready before returning
  return new Promise((resolve) => {
    videoEl.onloadedmetadata = () => {
      console.log('Camera ready, video size:', videoEl.videoWidth, 'x', videoEl.videoHeight);
      resolve(stream);
    };
  });
}

async function stopCamera(videoEl) {
  const stream = videoEl.srcObject;
  if (stream) stream.getTracks().forEach(t=>t.stop());
  videoEl.srcObject = null;
}

async function scanLoop(videoEl, canvasEl, onCode) {
  const jsQRLib = (typeof window !== 'undefined' && window.jsQR) ? window.jsQR : null;
  if (!jsQRLib) {
    console.warn('scanLoop: jsQR library not available (window.jsQR). QR scanning disabled.');
    return;
  }
  
  // Wait for video to be ready
  await new Promise((resolve) => {
    if (videoEl.videoWidth > 0) {
      resolve();
    } else {
      const checkReady = setInterval(() => {
        if (videoEl.videoWidth > 0) {
          clearInterval(checkReady);
          resolve();
        }
      }, 100);
    }
  });

  const ctx = canvasEl.getContext('2d');
  const lastScans = [];
  let lastScanTime = 0;
  
  const loop = async () => {
    if (!videoEl.srcObject) return;
    
    // Update canvas size to match video
    if (canvasEl.width !== videoEl.videoWidth || canvasEl.height !== videoEl.videoHeight) {
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
    }
    
    try {
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      const code = jsQRLib(imageData.data, imageData.width, imageData.height);
      
      if (code && code.data) {
        const now = Date.now();
        // Avoid duplicate scans within 1 second
        if (now - lastScanTime > 1000) {
          console.log('QR Code detected:', code.data);
          onCode(code.data);
          lastScanTime = now;
        }
      }
    } catch (e) {
      console.error('Error in QR scan loop:', e);
    }
    
    requestAnimationFrame(loop);
  };
  
  loop();
}

