# Quick Testing Guide

## Prerequisites

1. **Backend Running**: Verify `https://events-backend-zug5.onrender.com/docs` is accessible
2. **Electron App**: Run `npm run dev` from the project root
3. **DevTools**: Press F12 to open developer console for debugging

## Step 1: Login & Initial Setup

1. Open the Events Desktop application
2. Enter configuration:
   - **Base URL**: `https://events-backend-zug5.onrender.com`
   - **Tenant**: `demo` (or your test tenant)
   - **Email**: `admin@demo` (or valid admin email)
   - **Password**: `admin123` (or valid password)
3. Click **Login**
4. Verify success message in console: `addLog('login', 'sucesso', true)`

## Step 2: Test Events Module

### List Events
1. Click **Eventos** tab
2. Verify events table loads with columns: Título, Data início, Capacidade, Local
3. Check browser console - should see `GET /api/v1/demo/events` call

### Create Event
1. Click **+ Novo** button
2. Fill form:
   - **Título**: "Test Event 2024"
   - **Descrição**: "Testing event creation"
   - **Local**: "Room 101"
   - **Data início**: 2024-12-20
   - **Data fim**: 2024-12-22
   - **Capacidade**: 100
3. Click **Salvar**
4. Verify:
   - Toast notification appears
   - Console shows: `addLog('evento', 'criado', true)`
   - New event appears in table

### Edit Event
1. Click **Editar** button on any event
2. Modify title and capacity
3. Click **Salvar**
4. Verify:
   - Console shows: `addLog('evento', 'atualizado', true)`
   - Changes reflected in table

## Step 3: Test Students Module

### Create Student (via Enrollments)
1. Click **Inscrições** tab
2. Click **+ Inscrição**
3. Fill form:
   - **Evento**: Select from dropdown
   - **Aluno** (Email): `student@example.com`
   - **Nome**: John Doe
   - **CPF**: `12345678901`
4. Click **Salvar**
5. Verify:
   - If student doesn't exist, created automatically
   - Console shows: `addLog('inscricao', 'criada', true)`
   - New enrollment appears in table

### View Enrollments
1. Verify enrollments table shows:
   - Student Name
   - Email
   - Event Title
   - Status (pending/confirmed)
   - Created Date
2. Try **Filtrar evento** search - should filter by event or student name

### Confirm Enrollment
1. Click **Confirmar** button on pending enrollment
2. Verify:
   - Console shows: `addLog('inscricao', 'confirmada', true)`
   - Button becomes disabled
   - Status changes to "confirmed"

## Step 4: Test Portaria (Gate) Module

### QR Code Scanning
1. Click **Portaria** tab
2. Verify sections:
   - Webcam video element
   - Action selector (checkin/checkout)
   - Attendance log table
3. Generate QR code for enrollment ID (optional testing tool available)
4. Point webcam at QR code
5. Verify:
   - Canvas shows video frame
   - QR decoded successfully
   - Entry added to attendance log
   - Toast notification: "Checkin realizado" or similar

### Serial Port Input (if hardware available)
1. If serial scanning device connected:
   - Select port from dropdown
   - Scan barcode with serial device
   - Data should appear in attendance log

### Offline Queue
1. Close internet connection
2. Perform gate scans
3. Verify data queued in IndexedDB (DevTools > Application > Storage > IndexedDB)
4. Restore internet connection
5. Button appears: "Sincronizar" or similar
6. Queue flushed to server

## Step 5: Test Relatórios (Reports)

1. Click **Relatórios** tab
2. Verify:
   - Attendance table loads (empty if no checkins yet)
   - Columns: Data, Aluno, Evento, Status
3. Try filter options (if implemented)
4. Test export buttons:
   - **CSV** → Downloads file
   - **XLSX** → Downloads file
   - **PDF** → Generates report

## Step 6: Test Settings

1. Click **Configurações** tab
2. Verify options:
   - Sound toggle (default: on)
   - Export path selector
3. Enable sound and play a beep test
4. Verify settings persist after app restart

## Debugging Tips

### Console Logs
```javascript
// View all API calls
console.log(api.cfg)  // Current config

// View stored tokens
await window.desktop.getSetting('accessToken')
await window.desktop.getSetting('refreshToken')

// Manually test API
api.listEventos().then(e => console.log(e))
api.listStudents().then(s => console.log(s))
api.listInscricoes().then(i => console.log(i))
```

### Common Errors & Fixes

| Error | Solution |
|-------|----------|
| 404 Not Found | Verify endpoint path matches OpenAPI spec |
| 401 Unauthorized | Re-login, check token refresh logic |
| CORS Error | App falls back to nodeFetch automatically |
| Missing Field | Check field name mapping (title vs titulo, etc.) |
| Template Not Found | Check template ID in DevTools Inspector |

### Network Inspector

1. Press F12 → Network tab
2. Filter by XHR/Fetch
3. Watch API calls:
   - Check request path (should match `/events`, `/enrollments`, etc.)
   - Check response status (200 = success, 4xx = client error, 5xx = server error)
   - Check response body for error messages

## Expected API Calls

### On Login
```
POST /api/v1/demo/auth/login
Response: { access_token, refresh_token, ... }
```

### On Events Load
```
GET /api/v1/demo/events
Response: [ { id, title, venue, capacity_total, start_at, end_at }, ... ]
```

### On Enrollment Create
```
POST /api/v1/demo/students
Request: { name, cpf, email, ... }
Response: { id, name, cpf, email, ... }

POST /api/v1/demo/events/{event_id}/enroll?student_id={id}
Response: { id, status, student, event, ... }
```

### On Gate Scan
```
POST /api/v1/demo/gate/scan
Request: { enrollment_id, day_event_id, action: "checkin" }
Response: { ... }
```

## Performance Notes

- App uses IndexedDB for offline queue (good for intermittent connectivity)
- QR scanning should complete in < 2 seconds per code
- List operations paginated (if backend supports page/page_size params)
- Token refresh automatic on 401 responses

## Success Indicators

✅ All buttons show toast notifications  
✅ Tables populate with real backend data  
✅ CRUD operations (Create, Read, Update) work  
✅ Forms validate and show errors  
✅ App handles offline gracefully  
✅ Console shows no 404 errors  
✅ Settings persist across app restart  

## Support

For issues during testing:
1. Check browser console (F12)
2. Verify backend is running
3. Check OpenAPI docs for endpoint structure
4. Review API_RECONCILIATION.md for field name mappings
