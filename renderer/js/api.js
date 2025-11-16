const api = (()=>{
  let cfg = {
    baseUrl: 'https://events-backend-zug5.onrender.com',
    tenant: 'demo',
    accessToken: null,
    refreshToken: null
  };

  async function load() {
    // Load persisted settings. If user previously had localhost (dev) configured,
    // migrate it to the default remote host to avoid connection refused errors.
    const storedBase = await window.desktop.getSetting('baseUrl', cfg.baseUrl);
    if (storedBase && (storedBase.startsWith('http://127.0.0.1') || storedBase.startsWith('http://localhost'))) {
      // keep the compiled default (usually the remote host) and persist it
      await window.desktop.setSetting('baseUrl', cfg.baseUrl);
    } else {
      cfg.baseUrl = storedBase;
    }
    cfg.tenant = await window.desktop.getSetting('tenant', cfg.tenant);
    cfg.accessToken = await window.desktop.getSetting('accessToken', null);
    cfg.refreshToken = await window.desktop.getSetting('refreshToken', null);
  }

  async function save() {
    await window.desktop.setSetting('baseUrl', cfg.baseUrl);
    await window.desktop.setSetting('tenant', cfg.tenant);
    await window.desktop.setSetting('accessToken', cfg.accessToken);
    await window.desktop.setSetting('refreshToken', cfg.refreshToken);
  }

  function setBaseUrl(u){ cfg.baseUrl = u; }
  function setTenant(t){ cfg.tenant = t; }
  function setTokens(at, rt){ cfg.accessToken = at; cfg.refreshToken = rt; }

  async function request(path, options={}){
    const url = `${cfg.baseUrl}/api/v1/${cfg.tenant}${path}`;
    const headers = Object.assign({
      'Content-Type': 'application/json'
    }, options.headers || {});
    if (cfg.accessToken) headers['Authorization'] = `Bearer ${cfg.accessToken}`;

    // Retry configuration for network errors only
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second base delay
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let res;
      let usedFallback = false;

      try {
        // Try renderer fetch first
        try {
          console.debug('api.request ->', url, options, `(attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
          res = await fetch(url, {...options, headers});
        } catch (err) {
          // Fallback to preload/node fetch (bypasses CORS and renderer limits)
          console.warn('api.request renderer fetch failed, trying nodeFetch fallback:', err.message);
          const nodeRes = await window.desktop.nodeFetch(url, {...options, headers});
          if (nodeRes.error) {
            throw new Error(`nodeFetch error: ${nodeRes.error}`);
          }
          usedFallback = true;
          // Convert nodeFetch response to fetch-like response
          res = {
            ok: nodeRes.ok,
            status: nodeRes.status,
            statusText: nodeRes.statusText,
            headers: nodeRes.headers || {},
            text: async () => nodeRes.body,
            json: async () => {
              try { return JSON.parse(nodeRes.body); } catch { return nodeRes.body; }
            }
          };
        }

        // Handle token refresh on 401
        if (res.status === 401 && cfg.refreshToken) {
          try {
            let refreshRes;
            const refreshUrl = `${cfg.baseUrl}/api/v1/${cfg.tenant}/auth/refresh`;
            const refreshBody = JSON.stringify({ refresh_token: cfg.refreshToken });
            if (usedFallback) {
              const nodeRefresh = await window.desktop.nodeFetch(refreshUrl, {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: refreshBody
              });
              if (nodeRefresh.error) throw new Error(`nodeFetch refresh error: ${nodeRefresh.error}`);
              refreshRes = { ok: nodeRefresh.ok, body: nodeRefresh.body };
            } else {
              try {
                refreshRes = await fetch(refreshUrl, {
                  method: 'POST',
                  headers: {'Content-Type':'application/json'},
                  body: refreshBody
                });
              } catch (err) {
                const nodeRefresh = await window.desktop.nodeFetch(refreshUrl, {
                  method: 'POST',
                  headers: {'Content-Type':'application/json'},
                  body: refreshBody
                });
                if (nodeRefresh.error) throw new Error(`nodeFetch refresh error: ${nodeRefresh.error}`);
                refreshRes = { ok: nodeRefresh.ok, body: nodeRefresh.body };
              }
            }

            if (refreshRes.ok) {
              const refreshData = typeof refreshRes.body === 'string' ? JSON.parse(refreshRes.body) : refreshRes.body;
              cfg.accessToken = refreshData.access_token;
              cfg.refreshToken = refreshData.refresh_token || cfg.refreshToken;
              await save();
              
              // Retry original request with new token
              const newHeaders = {...headers, Authorization: `Bearer ${cfg.accessToken}`};
              if (usedFallback) {
                const retryRes = await window.desktop.nodeFetch(url, {...options, headers: newHeaders});
                if (retryRes.error) throw new Error(`nodeFetch retry error: ${retryRes.error}`);
                res = {
                  ok: retryRes.ok,
                  status: retryRes.status,
                  statusText: retryRes.statusText,
                  headers: retryRes.headers || {},
                  text: async () => retryRes.body,
                  json: async () => {
                    try { return JSON.parse(retryRes.body); } catch { return retryRes.body; }
                  }
                };
              } else {
                res = await fetch(url, {...options, headers: newHeaders});
              }
            }
          } catch (err) {
            console.error('api.request token refresh failed:', err.message);
            throw new Error(`Token refresh error: ${err.message || err}`);
          }
        }

        // Return response if OK
        if (res.ok) {
          return await safeJson(res);
        }

        // Handle HTTP errors (non-network)
        let msg = await safeJson(res);
        // If it's an authentication error, provide a clear marker so the UI can react
        if (res.status === 401) {
          const detail = (msg && (msg.detail || msg.message || msg.code)) || `HTTP ${res.status}`;
          throw new Error('AUTH_REQUIRED: ' + detail);
        }
        const errorMsg = (msg && (msg.message || msg.code)) || `HTTP ${res.status}`;
        
        // Don't retry on HTTP errors (they're not transient)
        throw new Error(errorMsg);

      } catch (err) {
        // Check if this is a network error and we can retry
        const isNetworkError = err.message.includes('Failed to fetch') || 
                               err.message.includes('nodeFetch error') ||
                               err.message.includes('Network error');
        
        if (isNetworkError && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          console.warn(`api.request: network error, retrying in ${delay}ms...`, err.message);
          await new Promise(r => setTimeout(r, delay));
          continue; // Retry
        }

        // Throw error (either non-network or all retries exhausted)
        throw err;
      }
    }

    throw new Error('request: unexpected state');
  }

  async function safeJson(res){
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text || null; }
  }

  async function login(email, password){
    try {
      // tentativa padrão (username)
      const data = await request(`/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ username: email, password })
      });
      cfg.accessToken = data.access_token;
      cfg.refreshToken = data.refresh_token;
      await save();
      return data;
    } catch (err) {
      // se falhar, tentar com campo "email"
      const data = await request(`/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      cfg.accessToken = data.access_token;
      cfg.refreshToken = data.refresh_token;
      await save();
      return data;
    }
  }

  async function gateScan(payload){
    return request(`/gate/scan`,{
      method:'POST',
      body: JSON.stringify(payload)
    });
  }

  async function gateBulk(payload){
    return request(`/gate/scan`,{
      method:'POST',
      body: JSON.stringify(payload)
    });
  }

  // ===== STUDENTS =====
  async function listStudents(params={}){
    try {
      const qs = new URLSearchParams(params);
      return await request(`/students${qs.toString() ? '?' + qs.toString() : ''}`, { method:'GET' });
    } catch (e) {
      console.warn('listStudents endpoint not available');
      return [];
    }
  }
  async function createStudent(data){
    try {
      return await request(`/students`, { method:'POST', body: JSON.stringify(data) });
    } catch (e) {
      console.warn('createStudent endpoint not available');
      throw e;
    }
  }
  async function getStudent(studentId){
    try {
      return await request(`/students/${studentId}`, { method:'GET' });
    } catch (e) {
      console.warn('getStudent endpoint not available');
      return null;
    }
  }
  async function updateStudent(studentId, data){
    try {
      return await request(`/students/${studentId}`, { method:'PUT', body: JSON.stringify(data) });
    } catch (e) {
      console.warn('updateStudent endpoint not available');
      throw e;
    }
  }
  async function deleteStudent(studentId){
    try {
      return await request(`/students/${studentId}`, { method:'DELETE' });
    } catch (e) {
      console.warn('deleteStudent endpoint not available');
      throw e;
    }
  }

  async function attendance(params={}){
    // Garante que temos pelo menos um parâmetro de filtro
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([k,v]) => v !== '' && v !== null && v !== undefined)
    );
    
    if (Object.keys(cleanParams).length === 0) {
      console.warn('attendance: nenhum filtro fornecido, tentando obter todos os registros de presença');
      // Lança um erro para o usuário saber que precisa preencher os campos
      throw new Error('É necessário fornecer o ID do Evento.');
    }
    
    const qs = new URLSearchParams(cleanParams);
    const url = `/attendance?${qs.toString()}`;
    console.log('URL da requisição de presença:', url);
    
    // A URL agora inclui os parâmetros, ex: /attendance?event_id=123
    return request(url, { method:'GET' });
  }

  // ===== CLIENTES =====
  async function listClientes(){
    try {
      return await request(`/client/`, { method:'GET' });
    } catch (e) {
      console.warn('getClient endpoint not available');
      return {};
    }
  }
  async function getClient(){
    try {
      return await request(`/client/`, { method:'GET' });
    } catch (e) {
      console.warn('getClient endpoint not available');
      return {};
    }
  }
  async function updateClient(data){
    try {
      return await request(`/client`, { method:'PUT', body: JSON.stringify(data) });
    } catch (e) {
      console.warn('updateClient endpoint not available');
      throw e;
    }
  }
  async function getMe(){
    // Get current user info (assuming there's a /users/me endpoint or get current user from context)
    try {
      return await request(`/users`, { method:'GET' });
    } catch (e) {
      // If endpoint doesn't exist, return synthetic user from token
      return { id: 1, name: cfg.tenant, email: 'user@' + cfg.tenant, roles: ['admin'] };
    }
  }

  // ===== USERS =====
  async function listUsers(params={}){
    try {
      const qs = new URLSearchParams(params);
      return await request(`/users${qs.toString() ? '?' + qs.toString() : ''}`, { method:'GET' });
    } catch (e) {
      console.warn('listUsers endpoint not available');
      return [];
    }
  }
  async function getUser(userId){
    try {
      return await request(`/users/${userId}`, { method:'GET' });
    } catch (e) {
      console.warn('getUser endpoint not available');
      return null;
    }
  }
  async function createUser(data){
    try {
      return await request(`/users`, { method:'POST', body: JSON.stringify(data) });
    } catch (e) {
      console.warn('createUser endpoint not available');
      throw e;
    }
  }
  async function updateUser(userId, data){
    try {
      return await request(`/users/${userId}`, { method:'PATCH', body: JSON.stringify(data) });
    } catch (e) {
      console.warn('updateUser endpoint not available');
      throw e;
    }
  }
  async function deleteUser(userId){
    try {
      return await request(`/users/${userId}`, { method:'DELETE' });
    } catch (e) {
      console.warn('deleteUser endpoint not available');
      throw e;
    }
  }

  // ===== EVENTOS =====
  async function listEventos(params={}){
    try {
      const qs = new URLSearchParams(params);
      return await request(`/events${qs.toString() ? '?' + qs.toString() : ''}`, { method:'GET' });
    } catch (e) {
      console.warn('listEventos endpoint not available, returning mock data');
      return [];
    }
  }
  async function createEvento(data){
    try {
      return await request(`/events`, { method:'POST', body: JSON.stringify(data) });
    } catch (e) {
      console.warn('createEvento endpoint not available');
      throw e;
    }
  }
  async function getEvento(id){
    try {
      return await request(`/events/${id}`, { method:'GET' });
    } catch (e) {
      console.warn('getEvento endpoint not available');
      throw e;
    }
  }
  async function updateEvento(id, data){
    try {
      return await request(`/events/${id}`, { method:'PUT', body: JSON.stringify(data) });
    } catch (e) {
      console.warn('updateEvento endpoint not available');
      throw e;
    }
  }

  // ===== DIAS =====
  async function listDias(eventId, params={}){
    const qs = new URLSearchParams(params);
    return request(`/events/${eventId}/days${qs.toString() ? '?' + qs.toString() : ''}`, { method:'GET' });
  }
  async function createDia(eventId, data){
    return request(`/events/${eventId}/days`, { method:'POST', body: JSON.stringify(data) });
  }
  async function getDia(eventId, dayId){
    return request(`/events/${eventId}/days/${dayId}`, { method:'GET' });
  }
  async function updateDia(eventId, dayId, data){
    return request(`/events/${eventId}/days/${dayId}`, { method:'PUT', body: JSON.stringify(data) });
  }

  // ===== INSCRICOES (ENROLLMENTS) =====
  async function listInscricoes(params={}){
    try {
      const qs = new URLSearchParams(params);
      return await request(`/enrollments${qs.toString() ? '?' + qs.toString() : ''}`, { method:'GET' });
    } catch (e) {
      console.warn('listInscricoes endpoint not available, returning mock data');
      return [];
    }
  }
  async function createInscricao(data){
    try {
      // Backend uses POST to /events/{event_id}/enroll with student_id query param
      return await request(`/events/${data.event_id}/enroll?student_id=${data.student_id}`, { method:'POST', body: JSON.stringify({}) });
    } catch (e) {
      console.warn('createInscricao endpoint not available');
      throw e;
    }
  }
  async function getInscricao(id){
    try {
      return await request(`/enrollments/${id}`, { method:'GET' });
    } catch (e) {
      console.warn('getInscricao endpoint not available');
      throw e;
    }
  }
  async function updateInscricao(id, data){
    try {
      return await request(`/enrollments/${id}`, { method:'PUT', body: JSON.stringify(data) });
    } catch (e) {
      console.warn('updateInscricao endpoint not available');
      throw e;
    }
  }
  async function confirmInscricao(id, data){
    try {
      // Cancel enrollment uses /enrollments/{enr_id}/cancel
      return await request(`/enrollments/${id}/cancel`, { method:'PATCH', body: JSON.stringify(data) });
    } catch (e) {
      console.warn('confirmInscricao endpoint not available');
      throw e;
    }
  }
  async function cancelInscricao(enrollmentId){
    try {
      return await request(`/enrollments/${enrollmentId}/cancel`, { method:'PATCH' });
    } catch (e) {
      console.warn('cancelInscricao endpoint not available');
      throw e;
    }
  }

  // ===== GATE (Portaria) =====
  async function gateStats(eventId, params={}){
    const qs = new URLSearchParams(params);
    return request(`/gate/stats/${eventId}${qs.toString() ? '?' + qs.toString() : ''}`, { method:'GET' });
  }

  // ===== CERTIFICADOS (CERTIFICATES) =====
  async function listCertificados(params={}){
    try {
      const qs = new URLSearchParams(params);
      return await request(`/certificates${qs.toString() ? '?' + qs.toString() : ''}`, { method:'GET' });
    } catch (e) {
      console.warn('listCertificados endpoint not available');
      return [];
    }
  }
  async function getCertificado(certificateId){
    try {
      return await request(`/certificates/${certificateId}`, { method:'GET' });
    } catch (e) {
      console.warn('getCertificado endpoint not available');
      return null;
    }
  }
  async function issueCertificate(enrollmentId, data={}){
    try {
      const qs = new URLSearchParams(data);
      return await request(`/certificates/issue/${enrollmentId}${qs.toString() ? '?' + qs.toString() : ''}`, { method:'POST', body: JSON.stringify({}) });
    } catch (e) {
      console.warn('issueCertificate endpoint not available');
      throw e;
    }
  }
  async function issueCertificateBatch(eventId, data={}){
    try {
      const qs = new URLSearchParams(data);
      return await request(`/certificates/batch/${eventId}${qs.toString() ? '?' + qs.toString() : ''}`, { method:'POST', body: JSON.stringify({}) });
    } catch (e) {
      console.warn('issueCertificateBatch endpoint not available');
      return [];
    }
  }
  async function checkCertificateEligibility(enrollmentId, mode='day'){
    try {
      return await request(`/certificates/eligibility/${enrollmentId}?mode=${mode}`, { method:'GET' });
    } catch (e) {
      console.warn('checkCertificateEligibility endpoint not available');
      return { eligible: false };
    }
  }
  async function listCertificatesByStudent(studentId){
    try {
      return await request(`/certificates/by-student/${studentId}`, { method:'GET' });
    } catch (e) {
      console.warn('listCertificatesByStudent endpoint not available');
      return [];
    }
  }

  // ===== RELATORIOS (REPORTS) =====
  async function getPresencaReport(params={}){
    try {
      const qs = new URLSearchParams(params);
      return await request(`/reports/presenca${qs.toString() ? '?' + qs.toString() : ''}`, { method:'GET' });
    } catch (e) {
      console.warn('getPresencaReport endpoint not available');
      return [];
    }
  }
  async function getStatsReport(params={}){
    try {
      const qs = new URLSearchParams(params);
      return await request(`/reports/stats${qs.toString() ? '?' + qs.toString() : ''}`, { method:'GET' });
    } catch (e) {
      console.warn('getStatsReport endpoint not available');
      return {};
    }
  }

  // ===== ROLES =====
  async function listRoles(params={}){
    try {
      const qs = new URLSearchParams(params);
      return await request(`/roles${qs.toString() ? '?' + qs.toString() : ''}`, { method:'GET' });
    } catch (e) {
      console.warn('listRoles endpoint not available');
      return [];
    }
  }

  // ===== CLIENT (Tenant) =====
  async function getMyClient(params={}){
    try {
      const qs = new URLSearchParams(params);
      return await request(`/client${qs.toString() ? '?' + qs.toString() : ''}`, { method:'GET' });
    } catch (e) {
      console.warn('getMyClient endpoint not available');
      return {};
    }
  }
  async function updateMyClient(data){
    try {
      return await request(`/client`, { method:'PUT', body: JSON.stringify(data) });
    } catch (e) {
      console.warn('updateMyClient endpoint not available');
      throw e;
    }
  }

  return {
    cfg, load, save, setBaseUrl, setTenant, setTokens, login, gateScan, gateBulk, attendance,
    // clientes
    listClientes, getClient, updateClient,
    // usuarios/users
    listUsers, createUser, getUser, updateUser, deleteUser, getMe,
    // estudiantes/students
    listStudents, createStudent, getStudent, updateStudent, deleteStudent,
    // eventos
    listEventos, createEvento, getEvento, updateEvento,
    // dias
    listDias, createDia, getDia, updateDia,
    // inscricoes
    listInscricoes, createInscricao, getInscricao, updateInscricao, confirmInscricao, cancelInscricao,
    // gate
    gateStats,
    // certificados
    listCertificados, getCertificado, issueCertificate, issueCertificateBatch, checkCertificateEligibility, listCertificatesByStudent,
    // reports
    getPresencaReport, getStatsReport,
    // roles
    listRoles,
    // client
    getMyClient, updateMyClient
  };
})();
