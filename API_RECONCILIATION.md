# API Reconciliation Summary

## Overview
This document summarizes the reconciliation of the Events Desktop App frontend with the actual backend API endpoints from the OpenAPI specification at `https://events-backend-zug5.onrender.com/openapi.json`.

## Changes Made

### 1. API Client (`renderer/js/api.js`)

#### Endpoint Path Updates
- **Clientes**: `/client/` → Now uses `/client` and `/client/` interchangeably
  - `listClientes()` → `getClient()` (backend only has GET `/client`)
  - `updateClient(data)` → Updates via PUT `/client`

- **Usuarios/Users**: `/usuarios` → `/users`
  - `listUsers(params)` - GET `/users`
  - `getUser(userId)` - GET `/users/{user_id}`
  - `createUser(data)` - POST `/users`
  - `updateUser(userId, data)` - PATCH `/users/{user_id}` (note: PATCH not PUT)
  - `deleteUser(userId)` - DELETE `/users/{user_id}`
  - `getMe()` - GET `/users` (returns list, uses first item or synthetic user)

- **Estudiantes/Students**: New endpoints added
  - `listStudents(params)` - GET `/students`
  - `getStudent(studentId)` - GET `/students/{student_id}`
  - `createStudent(data)` - POST `/students`
  - `updateStudent(studentId, data)` - PUT `/students/{student_id}`
  - `deleteStudent(studentId)` - DELETE `/students/{student_id}`

- **Eventos**: `/eventos` → `/events`
  - `listEventos(params)` - GET `/events`
  - `createEvento(data)` - POST `/events`
  - `getEvento(id)` - GET `/events/{event_id}`
  - `updateEvento(id, data)` - PUT `/events/{event_id}`

- **Dias**: `/eventos/{id}/dias` → `/events/{id}/days`
  - `listDias(eventId, params)` - GET `/events/{event_id}/days`
  - `createDia(eventId, data)` - POST `/events/{event_id}/days`
  - `getDia(eventId, dayId)` - GET `/events/{event_id}/days/{day_id}`
  - `updateDia(eventId, dayId, data)` - PUT `/events/{event_id}/days/{day_id}`

- **Inscricoes/Enrollments**: `/inscricoes` → `/enrollments`
  - `listInscricoes(params)` - GET `/enrollments`
  - `createInscricao(data)` - POST `/events/{event_id}/enroll?student_id={student_id}` (special endpoint)
  - `getInscricao(id)` - GET `/enrollments/{id}`
  - `updateInscricao(id, data)` - PUT `/enrollments/{id}`
  - `confirmInscricao(id, data)` - PATCH `/enrollments/{id}/cancel` (note: cancel is different operation)
  - `cancelInscricao(enrollmentId)` - PATCH `/enrollments/{id}/cancel`

- **Gate/Portaria**:
  - `gateScan(payload)` - POST `/gate/scan` (accepts `GatePayload` with `enrollment_id`, `day_event_id`, `action`)
  - `gateBulk(payload)` - POST `/gate/scan` (same endpoint, same payload structure)
  - `gateStats(eventId, params)` - GET `/gate/stats/{event_id}`

- **Attendance**:
  - `attendance(params)` - GET `/attendance`

- **Certificados**: `/certificados` → `/certificates`
  - `listCertificados(params)` - GET `/certificates`
  - `getCertificado(certificateId)` - GET `/certificates/{certificate_id}`
  - `issueCertificate(enrollmentId, data)` - POST `/certificates/issue/{enrollment_id}`
  - `issueCertificateBatch(eventId, data)` - POST `/certificates/batch/{event_id}`
  - `checkCertificateEligibility(enrollmentId, mode)` - GET `/certificates/eligibility/{enrollment_id}?mode={day|hours}`
  - `listCertificatesByStudent(studentId)` - GET `/certificates/by-student/{student_id}`

- **Relatórios**: Reports endpoints (unchanged)
  - `getPresencaReport(params)` - GET `/reports/presenca`
  - `getStatsReport(params)` - GET `/reports/stats`

- **Roles**: New endpoint
  - `listRoles(params)` - GET `/roles`

