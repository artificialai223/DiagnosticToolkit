const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { runCommand } = require('./exec');

function makePageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Live Diagnostics Dashboard</title>
  <style>
    :root{--bg:#0b1020;--panel:#121a2b;--line:#28324a;--text:#e6ecff;--muted:#9bacd6;--ok:#22c55e;--warn:#f59e0b;--bad:#ef4444;--critical:#dc2626;--accent:#60a5fa}
    *{box-sizing:border-box}
    body{margin:0;background:radial-gradient(1200px 800px at 10% -10%,#1b2a4a 0%,#0b1020 35%,#070b16 100%);color:var(--text);font:14px/1.4 Segoe UI,system-ui,Arial,sans-serif}
    .wrap{max-width:1240px;margin:20px auto;padding:0 14px}
    .top{display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:12px}
    .panel{background:linear-gradient(180deg,#121a2b,#0f1727);border:1px solid var(--line);border-radius:12px;padding:14px;box-shadow:0 10px 24px rgba(0,0,0,.25)}
    .title{font-size:20px;font-weight:700;letter-spacing:.2px}
    .muted{color:var(--muted)}
    .big{font-size:34px;font-weight:700}
    .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-weight:700;font-size:12px;text-transform:uppercase}
    .sev-none{background:#064e3b;color:#bbf7d0}.sev-low{background:#1d4ed8;color:#dbeafe}.sev-medium{background:#92400e;color:#fde68a}.sev-high{background:#7c2d12;color:#fed7aa}.sev-critical{background:#7f1d1d;color:#fecaca}
    .progress-track{margin-top:10px;height:14px;background:#0a1222;border:1px solid #2b3650;border-radius:999px;overflow:hidden}
    .progress-bar{height:100%;width:0%;background:linear-gradient(90deg,#3b82f6,#22d3ee,#22c55e);transition:width .45s ease}
    .pulse{animation:pulse 1.8s infinite}
    @keyframes pulse{0%{opacity:1}50%{opacity:.55}100%{opacity:1}}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
    .module{padding:12px;border-radius:10px;border:1px solid var(--line);background:#0d1526;transform:translateY(0);transition:transform .2s ease,border-color .2s ease}
    .module:hover{transform:translateY(-2px);border-color:#3b82f6}
    .module h4{margin:0 0 8px 0;font-size:14px}
    .row{display:flex;justify-content:space-between;gap:8px}
    .k{color:var(--muted)}
    .v{font-weight:600}
    .module-bar{height:8px;background:#0a1222;border:1px solid #293550;border-radius:999px;overflow:hidden;margin-top:8px}
    .module-bar > span{display:block;height:100%;width:0;background:linear-gradient(90deg,#60a5fa,#34d399);transition:width .35s ease}
    .causes li{margin:8px 0;padding:8px;border:1px solid #2f3c5e;background:#0b1323;border-radius:8px}
    .footer{margin-top:12px;color:var(--muted);font-size:12px}
    .btn{background:#1f3b70;color:#dbeafe;border:1px solid #3b82f6;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:600}
    .btn:hover{background:#2b4f8f}
    .modal-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.72);display:none;align-items:center;justify-content:center;padding:18px;z-index:50}
    .modal-backdrop.open{display:flex}
    .modal{width:min(920px,96vw);max-height:88vh;overflow:auto;background:#0f172a;border:1px solid #334155;border-radius:14px;padding:14px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
    .modal-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}
    .check-list{display:grid;grid-template-columns:1fr;gap:8px}
    .check-item{display:flex;justify-content:space-between;align-items:center;border:1px solid #2f3c5e;border-radius:8px;padding:8px;background:#0b1323}
    .check-left{display:flex;align-items:center;gap:8px;min-width:0}
    .check-name{white-space:normal;word-break:break-word}
    .icon-ok{color:#22c55e;font-weight:700}
    .icon-fail{color:#ef4444;font-weight:700}
    .icon-run{width:14px;height:14px;border:2px solid #60a5fa;border-top-color:transparent;border-radius:50%;display:inline-block;animation:spin .75s linear infinite}
    .icon-pending{color:#9ca3af;font-weight:700}
    @keyframes spin{to{transform:rotate(360deg)}}
    .adv-wrap{margin-top:10px}
    .adv-data{margin-top:8px;display:none;border:1px solid #334155;border-radius:8px;background:#020617;padding:10px;max-height:290px;overflow:auto}
    .adv-data.open{display:block}
    .adv-grid{display:grid;grid-template-columns:1fr;gap:10px}
    .adv-card{border:1px solid #334155;border-radius:8px;background:#0b1323;padding:8px}
    .adv-title{font-size:12px;font-weight:700;color:#93c5fd;margin-bottom:6px;text-transform:capitalize}
    .adv-table{width:100%;border-collapse:collapse;font-size:12px}
    .adv-table th,.adv-table td{border:1px solid #334155;padding:5px 6px;vertical-align:top}
    .adv-table th{color:#93c5fd;text-align:left}
    .adv-kv{display:grid;grid-template-columns:180px 1fr;gap:6px;font-size:12px;margin-bottom:4px}
    .adv-k{color:#93c5fd}
    .adv-v{color:#dbeafe;word-break:break-word}
    .adv-text{margin:0;white-space:pre-wrap;word-break:break-word;color:#dbeafe;font-family:Consolas,Menlo,monospace;font-size:12px;line-height:1.4}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <section class="panel">
        <div class="title">Windows Diagnostic Toolkit - Live Run</div>
        <div id="runState" class="muted pulse">Initializing...</div>
        <div class="progress-track"><div id="globalBar" class="progress-bar"></div></div>
        <div style="margin-top:8px" class="muted"><span id="globalPct">0%</span> complete | <span id="globalStep">0/0</span></div>
      </section>
      <section class="panel">
        <div class="muted">Live Health Score</div>
        <div id="score" class="big">--</div>
        <div id="band" class="badge sev-none">pending</div>
      </section>
    </div>

    <section class="panel" style="margin-bottom:12px;">
      <h3 style="margin:0 0 8px 0">Root Cause Analysis</h3>
      <ul id="causes" class="causes"><li class="muted">Awaiting analysis...</li></ul>
    </section>

    <section class="panel">
      <h3 style="margin:0 0 8px 0">Module Progress</h3>
      <div id="modules" class="grid"></div>
      <div class="footer" id="footer">Waiting for diagnostics stream...</div>
    </section>
  </div>

  <div id="moduleModal" class="modal-backdrop" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-head">
        <h3 id="modalTitle" style="margin:0">Module details</h3>
        <button id="modalClose" class="btn" type="button">Close</button>
      </div>
      <div id="modalOverall" class="panel" style="margin-bottom:10px;padding:10px"></div>
      <div id="modalChecks" class="check-list"></div>
      <div class="adv-wrap">
        <button id="modalAdvancedToggle" class="btn" type="button">Advanced view</button>
        <div id="modalAdvancedData" class="adv-data"><div id="modalAdvancedParsed" class="adv-grid"></div></div>
      </div>
    </div>
  </div>

  <script>
    const state = { modules: {}, total: 0, done: 0, selectedModuleId: null, advancedOpen: false };
    let ws = null;
    let wsConnected = false;
    let reconnectTimer = null;
    let pollingTimer = null;
    const modal = document.getElementById('moduleModal');
    const modalClose = document.getElementById('modalClose');
    const modalAdvancedToggle = document.getElementById('modalAdvancedToggle');
    const modalAdvancedData = document.getElementById('modalAdvancedData');
    const modalAdvancedParsed = document.getElementById('modalAdvancedParsed');

    modalClose.addEventListener('click', () => {
      modal.classList.remove('open');
      state.selectedModuleId = null;
      state.advancedOpen = false;
      modalAdvancedData.classList.remove('open');
    });

    modal.addEventListener('click', (event) => {
      if(event.target === modal){
        modal.classList.remove('open');
        state.selectedModuleId = null;
        state.advancedOpen = false;
        modalAdvancedData.classList.remove('open');
      }
    });

    modalAdvancedToggle.addEventListener('click', () => {
      state.advancedOpen = !state.advancedOpen;
      if(state.advancedOpen){
        modalAdvancedData.classList.add('open');
        modalAdvancedToggle.textContent = 'Hide advanced view';
      } else {
        modalAdvancedData.classList.remove('open');
        modalAdvancedToggle.textContent = 'Advanced view';
      }
    });

    function sevClass(sev){ return 'sev-' + (sev || 'none'); }

    function escapeHtml(value){
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function tryParseMaybeJson(value){
      if(typeof value !== 'string') return value;
      const trimmed = value.trim();
      if(!trimmed) return '';
      if((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))){
        try { return JSON.parse(trimmed); } catch (error) { return value; }
      }
      return value;
    }

    function renderTableFromArray(arr){
      if(!arr.length) return '<div class="adv-v">(empty)</div>';
      const objectRows = arr.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
      if(objectRows.length !== arr.length){
        return '<div class="adv-text">' + escapeHtml(JSON.stringify(arr, null, 2)) + '</div>';
      }
      const keys = [...new Set(objectRows.flatMap((row) => Object.keys(row)))].slice(0, 8);
      let html = '<table class="adv-table"><thead><tr>';
      keys.forEach((key) => { html += '<th>' + escapeHtml(key) + '</th>'; });
      html += '</tr></thead><tbody>';
      objectRows.slice(0, 20).forEach((row) => {
        html += '<tr>';
        keys.forEach((key) => {
          const cell = row[key] === undefined ? '' : row[key];
          html += '<td>' + escapeHtml(typeof cell === 'object' ? JSON.stringify(cell) : String(cell)) + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      if(objectRows.length > 20){
        html += '<div class="muted" style="margin-top:6px">Showing first 20 rows of ' + objectRows.length + '.</div>';
      }
      return html;
    }

    function renderObjectAsKv(obj){
      const keys = Object.keys(obj || {});
      if(!keys.length) return '<div class="adv-v">(empty object)</div>';
      let html = '';
      keys.slice(0, 40).forEach((key) => {
        const raw = obj[key];
        const val = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
        html += '<div class="adv-kv"><div class="adv-k">' + escapeHtml(key) + '</div><div class="adv-v">' + escapeHtml(val) + '</div></div>';
      });
      if(keys.length > 40){
        html += '<div class="muted">Showing first 40 fields of ' + keys.length + '.</div>';
      }
      return html;
    }

    function renderParsedRawData(rawData){
      if(!rawData || (typeof rawData === 'object' && Object.keys(rawData).length === 0)){
        return '<div class="adv-card"><div class="adv-v">No command return data available.</div></div>';
      }
      let html = '';
      const sections = Object.keys(rawData);
      sections.forEach((section) => {
        const parsed = tryParseMaybeJson(rawData[section]);
        html += '<div class="adv-card"><div class="adv-title">' + escapeHtml(section) + '</div>';
        if(Array.isArray(parsed)){
          html += renderTableFromArray(parsed);
        } else if(parsed && typeof parsed === 'object'){
          html += renderObjectAsKv(parsed);
        } else {
          const text = String(parsed || '');
          const shortened = text.length > 2500 ? text.slice(0, 2500) + '\\n...truncated...' : text;
          html += '<div class="adv-text">' + escapeHtml(shortened || '(no output)') + '</div>';
        }
        html += '</div>';
      });
      if(!html){
        return '<div class="adv-card"><div class="adv-v">No command return data available.</div></div>';
      }
      return html;
    }

    function statusIcon(status){
      if(status === 'done' || status === 'ok'){ return '<span class="icon-ok">✓</span>'; }
      if(status === 'failed'){ return '<span class="icon-fail">✕</span>'; }
      if(status === 'running'){ return '<span class="icon-run"></span>'; }
      return '<span class="icon-pending">•</span>';
    }

    function updateModal(){
      if(!state.selectedModuleId || !state.modules[state.selectedModuleId]) return;
      const moduleData = state.modules[state.selectedModuleId];
      document.getElementById('modalTitle').textContent = 'Module details: ' + state.selectedModuleId;
      const overallSeverity = moduleData.severityValue || 'none';
      const overallStatus = moduleData.statusValue || 'pending';
      const overallReason = moduleData.reasonValue || 'Waiting to be processed';
      document.getElementById('modalOverall').innerHTML =
        '<div class="row"><span class="k">Overall status</span><span class="v">' + overallStatus + '</span></div>' +
        '<div class="row"><span class="k">Severity</span><span class="badge ' + sevClass(overallSeverity) + '">' + overallSeverity + '</span></div>' +
        '<div style="margin-top:6px" class="muted">' + overallReason + '</div>';

      const checksEl = document.getElementById('modalChecks');
      const checks = moduleData.checks || [];
      checksEl.innerHTML = '';
      checks.forEach((check) => {
        const item = document.createElement('div');
        item.className = 'check-item';
        item.innerHTML =
          '<div class="check-left">' + statusIcon(check.status) + '<span class="check-name">' + check.name + '</span></div>' +
          '<span class="muted">' + (check.detail || '') + '</span>';
        checksEl.appendChild(item);
      });

      modalAdvancedParsed.innerHTML = renderParsedRawData(moduleData.rawData);
    }

    function openModal(moduleId){
      state.selectedModuleId = moduleId;
      state.advancedOpen = false;
      modalAdvancedData.classList.remove('open');
      modalAdvancedToggle.textContent = 'Advanced view';
      modal.classList.add('open');
      updateModal();
    }

    function ensureModule(id){
      if(state.modules[id]) return state.modules[id];
      const root = document.createElement('div');
      root.className = 'module';
      root.innerHTML =
        '<div class="row"><h4 style="margin:0">' + id + '</h4><button type="button" class="btn" data-k="details">Details</button></div>' +
        '<div class="row"><span class="k">Status</span><span class="v" data-k="status">pending</span></div>' +
        '<div class="row"><span class="k">Severity</span><span class="badge sev-none" data-k="severity">none</span></div>' +
        '<div class="row"><span class="k">Reason</span><span class="v" data-k="reason">-</span></div>' +
        '<div class="module-bar"><span data-k="bar"></span></div>';
      document.getElementById('modules').appendChild(root);
      const ref = {
        root,
        status: root.querySelector('[data-k="status"]'),
        severity: root.querySelector('[data-k="severity"]'),
        reason: root.querySelector('[data-k="reason"]'),
        bar: root.querySelector('[data-k="bar"]'),
        details: root.querySelector('[data-k="details"]'),
        checks: [],
        statusValue: 'pending',
        severityValue: 'none',
        reasonValue: 'Waiting to be processed',
        runningIndex: 0
        ,
        rawData: {}
      };
      ref.details.addEventListener('click', () => openModal(id));
      state.modules[id] = ref;
      return ref;
    }

    function setGlobal(done,total){
      const pct = total ? Math.round((done/total)*100) : 0;
      document.getElementById('globalBar').style.width = pct + '%';
      document.getElementById('globalPct').textContent = pct + '%';
      document.getElementById('globalStep').textContent = String(done) + '/' + String(total);
    }

    function updateScore(score, band){
      const scoreEl = document.getElementById('score');
      const bandEl = document.getElementById('band');
      scoreEl.textContent = typeof score === 'number' ? String(score) : '--';
      bandEl.textContent = band || 'pending';
      bandEl.className = 'badge ' + sevClass(band === 'unhealthy' ? 'critical' : band === 'degraded' ? 'high' : band === 'moderate' ? 'medium' : 'low');
    }

    function applyMessage(msg){
      if(!msg || !msg.type) return;
      if(msg.type === 'init'){
        state.total = msg.totalModules || 0;
        document.getElementById('runState').textContent = 'Diagnostics started';
        setGlobal(0, state.total);
        const listed = msg.modules || [];
        listed.forEach((item) => {
          const moduleRef = ensureModule(item.id);
          moduleRef.status.textContent = item.status || 'pending';
          moduleRef.severity.textContent = item.severity || 'none';
          moduleRef.severity.className = 'badge ' + sevClass(item.severity || 'none');
          moduleRef.reason.textContent = item.reason || 'Waiting to be processed';
          moduleRef.statusValue = item.status || 'pending';
          moduleRef.severityValue = item.severity || 'none';
          moduleRef.reasonValue = item.reason || 'Waiting to be processed';
          moduleRef.checks = (item.checks || []).map((name) => ({ name, status: 'pending', detail: 'Waiting' }));
          moduleRef.bar.style.width = '10%';
        });
        updateModal();
        return;
      }
      if(msg.type === 'progress'){
        state.total = msg.totalModules || state.total;
        state.done = msg.completedModules || state.done;
        const m = ensureModule(msg.moduleId || 'unknown');
        m.status.textContent = msg.phase || 'running';
        m.reason.textContent = msg.note || '-';
        m.statusValue = msg.phase || 'running';
        m.reasonValue = msg.note || '-';
        if(msg.phase === 'running' && m.checks.length){
          m.checks.forEach((check) => {
            if(check.status === 'running'){
              check.status = 'done';
              check.detail = 'Completed';
            }
          });
          const idx = Math.min(m.runningIndex, m.checks.length - 1);
          if(idx >= 0){
            m.checks[idx].status = 'running';
            m.checks[idx].detail = 'In progress';
          }
          m.runningIndex = Math.min(m.runningIndex + 1, m.checks.length - 1);
        }
        m.bar.style.width = msg.phase === 'done' || msg.phase === 'failed' ? '100%' : '65%';
        setGlobal(state.done, state.total);
        document.getElementById('runState').textContent = msg.label || 'Running checks...';
        document.getElementById('footer').textContent = new Date().toLocaleTimeString() + ' - ' + (msg.label || 'Running checks');
        updateModal();
        return;
      }
      if(msg.type === 'module-result'){
        const m = ensureModule(msg.moduleId);
        m.status.textContent = msg.status;
        m.severity.textContent = msg.severity || 'none';
        m.severity.className = 'badge ' + sevClass(msg.severity || 'none');
        m.reason.textContent = (msg.reasoning || '-').slice(0,120);
        m.statusValue = msg.status;
        m.severityValue = msg.severity || 'none';
        m.reasonValue = msg.reasoning || '-';
        m.rawData = msg.rawData || {};
        const findings = Array.isArray(msg.findings) ? msg.findings : [];
        if(findings.length){
          m.checks = findings.map((finding, index) => ({
            name: finding.reason || ('Check ' + String(index + 1)),
            status: finding.ok === false ? 'failed' : 'done',
            detail: finding.ok === false ? 'Failed' : 'Passed'
          }));
        } else if(m.checks.length){
          m.checks = m.checks.map((check) => ({
            name: check.name,
            status: msg.status === 'fail' ? 'failed' : 'done',
            detail: msg.status === 'fail' ? 'Failed' : 'Completed'
          }));
        }
        m.bar.style.width = '100%';
        updateModal();
        return;
      }
      if(msg.type === 'score-update'){
        updateScore(msg.score, msg.band);
        return;
      }
      if(msg.type === 'final'){
        updateScore(msg.scoreSummary && msg.scoreSummary.score, msg.scoreSummary && msg.scoreSummary.band);
        const causesEl = document.getElementById('causes');
        causesEl.innerHTML = '';
        const causes = (msg.diagnosis && msg.diagnosis.probableCauses) || [];
        if(!causes.length){
          causesEl.innerHTML = '<li class="muted">No dominant root cause identified.</li>';
        } else {
          causes.forEach((c) => {
            const li = document.createElement('li');
            li.innerHTML = '<span class="badge ' + sevClass(c.severity) + '">' + c.severity + '</span> <strong>' + c.title + '</strong><br>' + c.explanation;
            causesEl.appendChild(li);
          });
        }
        document.getElementById('runState').textContent = 'Diagnostics complete';
        document.getElementById('runState').classList.remove('pulse');
        updateModal();
      }
    }

    async function fetchStateSnapshot(){
      try {
        const response = await fetch('/state', { cache: 'no-store' });
        if(!response.ok) return;
        const snapshot = await response.json();
        if(snapshot.init) applyMessage(snapshot.init);
        (snapshot.progress || []).forEach((msg) => applyMessage(msg));
        (snapshot.moduleResults || []).forEach((msg) => applyMessage(msg));
        if(snapshot.score) applyMessage(snapshot.score);
        if(snapshot.final) applyMessage(snapshot.final);
      } catch (error) {
      }
    }

    function scheduleReconnect(){
      if(reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWebSocket();
      }, 1500);
    }

    function connectWebSocket(){
      if(ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)){
        return;
      }
      ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');

      ws.onopen = () => {
        wsConnected = true;
        document.getElementById('footer').textContent = 'Connected to diagnostics stream.';
        if(pollingTimer){
          clearInterval(pollingTimer);
          pollingTimer = null;
        }
        fetchStateSnapshot();
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        applyMessage(msg);
      };

      ws.onerror = () => {
        wsConnected = false;
      };

      ws.onclose = () => {
        wsConnected = false;
        document.getElementById('footer').textContent = 'Stream reconnecting... using fallback sync.';
        if(!pollingTimer){
          pollingTimer = setInterval(fetchStateSnapshot, 1500);
        }
        scheduleReconnect();
      };
    }
    connectWebSocket();
    fetchStateSnapshot();
    if(!pollingTimer){
      pollingTimer = setInterval(() => {
        if(!wsConnected){
          fetchStateSnapshot();
        }
      }, 1500);
    }
  </script>
</body>
</html>`;
}

function createBroadcaster(wss) {
  const cache = {
    init: null,
    progressByModule: new Map(),
    moduleResultsByModule: new Map(),
    score: null,
    final: null
  };

  function getSnapshot() {
    return {
      init: cache.init,
      progress: Array.from(cache.progressByModule.values()),
      moduleResults: Array.from(cache.moduleResultsByModule.values()),
      score: cache.score,
      final: cache.final
    };
  }

  function replayToClient(client) {
    if (client.readyState !== 1) {
      return;
    }

    if (cache.init) {
      client.send(JSON.stringify(cache.init));
    }

    for (const payload of cache.progressByModule.values()) {
      client.send(JSON.stringify(payload));
    }

    for (const payload of cache.moduleResultsByModule.values()) {
      client.send(JSON.stringify(payload));
    }

    if (cache.score) {
      client.send(JSON.stringify(cache.score));
    }

    if (cache.final) {
      client.send(JSON.stringify(cache.final));
    }
  }

  wss.on('connection', (client) => {
    replayToClient(client);
  });

  function broadcast(payload) {
    if (payload && payload.type === 'init') {
      cache.init = payload;
      cache.final = null;
      cache.score = null;
      cache.progressByModule.clear();
      cache.moduleResultsByModule.clear();
    }

    if (payload && payload.type === 'progress' && payload.moduleId) {
      cache.progressByModule.set(payload.moduleId, payload);
    }

    if (payload && payload.type === 'module-result' && payload.moduleId) {
      cache.moduleResultsByModule.set(payload.moduleId, payload);
    }

    if (payload && payload.type === 'score-update') {
      cache.score = payload;
    }

    if (payload && payload.type === 'final') {
      cache.final = payload;
    }

    const body = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(body);
      }
    }
  }

  return {
    broadcast,
    getSnapshot
  };
}

async function startLiveDashboardServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const broadcaster = createBroadcaster(wss);

  app.get('/', (req, res) => {
    res.type('html').send(makePageHtml());
  });

  app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
  });

  app.get('/state', (req, res) => {
    res.json(broadcaster.getSnapshot());
  });

  const port = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(address && address.port ? address.port : 0);
    });
  });

  const url = `http://127.0.0.1:${port}`;
  await runCommand(`start \"\" \"${url}\"`);

  return {
    port,
    url,
    broadcast: broadcaster.broadcast,
    async shutdown() {
      for (const client of wss.clients) {
        try {
          client.close(1000, 'Diagnostics complete');
        } catch (error) {
        }
      }

      await new Promise((resolve) => {
        wss.close(() => {
          server.close(() => resolve());
        });
      });
    }
  };
}

module.exports = {
  startLiveDashboardServer
};