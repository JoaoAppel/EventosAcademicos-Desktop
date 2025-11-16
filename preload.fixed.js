const { contextBridge, ipcRenderer } = require('electron');

// Expose selected main-world APIs
contextBridge.exposeInMainWorld('desktop', {
  getSetting: (k, f)=> ipcRenderer.invoke('settings:get', k, f),
  setSetting: (k, v)=> ipcRenderer.invoke('settings:set', k, v),
  serialList: ()=> ipcRenderer.invoke('serial:list'),
  serialOpen: (path, baud)=> ipcRenderer.invoke('serial:open', path, baud),
  serialClose: ()=> ipcRenderer.invoke('serial:close'),
  onSerialData: (cb)=> ipcRenderer.on('serial:data', (_, d)=> cb(d)),
  onSerialError: (cb)=> ipcRenderer.on('serial:error', (_, d)=> cb(d)),
  saveFile: (defaultPath, bufferBase64)=> ipcRenderer.invoke('fs:save-dialog', defaultPath, bufferBase64),
  // nodeFetch: performs a fetch from the preload (Node) context to bypass renderer CORS restrictions.
  // Returns a plain object with { ok, status, statusText, headers, body, url } or { error } on failure.
  nodeFetch: async (url, options) => {
    try {
      // Use global fetch available in Node/Electron preload. Options is a plain object.
      const res = await fetch(url, options || {});
      const text = await res.text();
      const headers = {};
      try { res.headers.forEach((v,k)=> headers[k]=v); } catch(e) {}
      return { ok: res.ok, status: res.status, statusText: res.statusText, headers, body: text, url: res.url };
    } catch (err) {
      return { error: String(err) };
    }
  },
});

// Expose bundled libraries from node_modules to renderer (vendor globals)
// These are small shims so renderer code can use window.idbKeyval, window.XLSX, window.jspdf, window.jsQR
if (typeof require === 'function') {
  try {
    const path = require('path');
    let idbKeyval = null;
    try {
      idbKeyval = require('idb-keyval');
    } catch (e1) {
      try { idbKeyval = require(path.join(__dirname, 'node_modules', 'idb-keyval', 'dist', 'compat.cjs')); } catch(e2){
        try { idbKeyval = require(path.join(__dirname, 'node_modules', 'idb-keyval', 'dist', 'index.cjs')); } catch(e3) {
          idbKeyval = null;
        }
      }
    }

    let XLSXlib = null;
    try { XLSXlib = require('xlsx'); } catch (e) {
      try { XLSXlib = require(path.join(__dirname, 'node_modules', 'xlsx')); } catch(e2) { XLSXlib = null; }
    }

    let jspdfLib = null;
    try { jspdfLib = require('jspdf'); } catch (e) {
      try { jspdfLib = require(path.join(__dirname, 'node_modules', 'jspdf')); } catch(e2) { jspdfLib = null; }
    }

    let jsQRlib = null;
    try { jsQRlib = require('jsqr'); } catch (e) {
      try { jsQRlib = require(path.join(__dirname, 'node_modules', 'jsqr')); } catch(e2) { jsQRlib = null; }
    }

    // Expose each module as a global in the renderer (only when available)
    if (idbKeyval) contextBridge.exposeInMainWorld('idbKeyval', idbKeyval);
    if (XLSXlib) contextBridge.exposeInMainWorld('XLSX', XLSXlib);
    if (jspdfLib) contextBridge.exposeInMainWorld('jspdf', jspdfLib);
    if (jsQRlib) contextBridge.exposeInMainWorld('jsQR', jsQRlib);
    // Expose Buffer for browser code that expects it
    contextBridge.exposeInMainWorld('Buffer', Buffer);
  } catch (e) {
    console.warn('preload.fixed: could not require vendor libs:', e && e.message);
  }
} else {
  console.warn('preload.fixed: require is not available in this context; vendor libs not exposed');
}
