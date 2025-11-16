/*
  Nota: As bibliotecas jsQR, xlsx, jspdf, idb-keyval são dependências NPM.
  Quando você rodar `npm install` elas serão resolvidas e disponíveis via globais (através de window.XLSX, window.jspdf, window.idbKeyval)
  pois o index.html usa bundles de node_modules via require interno do Electron (preload disponibiliza global).
  Caso prefira usar CDNs no index.html, substitua pelos builds UMD.
*/