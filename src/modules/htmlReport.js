const fs = require('fs');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function severityClass(value) {
  const map = {
    critical: 'sev-critical',
    high: 'sev-high',
    medium: 'sev-medium',
    low: 'sev-low',
    none: 'sev-none'
  };
  return map[value] || 'sev-none';
}

module.exports = async function htmlReportModule(payload) {
  const reportPath = 'C:\\Windows\\Temp\\SystemHealthReport.html';

  const moduleCards = payload.results
    .map((result) => {
      return `
      <section class="card">
        <div class="card-head">
          <h3>${escapeHtml(result.name)}</h3>
          <span class="badge ${severityClass(result.severity)}">${escapeHtml(result.severity)}</span>
        </div>
        <p><strong>Status:</strong> ${escapeHtml(result.status)} | <strong>Penalty:</strong> ${escapeHtml(result.scorePenalty)}</p>
        <p>${escapeHtml(result.reasoning)}</p>
        <details>
          <summary>Advanced details</summary>
          <pre>${escapeHtml(JSON.stringify(result.rawData, null, 2))}</pre>
        </details>
      </section>`;
    })
    .join('\n');

  const rootCauses = (payload.diagnosis.probableCauses || [])
    .map((cause) => `
      <li>
        <span class="badge ${severityClass(cause.severity)}">${escapeHtml(cause.severity)}</span>
        <strong>${escapeHtml(cause.title)}</strong><br />
        ${escapeHtml(cause.explanation)}<br />
        <em>Affected:</em> ${escapeHtml((cause.affectedSubsystems || []).join(', '))}
      </li>`)
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>System Health Report</title>
  <style>
    body{font-family:Segoe UI,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:20px}
    .wrap{max-width:1200px;margin:0 auto}
    .banner{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:16px}
    .score{font-size:32px;font-weight:700}
    .band{font-size:16px;opacity:.9}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px}
    .card{background:#111827;border:1px solid #374151;border-radius:10px;padding:12px}
    .card-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
    h1,h2,h3{margin:0 0 10px 0}
    p{margin:8px 0}
    ul{padding-left:18px}
    li{margin-bottom:8px}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase}
    .sev-critical{background:#7f1d1d;color:#fecaca}
    .sev-high{background:#78350f;color:#fde68a}
    .sev-medium{background:#1e3a8a;color:#bfdbfe}
    .sev-low{background:#064e3b;color:#a7f3d0}
    .sev-none{background:#334155;color:#cbd5e1}
    details{margin-top:8px}
    summary{cursor:pointer}
    pre{white-space:pre-wrap;word-wrap:break-word;background:#020617;color:#cbd5e1;padding:10px;border-radius:8px;max-height:260px;overflow:auto}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Windows Diagnostic Toolkit</h1>
    <div class="banner">
      <div class="score">Score: ${escapeHtml(payload.scoreSummary.score)}/100</div>
      <div class="band">Band: ${escapeHtml(payload.scoreSummary.band)} | Overall severity: ${escapeHtml(payload.scoreSummary.overallSeverity)}</div>
      <div>Generated: ${escapeHtml(payload.generatedAt)}</div>
    </div>

    <section class="card" style="margin-bottom:12px;">
      <h2>Root Cause Analysis</h2>
      <p>${escapeHtml(payload.diagnosis.explanation || '')}</p>
      <ul>${rootCauses}</ul>
    </section>

    <h2>Module Diagnostics</h2>
    <div class="grid">
      ${moduleCards}
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(reportPath, html, 'utf8');
  return reportPath;
};