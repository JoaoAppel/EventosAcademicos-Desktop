
# Events Desktop

Aplicativo Desktop (Electron) para Portaria e Relatórios do **Events Backend**.

## Recursos
- Login na API (`/auth/login`) com `{{tenant}}`.
- Portaria:
  - Scanner via **webcam** (QR com jsQR).
  - Scanner via **serial** (leitor USB/Serial).
  - Check-in / Check-out (`/gate/scan`).
  - **Offline** com fila e **sincronização** via `/gate/bulk`.
- Relatórios:
  - Carrega presença via `/attendance`.
  - Exporta **CSV**, **XLSX**, **PDF**.
- Configurações: beep, path de export, deviceId.

## Requisitos
- Node 18+
- Backend rodando em `https://events-backend-zug5.onrender.com/docs#/` (ajustável nas Configurações).

## Rodando
```bash
npm install
npm run dev
```

## Build (MSI/DMG/AppImage)
```bash
npm run dist
```

## Observações
- Este app trabalha 100% via API existente.
- Caso o backend implemente `/auth/refresh`, o app já tenta refresh automático.
- Para QR dinâmico: o app lê **qr_token** e envia com `day_event_id`, `action` e `device_id`.
# EventosAcademicos-Desktop