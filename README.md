# Events Desktop

**Events Desktop** é uma aplicação de desktop multiplataforma, construída com Electron, para gerenciar eventos acadêmicos. Ela atua como um cliente para o backend [Events API](https://events-backend-zug5.onrender.com), oferecendo funcionalidades de portaria, relatórios e gerenciamento de certificados de forma prática e com suporte offline.

---

## ✨ Funcionalidades Principais

-   **Login Seguro**: Conexão autenticada com a API do backend, utilizando um sistema de `tenant` para multilocação.
-   **Gerenciamento de Eventos**: Visualização e edição de eventos cadastrados.
-   **Gerenciamento de Inscrições**: Lista e confirmação de inscrições de alunos nos eventos.
-   **Portaria (Gate Control)**:
    -   Check-in e check-out em tempo real através da leitura de QR Code.
    -   Suporte para múltiplos dispositivos de leitura: Webcam e Leitor Serial.
    -   **Suporte Offline**: Os registros de check-in/check-out são salvos localmente caso não haja conexão com a internet e podem ser sincronizados posteriormente.
-   **Relatórios de Presença**:
    -   Geração de relatórios detalhados de presença por evento e por dia.
    -   Exportação dos relatórios para os formatos **CSV**, **XLSX** e **PDF**.
-   **Emissão de Certificados**:
    -   Verificação de elegibilidade dos participantes com base na porcentagem de presença.
    -   Emissão de certificados em lote para os participantes elegíveis.
-   **Configurações**: Ajustes de preferências da aplicação, como a ativação de sons e configuração de caminhos para exportação.

---

## 🚀 Tecnologias Utilizadas

-   **Framework**: Electron
-   **Frontend**: HTML5, CSS3, JavaScript (Vanilla JS)
-   **Comunicação com API**: `axios` (via `fetch` e fallback para `node-fetch` no processo principal)
-   **Armazenamento Offline**: `idb-keyval` (utilizando IndexedDB)
-   **Leitura de QR Code**: `jsqr` (para webcam)
-   **Comunicação Serial**: `serialport` (para leitores de QR Code via porta serial)
-   **Exportação de Arquivos**:
    -   `xlsx` para planilhas Excel.
    -   `jspdf` para documentos PDF.
-   **Persistência de Configurações**: `electron-store`

---

## 📂 Estrutura do Projeto

```
EventosAcademicos-Desktop-main/
├── main.js               # Processo principal do Electron (backend)
├── preload.js            # Script que expõe APIs do Node.js ao renderer de forma segura
├── package.json          # Dependências e scripts do projeto
├── renderer/             # Pasta com todo o código do frontend
│   ├── index.html        # Arquivo HTML principal com as "templates" de cada tela
│   ├── renderer.js       # Lógica principal da interface (renderer process)
│   ├── styles.css        # Folha de estilos da aplicação
│   └── js/
│       ├── api.js        # Módulo para todas as chamadas à API backend
│       ├── offline.js    # Lógica para a fila de sincronização offline
│       └── qr.js         # Funções para controle da câmera e leitura de QR Code
└── build/                # Recursos para o build (ícones, etc.)
```

---

## ⚙️ Como Executar

### Pré-requisitos

-   Node.js (versão 18 ou superior)
-   NPM (geralmente instalado com o Node.js)

### Passos

1.  **Clone o repositório:**
    ```bash
    git clone <url-do-seu-repositorio>
    cd EventosAcademicos-Desktop-main
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Inicie a aplicação em modo de desenvolvimento:**
    ```bash
    npm start
    ```

---

## 📦 Como Empacotar e Distribuir

O projeto utiliza o `electron-builder` para gerar os instaladores.

1.  **Para empacotar sem criar um instalador (útil para testes):**
    ```bash
    npm run pack
    ```
    Isso criará uma pasta `dist/` com o executável da aplicação para o seu sistema operacional.

2.  **Para criar os distribuíveis/instaladores:**
```bash
npm run dist
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