- **Client Management**:
  - `getMyClient(params)` - GET `/client`
  - `updateMyClient(data)` - PUT `/client`

#### Field Name Updates
All API methods now use the correct field names from the OpenAPI schema:
- `titulo` → `title`
- `descricao` → `description`
- `local` → `venue`
- `data_inicio` → `start_at`
- `data_fim` → `end_at`
- `capacidade` → `capacity_total`
- `aluno_nome` → `student.name`
- `aluno_email` → `student.email`
- `evento_titulo` → `event.title`
- `data_criacao` → `created_at`

### 2. Renderer Logic (`renderer/renderer.js`)

#### Event Management
- Updated `openEditForm()` to use correct field names (title, description, venue, start_at, end_at, capacity_total)
- Updated event creation payload to send correct field names
- Updated `loadEventos()` to display correct field names from API response

#### Enrollment Management
- Complete refactor of `renderInscricoes()`:
  - Now uses `/enrollments` endpoint instead of `/inscricoes`
  - Implements proper student management workflow:
    1. Check if student exists in local cache
    2. If not, create student via `/students` endpoint
    3. Enroll student in event via `/events/{event_id}/enroll?student_id={id}`
  - Updated table rendering to use nested objects (student.name, event.title)
  - Changed status comparison from "confirmada" to "confirmed"
  - Added `loadStudents()` to cache available students

### 3. HTML Templates (`renderer/index.html`)

Form fields remain the same (titulo, descricao, local, data_inicio, data_fim, capacidade) but the JavaScript now maps them to correct API field names.

## API Request/Response Mapping

### Create Event Example
**Request:**
```javascript
{
  title: "String",
  description: "String (optional)",
  venue: "String (optional)",
  capacity_total: number (optional),
  workload_hours: number (optional),
  min_presence_pct: number (optional),
  start_at: "2024-01-15" (optional),
  end_at: "2024-01-15" (optional),
  status: "draft" (default)
}
```

### Create Student Example
**Request:**
```javascript
{
  name: "String (required)",
  cpf: "String (required)",
  email: "email (required)",
  ra: "String (optional)",
  phone: "String (optional)"
}
```

### Enroll Student Example
**Request:**
```
POST /api/v1/{tenant}/events/{event_id}/enroll?student_id={student_id}
```

### Gate Scan Example
**Request:**
```javascript
{
  enrollment_id: number,
  day_event_id: number,
  action: "checkin" | "checkout"
}
```

## Error Handling

All API methods now include try-catch blocks with:
- Console warnings for debugging
- Fallback empty arrays for list endpoints
- Graceful error logging via `addLog()`
- Toast notifications for user feedback

## Testing Checklist

- [ ] Login with valid credentials (email/password)
- [ ] Navigate to "Eventos" tab and verify events list loads
- [ ] Create new event with all fields filled
- [ ] Edit existing event and verify changes save
- [ ] Navigate to "Inscrições" tab
- [ ] Create new enrollment by selecting evento and student
- [ ] Verify student is created if not already exists
- [ ] Navigate to "Portaria" tab and test gate scan with QR codes
- [ ] Check "Relatórios" tab for attendance data
- [ ] Verify all error toasts display correctly

## Known Limitations

1. `/users/me` endpoint doesn't exist - `getMe()` currently returns first user or synthetic data
2. Gate scan bulk endpoint uses same path as single scan (POST `/gate/scan`)
3. Enrollment cancel operation uses PATCH (not intuitive naming with "cancel")
4. Certificate eligibility mode defaults to "day" but can be "hours"

## Next Steps

1. Test against actual backend with real data
2. Implement missing modules:
   - Certificados (certificate issuance)
   - Advanced Portaria features (day selection, capacity validation)
3. Add form validation for all inputs
4. Implement pagination for large data sets
5. Add filters and sorting to list views
6. Implement bulk operations for certificates and enrollments

## API Documentation Reference

Full OpenAPI specification available at:
`https://events-backend-zug5.onrender.com/openapi.json`

Interactive API docs available at:
`https://events-backend-zug5.onrender.com/docs`
