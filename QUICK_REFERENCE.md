# Quick Reference Card

## 🚀 Getting Started

```bash
cd d:\Projetovs\events-desktop-app
npm install
npm run dev
```

## 🔑 Login Credentials (Test)

- **Base URL**: `https://events-backend-zug5.onrender.com`
- **Tenant**: `demo`
- **Email**: `admin@demo`
- **Password**: `admin123`

## 📋 API Endpoints Updated

| Module | Old Endpoint | New Endpoint | Method |
|--------|---|---|---|
| Users | `/usuarios` | `/users` | GET/POST/PATCH/DELETE |
| Events | `/eventos` | `/events` | GET/POST/PUT |
| Days | `/eventos/{id}/dias` | `/events/{id}/days` | GET/POST/PUT |
| Students | N/A | `/students` | GET/POST/PUT/DELETE |
| Enrollments | `/inscricoes` | `/enrollments` | GET/POST/PATCH |
| Enroll Event | N/A | `/events/{id}/enroll?student_id={id}` | POST |
| Gate | `/gate/*` | `/gate/*` | POST |
| Certificates | `/certificados` | `/certificates` | GET/POST |

## 🔧 Field Name Changes

| Context | Old | New |
|---------|-----|-----|
| **Event** | `titulo` | `title` |
| | `descricao` | `description` |
| | `local` | `venue` |
| | `capacidade` | `capacity_total` |
| | `data_inicio` | `start_at` |
| | `data_fim` | `end_at` |
| **Student** | `aluno_nome` | `student.name` |
| | `aluno_email` | `student.email` |
| | `aluno_cpf` | `student.cpf` |
| **Enrollment** | `evento_titulo` | `event.title` |
| | `evento_id` | Derived from form |

## 📱 Key Features

### Events Tab
- List all events
- Create new event
- Edit existing event
- View event days

### Inscrições Tab
- List enrollments
- Create new enrollment (auto-creates student)
- Confirm enrollment
- Filter by event/student

### Portaria Tab
- QR code scanning (webcam)
- Serial port input (optional)
- Attendance logging
- Offline queue support

### Relatórios Tab
- Attendance data display
- Export to CSV/XLSX/PDF
- Filter by event/date

### Configurações Tab
- Sound toggle
- Export path selection
- Settings persistence

## 🧪 Quick Test Sequence

1. **Login**: Fill form → Click Login → Verify user info displays
2. **Events**: Click Eventos → Verify list loads → Create new → Verify in list
3. **Students**: Click Inscrições → Create enrollment → Auto-create student → Verify status
4. **Portaria**: Click Portaria → Scan QR (or enter manually) → Verify in log
5. **Reports**: Click Relatórios → View attendance → Try export

## 📝 File Changes

```
renderer/js/api.js       (556 lines) - API endpoints reconciled
renderer/renderer.js     (538 lines) - UI logic updated
API_RECONCILIATION.md    (NEW) - Technical documentation
TESTING_GUIDE.md         (NEW) - Step-by-step testing
FIELD_MAPPING.md         (NEW) - Field name reference
CHANGELOG.md             (NEW) - Summary of all changes
```

## 🔍 Debugging

**Open DevTools**: F12

**Check API calls**: Network tab → Filter XHR/Fetch

**View logs**: Console tab

**Test API manually**:
```javascript
api.listEventos().then(e => console.log('Events:', e))
api.listStudents().then(s => console.log('Students:', s))
api.listInscricoes().then(i => console.log('Enrollments:', i))
```

## 🚨 Common Issues

| Problem | Solution |
|---------|----------|
| 404 errors | Check endpoint paths in API_RECONCILIATION.md |
| Field undefined | Check field name mapping in FIELD_MAPPING.md |
| 401 errors | Re-login, check token refresh |
| CORS errors | App auto-fallback to nodeFetch (should work) |
| Empty tables | Verify backend is running, check network tab |

## 📚 Documentation Files

- **API_RECONCILIATION.md** - All endpoint and field changes explained
- **TESTING_GUIDE.md** - Step-by-step testing instructions
- **FIELD_MAPPING.md** - Before/after field names reference
- **CHANGELOG.md** - Complete summary of changes
- **This file** - Quick reference card

## ✅ Verification Checklist

- [ ] npm install completes without errors
- [ ] npm run dev starts app successfully
- [ ] Login works with test credentials
- [ ] Events list loads and displays correctly
- [ ] Can create new event
- [ ] Can create enrollment (with student auto-creation)
- [ ] No 404 errors in console
- [ ] All UI elements visible and clickable
- [ ] Toast notifications display
- [ ] Settings persist after restart

## 🎯 Next Steps

1. Run full testing sequence using TESTING_GUIDE.md
2. Fix any issues based on debugging tips above
3. Test with real data from backend
4. Implement missing features (certificates, advanced portaria)
5. Performance optimization if needed

## 📞 Support Resources

- **OpenAPI Docs**: https://events-backend-zug5.onrender.com/docs
- **OpenAPI Schema**: https://events-backend-zug5.onrender.com/openapi.json
- **Local Docs**: API_RECONCILIATION.md, FIELD_MAPPING.md
- **Testing Guide**: TESTING_GUIDE.md

---

**Status**: ✅ Ready for Testing  
**Version**: 1.0.0  
**Last Updated**: 2024
