# API Field Name Mapping Reference

This document provides a quick reference for field name changes between the old API calls and the new reconciled API.

## Event Fields

| Old (Portuguese) | New (API) | Type | Notes |
|---|---|---|---|
| `titulo` | `title` | string | Event name |
| `descricao` | `description` | string | Event details |
| `local` | `venue` | string | Location/room |
| `data_inicio` | `start_at` | date-time | Event start date |
| `data_fim` | `end_at` | date-time | Event end date |
| `capacidade` | `capacity_total` | integer | Max attendees |
| — | `workload_hours` | integer | Training hours (new) |
| — | `min_presence_pct` | integer | Min attendance % (new) |
| — | `status` | enum | draft/published (new) |

## Student Fields

| Old | New (API) | Type | Notes |
|---|---|---|---|
| `aluno_nome` | `name` | string | Student name |
| `aluno_email` | `email` | email | Student email |
| `aluno_cpf` | `cpf` | string | Brazilian CPF |
| — | `ra` | string | Student ID (optional) |
| — | `phone` | string | Phone number (optional) |

## Enrollment Fields

| Old | New (API) | Type | Notes |
|---|---|---|---|
| `evento_id` | Derived from form | integer | Event reference |
| `evento_titulo` | `event.title` | nested | Event name |
| `aluno_nome` | `student.name` | nested | Student name |
| `aluno_email` | `student.email` | nested | Student email |
| `status` | `status` | enum | pending/confirmed/canceled |
| `data_criacao` | `created_at` | date-time | Registration date |
| — | `id` | integer | Enrollment ID |

## Day/Session Fields

| Old | New (API) | Type | Notes |
|---|---|---|---|
| `data` | `date` | date | Event day date |
| `inicio` | `start_time` | time | Session start time |
| `fim` | `end_time` | time | Session end time |
| `local` | `room` | string | Room number (optional) |
| `capacidade` | `capacity` | integer | Day capacity (optional) |

## Endpoint Path Changes

| Old | New |
|---|---|
| `/api/v1/{tenant}/usuarios/me` | `/api/v1/{tenant}/users` |
| `/api/v1/{tenant}/usuarios` | `/api/v1/{tenant}/users` |
| `/api/v1/{tenant}/eventos` | `/api/v1/{tenant}/events` |
| `/api/v1/{tenant}/eventos/{id}/dias` | `/api/v1/{tenant}/events/{id}/days` |
| `/api/v1/{tenant}/inscricoes` | `/api/v1/{tenant}/enrollments` |
| `/api/v1/{tenant}/inscricoes/{id}/confirm` | `/api/v1/{tenant}/enrollments/{id}/cancel` |
| `/api/v1/{tenant}/certificados` | `/api/v1/{tenant}/certificates` |
| `/api/v1/{tenant}/clientes` | `/api/v1/{tenant}/client` |

## HTTP Method Changes

| Endpoint | Old | New | Notes |
|---|---|---|---|
| Update User | PUT | PATCH | Now uses PATCH |
| Update Event | PUT | PUT | Unchanged |
| Cancel Enrollment | POST | PATCH | Now uses PATCH |

## New Endpoints (Not in Old API)

```
GET    /api/v1/{tenant}/students
POST   /api/v1/{tenant}/students
GET    /api/v1/{tenant}/students/{student_id}
PUT    /api/v1/{tenant}/students/{student_id}
DELETE /api/v1/{tenant}/students/{student_id}

POST   /api/v1/{tenant}/events/{event_id}/enroll?student_id={id}

GET    /api/v1/{tenant}/certificates/eligibility/{enrollment_id}
POST   /api/v1/{tenant}/certificates/issue/{enrollment_id}
POST   /api/v1/{tenant}/certificates/batch/{event_id}
GET    /api/v1/{tenant}/certificates/by-student/{student_id}

GET    /api/v1/{tenant}/roles

POST   /api/v1/{tenant}/users/sync-students
```

## JavaScript Implementation Examples

### Old Pattern
```javascript
const data = {
  titulo: form.title.value,
  descricao: form.description.value,
  local: form.location.value,
  capacidade: form.capacity.value,
  data_inicio: form.startDate.value,
  data_fim: form.endDate.value
};
await api.createEvento(data);
```

### New Pattern
```javascript
const data = {
  title: form.title.value,
  description: form.description.value,
  venue: form.location.value,
  capacity_total: form.capacity.value,
  start_at: form.startDate.value,
  end_at: form.endDate.value
};
await api.createEvento(data);
```

### Enrollment Creation - Old Pattern
```javascript
const data = {
  evento_id: eventSelect.value,
  aluno_email: emailInput.value,
  aluno_nome: nameInput.value,
  aluno_cpf: cpfInput.value
};
await api.createInscricao(data);
```

### Enrollment Creation - New Pattern
```javascript
// Step 1: Get or create student
let student = await api.createStudent({
  name: nameInput.value,
  email: emailInput.value,
  cpf: cpfInput.value
});

// Step 2: Enroll in event
await api.createInscricao({
  event_id: eventSelect.value,
  student_id: student.id
});
```

## Response Handling Examples

### Old Event Response
```javascript
{
  id: 1,
  titulo: "Conference 2024",
  descricao: "Annual tech conference",
  local: "Center Hall",
  capacidade: 200,
  data_inicio: "2024-12-20",
  data_fim: "2024-12-22"
}
```

### New Event Response
```javascript
{
  id: 1,
  title: "Conference 2024",
  description: "Annual tech conference",
  venue: "Center Hall",
  capacity_total: 200,
  start_at: "2024-12-20T00:00:00",
  end_at: "2024-12-22T00:00:00",
  workload_hours: 8,
  min_presence_pct: 80,
  status: "draft"
}
```

### Old Enrollment Response
```javascript
{
  id: 42,
  evento_id: 1,
  evento_titulo: "Conference 2024",
  aluno_id: 5,
  aluno_nome: "John Doe",
  aluno_email: "john@example.com",
  status: "pendente",
  data_criacao: "2024-01-10"
}
```

### New Enrollment Response
```javascript
{
  id: 42,
  status: "pending",
  student: {
    id: 5,
    name: "John Doe",
    email: "john@example.com",
    cpf: "12345678901"
  },
  event: {
    id: 1,
    title: "Conference 2024",
    venue: "Center Hall"
  },
  created_at: "2024-01-10T08:30:00"
}
```

## Migration Checklist

When updating components or adding new features:

- [ ] Use `title` instead of `titulo`
- [ ] Use `description` instead of `descricao`
- [ ] Use `venue` instead of `local`
- [ ] Use `capacity_total` instead of `capacidade`
- [ ] Use `start_at` instead of `data_inicio`
- [ ] Use `end_at` instead of `data_fim`
- [ ] Use `/events` instead of `/eventos`
- [ ] Use `/enrollments` instead of `/inscricoes`
- [ ] Use `/students` instead of custom student handling
- [ ] Use `/users` instead of `/usuarios`
- [ ] Use PATCH for user updates instead of PUT
- [ ] Use nested `student` and `event` objects in responses
- [ ] Ensure nested field access (`ins.student.name` instead of `ins.aluno_nome`)

## Backward Compatibility

The application uses `||` (OR) operator for field access to maintain some backward compatibility:

```javascript
// This works with both old and new field names
const name = student.name || student.aluno_nome;
const email = student.email || student.aluno_email;
```

However, **new code should only use the correct field names** to avoid confusion.
