
// Minimal UI logic
const $ = (sel)=> document.querySelector(sel);
const $$ = (sel)=> Array.from(document.querySelectorAll(sel));

// Toast notification system
function createToastContainer(){
  if (!$('.toast-container')) {
    const div = document.createElement('div');
    div.className = 'toast-container';
    document.body.appendChild(div);
  }
}

function showToast(message, type='info', duration=3000){
  createToastContainer();
  const container = $('.toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${message} <span class="close">✕</span>`;
  toast.querySelector('.close').onclick = ()=> toast.remove();
  container.appendChild(toast);
  if (duration > 0) setTimeout(()=> toast.remove(), duration);
  return toast;
}

const logsTbody = ()=> $('#tbl-logs tbody');
function addLog(qr, result, ok=true){
  const tr = document.createElement('tr');
  const ts = new Date().toLocaleTimeString();
  tr.innerHTML = `<td>${ts}</td><td>${qr}</td><td class="${ok?'success':'error'}">${result}</td>`;
  const tb = logsTbody();
  if (tb && typeof tb.prepend === 'function') {
    tb.prepend(tr);
  } else {
    // Table not available; silently skip (only warn in debug)
    // console.debug('addLog: table body not available; using toast only');
  }
  // Also show toast for errors
  if (!ok) showToast(`${qr}: ${result}`, 'error', 4000);
}

// Show a banner prompting user to login when API returns auth errors
function showAuthBanner(detail){
  let banner = $('#auth-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'auth-banner';
    banner.style = 'background:#ffebeb; color:#7a0b0b; padding:10px; text-align:center; border-bottom:1px solid #f5c6c6;';
    banner.innerHTML = '<strong>Atenção:</strong> é necessário se autenticar para acessar dados. <button id="auth-banner-btn" style="margin-left:12px; padding:4px 8px;">Ir para Login</button>';
    document.body.insertBefore(banner, document.body.firstChild);
    $('#auth-banner-btn').onclick = ()=>{ setActiveTab('#tab-login'); renderLogin(); };
  }
  if (detail) {
    banner.querySelector('strong').insertAdjacentText('afterend', ' ' + detail);
  }
}

function hideAuthBanner(){
  const b = $('#auth-banner'); if (b) b.remove();
}

function beep(){
  const soundEnabled = $('#soundToggle')?.checked;
  if (!soundEnabled) return;
  const ctx = new AudioContext();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.frequency.value = 880;
  o.start();
  setTimeout(()=>{ o.stop(); ctx.close(); }, 120);
}

async function renderLogin(){
  $('#view').innerHTML = $('#tpl-login').innerHTML;
  const baseUrl = await desktop.getSetting('baseUrl', 'https://events-backend-zug5.onrender.com');
  const tenant = await desktop.getSetting('tenant', 'demo');
  
  // Initialize form inputs (guard DOM presence)
  const baseEl = $('#baseUrl');
  if (baseEl) baseEl.value = baseUrl;
  const tenantEl = $('#tenant');
  if (tenantEl) tenantEl.value = tenant;

  // Check if user is already logged in
  if (api.cfg.accessToken) {
    showLoginSuccess();
  } else {
    showLoginForm();
  }

  function showLoginForm(){
    $('#login-form').style.display = 'block';
    $('#login-success').style.display = 'none';
  }

  async function showLoginSuccess(){
    try {
      const user = await api.getMe();
      $('#user-name').textContent = user.name || user.email || '-';
      $('#user-role').textContent = user.role || '-';
      $('#user-tenant').textContent = api.cfg.tenant || '-';
      $('#user-email').textContent = user.email || '-';
    } catch (e) {
      console.warn('Could not fetch user info:', e.message);
      $('#user-name').textContent = 'Unknown';
    }
    $('#login-form').style.display = 'none';
    $('#login-success').style.display = 'block';
  }

  // Login button
    $('#btn-login')?.addEventListener('click', async ()=>{
    const el = $('#login-status');
    if (el) el.textContent = 'Conectando...';
    try {
      if (baseEl) api.setBaseUrl(baseEl.value);
      if (tenantEl) api.setTenant(tenantEl.value);
      await api.save();
      const data = await api.login($('#email').value, $('#password').value);
      if (el) el.textContent = 'OK';
      addLog('login', 'sucesso', true);
      // Load user info and show success screen
      await new Promise(r => setTimeout(r, 500));
      showLoginSuccess();
    } catch (e) {
      if (el) el.textContent = e.message;
      addLog('login', e.message, false);
    }
  });

  // Logout button
  $('#btn-logout')?.addEventListener('click', async ()=>{
    api.cfg.accessToken = null;
    api.cfg.refreshToken = null;
    await api.save();
    showLoginForm();
    addLog('logout', 'desconectado', true);
  });
}

let cameraStream = null;

async function renderInscricoes(){
  const tpl = $('#tpl-inscricoes');
  if (!tpl) {
    console.error('Template tpl-inscricoes not found');
    showToast('Erro: template não encontrado', 'error');
    return;
  }
  $('#view').innerHTML = tpl.innerHTML;
  await api.load();
  
  let allInscricoes = [];
  let allEventos = [];
  let allStudents = [];

  async function loadInscricoes(){
    try {
      const inscricoes = await api.listInscricoes();
      allInscricoes = Array.isArray(inscricoes) ? inscricoes : (inscricoes.items || []);
      console.log('Inscrições carregadas:', allInscricoes);
      
      // Enrich inscricoes with student and event data
      const enriched = [];
      for (const ins of allInscricoes) {
        const student = allStudents.find(s => s.id === ins.student_id);
        const event = allEventos.find(e => e.id === ins.event_id);
        enriched.push({
          ...ins,
          student: student || { name: '-', email: '-' },
          event: event || { title: '-' }
        });
      }
      
      renderTable(enriched);
    } catch (e) {
      console.warn('loadInscricoes error:', e);
      if (e && e.message && (e.message.includes('AUTH_REQUIRED') || e.message.includes('Missing Authorization') || e.message.includes('HTTP 401'))) {
        showAuthBanner(e.message);
      } else {
        addLog('inscricoes', e.message, false);
      }
    }
  }

  async function loadEventos(){
    try {
      const eventos = await api.listEventos();
      allEventos = Array.isArray(eventos) ? eventos : (eventos.items || []);
      // Populate select if it's present in the DOM (modal may not be rendered yet)
      const sel = $('#f-evento-id');
      if (sel) {
        sel.innerHTML = '<option value="">-- Selecione --</option>';
        for (const e of allEventos) {
          const opt = document.createElement('option');
          opt.value = e.id;
          opt.textContent = e.title || e.titulo || e.id;
          sel.appendChild(opt);
        }
      } else {
        // select not in DOM yet — we'll populate it later when the modal opens
        console.debug('loadEventos: #f-evento-id not present, skipping select populate');
      }
    } catch (e) {
      console.warn('Could not load eventos:', e.message);
      if (e && e.message && (e.message.includes('AUTH_REQUIRED') || e.message.includes('Missing Authorization') || e.message.includes('HTTP 401'))) {
        showAuthBanner(e.message);
      }
    }
  }

  async function loadStudents(){
    try {
      const students = await api.listStudents();
      allStudents = Array.isArray(students) ? students : (students.items || []);
    } catch (e) {
      console.warn('Could not load students:', e.message);
    }
  }

  function renderTable(list){
    // Support tables where the tbody itself has the id, or where the table has the id
    let tbody = document.querySelector('#tbl-inscricoes tbody');
    if (!tbody) {
      const el = document.getElementById('tbl-inscricoes');
      if (el) {
        if (el.tagName && el.tagName.toLowerCase() === 'tbody') tbody = el;
        else tbody = el.querySelector('tbody') || el;
      }
    }
    if (!tbody) {
      console.error('renderTable: tbody not found for #tbl-inscricoes');
      return;
    }
    tbody.innerHTML = '';

    const getStudentById = (id) => allStudents.find(s => String(s.id) === String(id) || String(s.student_id) === String(id));
    const getEventById = (id) => allEventos.find(e => String(e.id) === String(id));
    const extractNameFromStr = (s) => {
      if (!s || typeof s !== 'string') return null;
      // look for name=VALUE or name: VALUE patterns
      const m = s.match(/name\s*[:=]\s*([^;\n\}]+)/i);
      if (m) return m[1].trim();
      return s.slice(0, 30);
    };

    for (const ins of list) {
      const tr = document.createElement('tr');

      // Student name/email: try various shapes and fallbacks using loaded students
      let studentName = '-';
      let studentEmail = '-';
      if (ins.student && typeof ins.student === 'object') {
        studentName = ins.student.name || ins.student.nome || ins.student_name || studentName;
        studentEmail = ins.student.email || ins.student.email_address || ins.student_email || studentEmail;
      }
      if ((studentName === '-' || studentEmail === '-') && (ins.student_id || ins.student_id === 0 || ins.student?.id)) {
        const sid = ins.student_id || (ins.student && ins.student.id);
        const s = getStudentById(sid);
        if (s) {
          studentName = s.name || s.nome || studentName;
          studentEmail = s.email || studentEmail;
        }
      }
      if (studentName === '-' && typeof ins.student === 'string') {
        studentName = extractNameFromStr(ins.student) || '-';
      }

      // Event title: try nested event object or lookup by event_id
      let eventTitle = '-';
      if (ins.event && typeof ins.event === 'object') eventTitle = ins.event.title || ins.event.titulo || ins.event_title || eventTitle;
      if ((eventTitle === '-' || !eventTitle) && (ins.event_id || ins.event?.id || ins.evento_id)) {
        const eid = ins.event_id || (ins.event && ins.event.id) || ins.evento_id;
        const ev = getEventById(eid);
        if (ev) eventTitle = ev.title || ev.titulo || eventTitle;
      }

      const status = ins.status || ins.estado || '-';
      let createdAt = ins.enrollment_date || ins.created_at || ins.data_criacao || ins.created || ins.createdAt || '-';
      if (createdAt && typeof createdAt === 'string' && createdAt.includes('T')) {
        try { createdAt = new Date(createdAt).toLocaleString('pt-BR'); } catch(e) {}
      }

      tr.innerHTML = `
        <td>${studentName}</td>
        <td>${studentEmail}</td>
        <td>${eventTitle}</td>
        <td><span class="${status === 'confirmed' || status === 'confirmada' ? 'success' : 'info'}">${status}</span></td>
        <td>${createdAt}</td>
        <td>
          <button class="btn-confirm-inscricao ghost" data-id="${ins.id}" ${status === 'confirmed' || status === 'confirmada' ? 'disabled' : ''} style="padding:4px 8px; font-size:11px;">Confirmar</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    $$('.btn-confirm-inscricao').forEach(btn => btn.onclick = ()=> confirmInscricao(btn.dataset.id));
  }

  function showFormModal(){ $('#inscricao-form-modal').style.display = 'flex'; }
  function hideFormModal(){ $('#inscricao-form-modal').style.display = 'none'; resetForm(); }

  function resetForm(){
    $('#form-inscricao').reset();
  }

  async function confirmInscricao(inscricaoId){
    try {
      await api.confirmInscricao(inscricaoId, {});
      addLog('inscricao', 'confirmada', true);
      await loadInscricoes();
    } catch (e) {
      addLog('inscricao', e.message, false);
    }
  }

  $('#filter-evento').addEventListener('input', (e)=>{
    const query = e.target.value.toLowerCase();
    const filtered = allInscricoes.filter(i => 
      (i.event?.title || i.evento_titulo || '').toLowerCase().includes(query) ||
      (i.student?.name || i.aluno_nome || '').toLowerCase().includes(query)
    );
    renderTable(filtered);
  });

  $('#btn-new-inscricao')?.addEventListener('click', ()=>{ resetForm(); showFormModal(); });
  $('#btn-close-inscricao-modal')?.addEventListener('click', hideFormModal);
  $('#btn-cancel-inscricao')?.addEventListener('click', hideFormModal);

  $('#btn-save-inscricao')?.addEventListener('click', async ()=>{
    const eventoId = $('#f-evento-id').value;
    const alunoEmail = $('#f-aluno-email').value;
    const alunoNome = $('#f-aluno-nome').value;
    const alunoCpf = $('#f-aluno-cpf').value;
    
    if (!eventoId) {
      addLog('inscricao', 'Selecione um evento', false);
      return;
    }

    try {
      // First try to find or create the student
      let student = allStudents.find(s => s.email === alunoEmail);
      let studentId;
      
      if (!student) {
        // Create student if doesn't exist
        student = await api.createStudent({
          name: alunoNome,
          email: alunoEmail,
          cpf: alunoCpf
        });
      }
      studentId = student.id;

      // Enroll student in event
      await api.createInscricao({
        event_id: eventoId,
        student_id: studentId
      });
      
      addLog('inscricao', 'criada', true);
      hideFormModal();
      await loadInscricoes();
    } catch (e) {
      addLog('inscricao', e.message, false);
    }
  });

  await loadEventos();
  await loadStudents();
  await loadInscricoes();
}

async function renderEventos(){
  const tpl = $('#tpl-eventos');
  if (!tpl) {
    console.error('Template tpl-eventos not found');
    showToast('Erro: template não encontrado', 'error');
    return;
  }
  $('#view').innerHTML = tpl.innerHTML;
  await api.load();
  
  let editingEventoId = null;
  
  async function loadEventos(){
    try {
      const eventos = await api.listEventos();
      const tbody = $('#tbl-eventos');
      tbody.innerHTML = '';
      const list = Array.isArray(eventos) ? eventos : (eventos.items || []);
      for (const e of list) {
        const tr = document.createElement('tr');
        const title = e.title || e.titulo || '-';
        let startAt = e.start_at || e.data_inicio || '-';
        if (startAt && startAt.includes('T')) {
          startAt = new Date(startAt).toLocaleDateString('pt-BR');
        }
        const capacity = e.capacity_total || e.capacidade || '-';
        const venue = e.venue || e.local || '-';
        tr.innerHTML = `
          <td>${title}</td>
          <td>${startAt}</td>
          <td>${capacity}</td>
          <td>${venue}</td>
          <td>
            <button class="btn-edit-evento ghost" data-id="${e.id}" style="padding:4px 8px; font-size:11px;">Editar</button>
            <button class="btn-dias-evento ghost" data-id="${e.id}" style="padding:4px 8px; font-size:11px;">Dias</button>
          </td>
        `;
        tbody.appendChild(tr);
      }
      // Attach event listeners
      $$('.btn-edit-evento').forEach(btn => btn.onclick = ()=> openEditForm(btn.dataset.id, list));
      $$('.btn-dias-evento').forEach(btn => btn.onclick = ()=> console.log('TODO: view days for evento', btn.dataset.id));
    } catch (e) {
      addLog('eventos', e.message, false);
    }
  }

  function showFormModal(){ $('#evento-form-modal').style.display = 'flex'; }
  function hideFormModal(){ $('#evento-form-modal').style.display = 'none'; resetForm(); }

  function resetForm(){
    editingEventoId = null;
    $('#form-title').textContent = 'Novo Evento';
    $('#form-evento').reset();
  }

  function openEditForm(eventoId, list){
    editingEventoId = eventoId;
    const e = list.find(x => x.id === eventoId);
    if (e) {
      $('#form-title').textContent = 'Editar Evento';
      $('#f-titulo').value = e.title || e.titulo || '';
      $('#f-descricao').value = e.description || e.descricao || '';
      $('#f-local').value = e.venue || e.local || '';
      $('#f-data-inicio').value = e.start_at || e.data_inicio || '';
      $('#f-data-fim').value = e.end_at || e.data_fim || '';
      $('#f-capacidade').value = e.capacity_total || e.capacidade || '';
    }
    showFormModal();
  }

  $('#btn-new-evento')?.addEventListener('click', ()=>{ resetForm(); showFormModal(); });
  $('#btn-close-modal')?.addEventListener('click', hideFormModal);
  $('#btn-cancel-evento')?.addEventListener('click', hideFormModal);

  $('#btn-save-evento')?.addEventListener('click', async ()=>{
    const data = {
      title: $('#f-titulo').value,
      description: $('#f-descricao').value,
      venue: $('#f-local').value,
      start_at: $('#f-data-inicio').value,
      end_at: $('#f-data-fim').value,
      capacity_total: parseInt($('#f-capacidade').value) || null
    };
    try {
      if (editingEventoId) {
        await api.updateEvento(editingEventoId, data);
        addLog('evento', 'atualizado', true);
      } else {
        await api.createEvento(data);
        addLog('evento', 'criado', true);
      }
      hideFormModal();
      await loadEventos();
    } catch (e) {
      addLog('evento', e.message, false);
    }
  });

  await loadEventos();
}

async function renderGate(){
  const tpl = $('#tpl-gate');
  if (!tpl) {
    console.error('Template tpl-gate not found');
    showToast('Erro: template não encontrado', 'error');
    return;
  }
  $('#view').innerHTML = tpl.innerHTML;
  
  // Wait for DOM to settle after innerHTML assignment
  await new Promise(r => setTimeout(r, 50));
  
  // Verify table was loaded
  const table = $('#tbl-logs');
  if (!table) {
    console.error('Table tbl-logs not found after template load');
  }
  
  await api.load();

  $('#btn-toggle-camera').onclick = async ()=> {
    const video = $('#video'), canvas=$('#canvas');
    if (video.srcObject) {
      await stopCamera(video);
      $('#btn-toggle-camera').textContent = 'Iniciar câmera';
      return;
    }
    cameraStream = await startCamera(video);
    $('#btn-toggle-camera').textContent = 'Parar câmera';
    scanLoop(video, canvas, onQrRead);
  };
  // Make important controls visually prominent
  $('#btn-toggle-camera')?.classList.add('primary');
  $('#btn-sync-offline')?.classList.add('primary');
  $('#btn-list-serial')?.classList.add('ghost');
  $('#btn-open-serial')?.classList.add('ghost');

  async function onQrRead(data){
    const dayId = $('#dayId').value.trim();
    const action = $('#gateAction').value;
    const deviceId = $('#deviceId').value || 'gate-01';
    const ts = new Date().toISOString();
    const payload = { qr_token: data, day_event_id: dayId, action, device_id: deviceId, ts };
    
    // Show status in large panel
    const statusLarge = $('#gate-status-large');
    const statusIcon = $('#gate-status-icon');
    const statusText = $('#gate-status-text');
    const statusQr = $('#gate-status-qr');
    const statusTime = $('#gate-status-time');
    
    try {
      const res = await api.gateScan(payload);
      
      // Success - green panel
      statusIcon.textContent = '✓';
      statusText.textContent = `${action.toUpperCase()} - OK`;
      statusQr.textContent = `QR: ${data.substring(0, 20)}...`;
      statusTime.textContent = new Date().toLocaleTimeString('pt-BR');
      statusLarge.style.display = 'flex';
      statusLarge.parentElement.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
      
      addLog(data, 'OK', true);
      beep();
      
      // Auto-hide success after 3 seconds
      setTimeout(() => {
        statusLarge.style.display = 'none';
        statusLarge.parentElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      }, 3000);
      
    } catch (e) {
      // Error - red panel
      statusIcon.textContent = '✗';
      statusText.textContent = 'ERRO';
      statusQr.textContent = `Motivo: ${e.message}`;
      statusTime.textContent = new Date().toLocaleTimeString('pt-BR');
      statusLarge.style.display = 'flex';
      statusLarge.parentElement.style.background = 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)';
      
      addLog(data, e.message, false);
      
      // queue offline
      await queueScan(payload);
      
      // Auto-hide error after 5 seconds
      setTimeout(() => {
        statusLarge.style.display = 'none';
        statusLarge.parentElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      }, 5000);
    }
  }

  // Serial
  $('#btn-list-serial').onclick = async ()=>{
    const ports = await desktop.serialList();
    const sel = $('#serialPorts');
    sel.innerHTML = '';
    for (const p of ports) {
      const opt = document.createElement('option');
      opt.value = p.path;
      opt.textContent = `${p.path} ${p.manufacturer||''}`;
      sel.appendChild(opt);
    }
  };
  $('#btn-open-serial').onclick = async ()=>{
    const path = $('#serialPorts').value;
    if (!path) return;
    try {
      await desktop.serialOpen(path, 9600);
      addLog('serial', 'conectado', true);
    } catch (e) {
      addLog('serial', String(e), false);
    }
  };
  desktop.onSerialData(async (data)=>{
    // Assume scanner sends the QR token text + newline
    const token = String(data).trim();
    if (!token) return;
    const dayId = $('#dayId').value.trim();
    const action = $('#gateAction').value;
    const deviceId = $('#deviceId').value || 'gate-01';
    const ts = new Date().toISOString();
    const payload = { qr_token: token, day_event_id: dayId, action, device_id: deviceId, ts };
    try {
      await api.gateScan(payload);
      addLog(token, 'OK', true);
      beep();
    } catch (e) {
      addLog(token, e.message, false);
      await queueScan(payload);
    }
  });

  // Offline sync
  $('#btn-sync-offline').onclick = async ()=>{
    const r = await flushQueue(api.gateBulk);
    const gs = $('#gate-status');
    if (gs) {
      if (r.error) gs.innerHTML = `<span class="error">${r.error}</span>`;
      else gs.innerHTML = `<span class="success">Sincronizado: ${r.sent}</span>`;
    } else {
      // Fallback: update the large gate status panel text and show a toast
      const statusText = $('#gate-status-text');
      if (r.error) {
        if (statusText) statusText.textContent = String(r.error).slice(0, 200);
        addLog('offline-sync', r.error, false);
        showToast('Offline sync failed: ' + String(r.error), 'error', 4000);
      } else {
        if (statusText) statusText.textContent = `Sincronizado: ${r.sent}`;
        addLog('offline-sync', `Sincronizado ${r.sent}`, true);
        showToast(`Sincronizado: ${r.sent}`, 'info', 3000);
      }
    }
  };
}

async function renderReports(){
  const tpl = $('#tpl-reports');
  if (!tpl) {
    console.error('Template tpl-reports not found');
    showToast('Erro: template não encontrado', 'error');
    return;
  }
  $('#view').innerHTML = tpl.innerHTML;
  await api.load();

  const eventSelect = $('#repEventSelect');
  const daySelect = $('#repDaySelect');
  let lastData = [];

  // Carregar eventos no dropdown
  async function loadEventsIntoSelect() {
    try {
      const eventos = await api.listEventos();
      const list = Array.isArray(eventos) ? eventos : (eventos.items || []);
      eventSelect.innerHTML = '<option value="">-- Selecione um Evento --</option>';
      for (const e of list) {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.title || e.titulo || `Evento #${e.id}`;
        eventSelect.appendChild(opt);
      }
    } catch (e) {
      addLog('reports', 'Falha ao carregar eventos: ' + e.message, false);
    }
  }

  // Carregar dias do evento selecionado
  eventSelect.onchange = async () => {
    const eventId = eventSelect.value;
    daySelect.innerHTML = '<option value="">Todos os dias</option>'; // Opção padrão
    if (!eventId) return;

    const dias = await api.listDias(eventId);
    const list = Array.isArray(dias) ? dias : (dias.items || []);
    for (const d of list) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.title || new Date(d.date).toLocaleDateString('pt-BR') || `Dia #${d.id}`;
      daySelect.appendChild(opt);
    }
  };

  function fillTable(rows){
    const tb = document.querySelector('#tbl-att tbody') || document.getElementById('tbl-att');
    if (!tb) {
      console.error('fillTable: table #tbl-att not found');
      return;
    }
    tb.innerHTML = '';
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.student_name||''}</td><td>${r.student_email||''}</td><td>${r.enrollment_id||''}</td><td>${r.day_event_id||''}</td><td>${r.checkin_em||''}</td><td>${r.checkout_em||''}</td>`;
      tb.appendChild(tr);
    }
  }

  $('#btn-load-att').onclick = async ()=>{
    const eventId = eventSelect.value;
    const dayId = daySelect.value;
    const params = { event_id: eventId };
    if (dayId) params.day_id = dayId;
    try{
      const data = await api.attendance(params);
      lastData = Array.isArray(data) ? data : (data.items || []);
      fillTable(lastData);
      addLog('reports', `carregado ${lastData.length}`, true);
    }catch(e){
      if (e && e.message && (e.message.includes('AUTH_REQUIRED') || e.message.includes('Missing Authorization') || e.message.includes('HTTP 401'))) {
        showAuthBanner(e.message);
      } else {
        addLog('reports', e.message, false);
      }
    }
  };

  // Carregar os dados iniciais
  await loadEventsIntoSelect();

  // Style export buttons
  $('#btn-load-att')?.classList.add('primary');
  $('#btn-export-csv')?.classList.add('ghost');
  $('#btn-export-xlsx')?.classList.add('ghost');
  $('#btn-export-pdf')?.classList.add('ghost');

  $('#btn-export-csv').onclick = async ()=>{
    const csv = 'Aluno,Email,Inscrição,Dia,Check-in,Check-out\n' + lastData.map(r=>[r.student_name||'', r.student_email||'', r.enrollment_id||'', r.day_event_id||'', r.checkin_em||'', r.checkout_em||''].join(',')).join('\n');
    const b64 = Buffer.from(csv, 'utf-8').toString('base64');
    await desktop.saveFile('presencas.csv', b64);
  };

  $('#btn-export-xlsx').onclick = async ()=>{
    const XLSXlib = (typeof window !== 'undefined' && window.XLSX) ? window.XLSX : null;
    if (!XLSXlib) return addLog('export-xlsx', 'XLSX library not available', false);
    const wsData = [['Aluno','Email','Inscrição','Dia','Check-in','Check-out'], ...lastData.map(r=>[r.student_name||'', r.student_email||'', r.enrollment_id||'', r.day_event_id||'', r.checkin_em||'', r.checkout_em||''])];
    const wb = XLSXlib.utils.book_new();
    const ws = XLSXlib.utils.aoa_to_sheet(wsData);
    XLSXlib.utils.book_append_sheet(wb, ws, 'Presenças');
    const xlsb = XLSXlib.write(wb, { type:'buffer', bookType:'xlsx' });
    const b64 = Buffer.from(xlsb).toString('base64');
    await desktop.saveFile('presencas.xlsx', b64);
  };

  $('#btn-export-pdf').onclick = async ()=>{
    const jspdfLib = (typeof window !== 'undefined' && window.jspdf) ? window.jspdf : null;
    if (!jspdfLib) return addLog('export-pdf', 'jspdf library not available', false);
    const doc = new jspdfLib.jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    doc.text('Relatório de Presenças', 40, 40);
    let y = 70;
    for (const r of lastData.slice(0, 30)) {
      doc.text(`${r.student_name||''} | ${r.student_email||''} | ${r.enrollment_id||''} | ${r.day_event_id||''} | ${r.checkin_em||''} | ${r.checkout_em||''}`, 40, y);
      y += 18;
    }
    const buffer = doc.output('arraybuffer');
    const b64 = Buffer.from(buffer).toString('base64');
    await desktop.saveFile('presencas.pdf', b64);
  };
}

async function renderSettings(){
  $('#view').innerHTML = $('#tpl-settings').innerHTML;
  $('#soundToggle').checked = await desktop.getSetting('sound', false);
  $('#exportPath').value = await desktop.getSetting('exportPath', '');
  $('#btn-save-settings').onclick = async ()=>{
    await desktop.setSetting('sound', $('#soundToggle').checked);
    await desktop.setSetting('exportPath', $('#exportPath').value);
    addLog('config', 'salvo', true);
  };
}

// ===== Certificados UI =====
async function renderCertificates(){
  const tpl = $('#tpl-certificados');
  if (!tpl) {
    console.error('Template tpl-certificados not found');
    showToast('Erro: template de certificados não encontrado', 'error');
    return;
  }
  $('#view').innerHTML = tpl.innerHTML;
  await api.load();

  const sel = $('#certEventSelect');
  const tbl = $('#tbl-cert-list');
  const summary = $('#cert-summary');

  // Load events
  const eventos = Array.isArray(await api.listEventos()) ? await api.listEventos() : (await api.listEventos()).items || [];
  sel.innerHTML = '<option value="">-- Selecione um evento --</option>';
  for (const e of eventos) {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.title || e.titulo || `#${e.id}`;
    sel.appendChild(opt);
  }

  async function loadEligibles(){
    const eventId = sel.value;
    if (!eventId) return showToast('Selecione um evento', 'error');
    const eventObj = eventos.find(x => String(x.id) === String(eventId));
    summary.textContent = 'Carregando dados...';

    // load enrollments, days and attendance
    const enrollments = Array.isArray(await api.listInscricoes({ event_id: eventId })) ? await api.listInscricoes({ event_id: eventId }) : (await api.listInscricoes({ event_id: eventId })).items || [];
    const dias = Array.isArray(await api.listDias(eventId)) ? await api.listDias(eventId) : (await api.listDias(eventId)).items || [];
    const totalDays = dias.length || 1;
    const att = Array.isArray(await api.attendance({ event_id: eventId })) ? await api.attendance({ event_id: eventId }) : (await api.attendance({ event_id: eventId })).items || [];

    // map attendance by enrollment id -> set of day_event ids
    const attendMap = {};
    for (const a of att) {
      const enrId = a.enrollment?.id || a.enrollment_id || (a.enrollment && a.enrollment.id);
      const dayId = a.day_event?.id || a.day_event_id || (a.day_event && a.day_event.id);
      if (!enrId) continue;
      attendMap[enrId] = attendMap[enrId] || new Set();
      if (dayId) attendMap[enrId].add(String(dayId));
    }

    // history of issued certificates
    const history = await desktop.getSetting('certificatesHistory', {});

    tbl.innerHTML = '';
    let eligibleCount = 0;
    for (const en of enrollments) {
      const student = en.student || en.student_data || en.student_obj || {};
      const studentName = student.name || en.aluno_nome || (student && student.toString && student.toString()) || '-';
      const studentEmail = student.email || en.aluno_email || '';
      const enrId = en.id;
      const attendedDays = attendMap[enrId] ? attendMap[enrId].size : 0;
      const percent = Math.round((attendedDays / totalDays) * 100);
      const required = eventObj?.min_presence_pct || eventObj?.min_presence || 75;
      const eligible = percent >= required;
      if (eligible) eligibleCount++;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="cert-chk" data-id="${enrId}" ${eligible ? '' : 'disabled'} /></td>
        <td>${studentName}</td>
        <td>${studentEmail}</td>
        <td>${eventObj?.title || eventObj?.titulo || ''}</td>
        <td>${percent}%</td>
        <td>${eligible ? 'Sim' : 'Não'}</td>
        <td>${history[enrId] ? new Date(history[enrId].issued_at).toLocaleString() : ''}</td>
      `;
      tbl.appendChild(tr);
    }
    summary.textContent = `${enrollments.length} inscritos; ${eligibleCount} elegíveis (mín ${eventObj?.min_presence_pct || eventObj?.min_presence || 75}%).`;
  }

  async function generatePdfFor(enrollment){
    // enrollment: enrollment object or enrollment id
    const enr = typeof enrollment === 'object' ? enrollment : null;
    const enrId = enr ? enr.id : enrollment;
    // try to find enrollment in current table
    // Minimal data retrieval
    const evtId = $('#certEventSelect').value;
    const eventObj = eventos.find(x => String(x.id) === String(evtId));
    const students = Array.isArray(await api.listStudents()) ? await api.listStudents() : (await api.listStudents()).items || [];

    // find enrollment details from API again (getInscricao)
    let ins = null;
    try { ins = await api.getInscricao(enrId); } catch(e){ /* ignore */ }

    const student = ins?.student || ins?.student_obj || (ins ? { name: ins.student_name, email: ins.student_email } : {});
    const studentName = student?.name || ins?.aluno_nome || 'Aluno';

    // Generate a verification URL (simple form)
    const verifyUrl = `${api.cfg.baseUrl.replace(/\/$/, '')}/cert/verify?enrollment_id=${enrId}&event_id=${evtId}`;

    const jspdfLib = (typeof window !== 'undefined' && window.jspdf) ? window.jspdf : null;
    let filename = `${studentName.replace(/[^a-z0-9\- ]/ig,'') || 'certificado'}_${evtId}_${enrId}.pdf`;

    if (jspdfLib) {
      const doc = new jspdfLib.jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
      doc.setFontSize(20);
      doc.text('Certificado de Participação', 80, 80);
      doc.setFontSize(14);
      doc.text(`Concedido a: ${studentName}`, 80, 140);
      doc.text(`Pelo evento: ${eventObj?.title || ''}`, 80, 170);
      doc.text(`Verifique em: ${verifyUrl}`, 80, 210);
      // signature placeholder
      doc.text('Assinatura:', 80, 500);
      // small box for QR placeholder
      doc.setDrawColor(0);
      doc.rect(720, 420, 120, 120);

      const buffer = doc.output('arraybuffer');
      const b64 = Buffer.from(buffer).toString('base64');
      const saved = await desktop.saveFile(filename, b64);
      return { saved, filename };
    } else {
      // Fallback: save a text file
      const content = `Certificado\nAluno: ${studentName}\nEvento: ${eventObj?.title || ''}\nVerifique: ${verifyUrl}`;
      const b64 = Buffer.from(content, 'utf-8').toString('base64');
      filename = filename.replace(/\.pdf$/, '.txt');
      const saved = await desktop.saveFile(filename, b64);
      return { saved, filename };
    }
  }

  // emit selected or all eligibles
  $('#btn-emit-lote').onclick = async ()=>{
    const chks = Array.from(document.querySelectorAll('.cert-chk'));
    const toEmit = chks.filter(c => c.checked).map(c => c.dataset.id);
    if (!toEmit.length) return showToast('Selecione ao menos um certificado elegível', 'error');
    const history = await desktop.getSetting('certificatesHistory', {});
    for (const id of toEmit) {
      try {
        const res = await generatePdfFor(id);
        history[id] = { issued_at: new Date().toISOString(), file: res.filename };
        addLog('certificado', `emitido ${id}`, true);
      } catch (e) {
        addLog('certificado', `erro ${id}: ${e.message}`, false);
      }
    }
    await desktop.setSetting('certificatesHistory', history);
    showToast(`Emitidos: ${toEmit.length}`, 'info', 3000);
    // reload list to show issued timestamps
    loadEligibles();
  };

  $('#btn-load-cert').onclick = loadEligibles;
}

async function init(){
  await api.load();
  function setActiveTab(sel){
    $$("nav button").forEach(b=>b.classList.remove('active'));
    const btn = $(sel);
    if (btn) btn.classList.add('active');
  }

  $('#tab-login').onclick = ()=>{ setActiveTab('#tab-login'); renderLogin(); };
  $('#tab-eventos').onclick = ()=>{ setActiveTab('#tab-eventos'); renderEventos(); };
  $('#tab-inscricoes').onclick = ()=>{ setActiveTab('#tab-inscricoes'); renderInscricoes(); };
  $('#tab-gate').onclick = ()=>{ setActiveTab('#tab-gate'); renderGate(); };
  $('#tab-reports').onclick = ()=>{ setActiveTab('#tab-reports'); renderReports(); };
  $('#tab-certificados').onclick = ()=>{ setActiveTab('#tab-certificados'); renderCertificates(); };
  $('#tab-settings').onclick = ()=>{ setActiveTab('#tab-settings'); renderSettings(); };
  // default
  setActiveTab('#tab-login');
  renderLogin();
}

window.addEventListener('DOMContentLoaded', init);
