const fs = require('fs');
const path = require('path');
const { startLiveDashboardServer } = require('./lib/liveDashboardServer');
const { ANSI, paint, severityColor, statusColor, makeBar } = require('./lib/consoleUi');
const { SEVERITY_WEIGHT } = require('./lib/result');

const systemIdentity = require('./modules/systemIdentity');
const cpu = require('./modules/cpu');
const memory = require('./modules/memory');
const disk = require('./modules/disk');
const smart = require('./modules/smart');
const network = require('./modules/network');
const vpn = require('./modules/vpn');
const services = require('./modules/services');
const osIntegrity = require('./modules/osIntegrity');
const storage = require('./modules/storage');
const filesystem = require('./modules/filesystem');
const security = require('./modules/security');
const applicationFailures = require('./modules/applicationFailures');
const domain = require('./modules/domain');
const boot = require('./modules/boot');
const m365 = require('./modules/m365');
const selfDiagnosisEngine = require('./modules/selfDiagnosisEngine');
const scoring = require('./modules/scoring');
const htmlReport = require('./modules/htmlReport');

const moduleRegistry = [
  { id: 'systemIdentity', fn: systemIdentity, checks: ['Checking systeminfo collection', 'Checking OS metadata', 'Checking computer system profile'] },
  { id: 'cpu', fn: cpu, checks: ['Checking CPU load telemetry', 'Checking thermal telemetry', 'Checking CPU pressure analysis'] },
  { id: 'memory', fn: memory, checks: ['Checking RAM usage', 'Checking for hung processes', 'Checking memory pressure status'] },
  { id: 'disk', fn: disk, checks: ['Checking disk queue length', 'Checking logical disk inventory', 'Checking disk latency pressure'] },
  { id: 'smart', fn: smart, checks: ['Checking SMART predict status', 'Checking fallback disk health status', 'Checking storage failure indicators'] },
  { id: 'network', fn: network, checks: ['Checking IP configuration', 'Checking DNS resolution', 'Checking gateway and packet loss', 'Checking NIC error counters'] },
  { id: 'vpn', fn: vpn, checks: ['Checking VPN adapter presence', 'Checking active VPN tunnel', 'Checking VPN state analysis'] },
  { id: 'services', fn: services, checks: ['Checking Windows Update service', 'Checking BITS service', 'Checking Windows Time service'] },
  { id: 'osIntegrity', fn: osIntegrity, checks: ['Checking pending reboot markers', 'Checking failed Windows updates', 'Checking SFC verifyonly result', 'Checking DISM scanhealth result', 'Checking WMI repository health', 'Checking time synchronization status'] },
  { id: 'storage', fn: storage, checks: ['Checking free disk space', 'Checking CHKDSK scan result', 'Checking temp directory bloat', 'Checking SoftwareDistribution size', 'Checking WinSxS size', 'Checking orphaned user profiles'] },
  { id: 'filesystem', fn: filesystem, checks: ['Checking uptime profile', 'Checking reboot loop events', 'Checking BSOD events'] },
  { id: 'security', fn: security, checks: ['Checking Defender realtime protection', 'Checking firewall profiles', 'Checking unsigned processes', 'Checking suspicious startup items', 'Checking RDP exposure', 'Checking local admin membership count'] },
  { id: 'applicationFailures', fn: applicationFailures, checks: ['Checking application event IDs 1000/1001', 'Checking VSS errors', 'Checking .NET runtime errors', 'Checking crash loop frequency'] },
  { id: 'domain', fn: domain, checks: ['Checking domain controller reachability', 'Checking Kerberos failures', 'Checking Group Policy errors', 'Checking failed drive mappings'] },
  { id: 'boot', fn: boot, checks: ['Checking startup duration', 'Checking boot-time driver failures', 'Checking Fast Startup state', 'Checking BCD health'] },
  { id: 'm365', fn: m365, checks: ['Checking OneNote cache size', 'Checking OneDrive sync/backlog state', 'Checking Teams/WebView cache', 'Checking Outlook OST size', 'Checking Office Click-to-Run service', 'Checking Office licensing state'] }
];

const PARALLEL_CONCURRENCY = 4;

function formatDurationMs(durationMs) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  const seconds = Math.round((durationMs / 1000) * 10) / 10;
  return `${seconds}s`;
}

function logProgress(message) {
  const stamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
  console.log(`${paint(ANSI.gray, `[${stamp}]`)} ${paint(ANSI.cyan, message)}`);
}

function calculateBand(score) {
  if (score < 40) {
    return 'unhealthy';
  }
  if (score < 60) {
    return 'degraded';
  }
  if (score < 80) {
    return 'moderate';
  }
  return 'healthy';
}

function calculateLiveScore(results) {
  const moduleCount = Array.isArray(results) ? results.length : 0;
  if (moduleCount === 0) {
    return {
      score: 100,
      band: 'healthy'
    };
  }

  const totalPenalty = results.reduce((sum, item) => sum + (SEVERITY_WEIGHT[item.severity] || 0), 0);
  const maxPenalty = moduleCount * (SEVERITY_WEIGHT.critical || 40);
  const score = Math.max(0, Math.min(100, Math.round((1 - totalPenalty / maxPenalty) * 100)));
  return {
    score,
    band: calculateBand(score)
  };
}

function createExecutionFailure(moduleId, error) {
  return {
    name: moduleId,
    status: 'fail',
    severity: 'medium',
    scorePenalty: 10,
    reasoning: `Module execution failed: ${String(error && error.message ? error.message : error)}`,
    rawData: {
      error: String(error && error.stack ? error.stack : error)
    }
  };
}

function printConsoleReport(results, diagnosis, scoreSummary, reportPath) {
  console.log('');
  console.log(paint(ANSI.blue, '================ Windows Diagnostic Toolkit ================', { bold: true }));
  console.log(`${paint(ANSI.cyan, 'Final Score:')} ${paint(ANSI.bold, `${scoreSummary.score}/100`)} ${paint(ANSI.yellow, `(${scoreSummary.band})`)}`);
  console.log(`${paint(ANSI.cyan, 'Severity:')} ${paint(severityColor(scoreSummary.overallSeverity), scoreSummary.overallSeverity, { bold: true })}`);
  console.log(paint(ANSI.gray, '------------------------------------------------------------'));
  for (const result of results) {
    const statusText = paint(statusColor(result.status), result.status.toUpperCase(), { bold: true });
    const severityText = paint(severityColor(result.severity), result.severity.toUpperCase(), { bold: true });
    console.log(`${paint(ANSI.blue, result.name)}: ${statusText} [${severityText}] ${paint(ANSI.magenta, `Penalty=${result.scorePenalty}`)}`);
    console.log(`  ${paint(ANSI.gray, 'Reason:')} ${result.reasoning}`);
  }
  console.log(paint(ANSI.gray, '------------------------------------------------------------'));
  console.log(paint(ANSI.cyan, 'Probable Causes:', { bold: true }));
  for (const cause of diagnosis.probableCauses) {
    console.log(`- ${paint(ANSI.blue, cause.title)} (${paint(severityColor(cause.severity), cause.severity)})`);
    console.log(`  ${cause.explanation}`);
  }
  console.log(paint(ANSI.gray, '------------------------------------------------------------'));
  console.log(`${paint(ANSI.cyan, 'HTML Report:')} ${paint(ANSI.green, reportPath)}`);
  console.log('');
}

async function run() {
  const resultsMap = {};
  const resultByModule = {};
  const totalModules = moduleRegistry.length;
  let dashboard = null;
  let completedModules = 0;
  let activeModules = 0;
  let nextModuleIndex = 0;

  dashboard = await startLiveDashboardServer();
  logProgress(`Live dashboard started at ${dashboard.url}`);
  dashboard.broadcast({
    type: 'init',
    totalModules,
    modules: moduleRegistry.map((item) => ({
      id: item.id,
      status: 'pending',
      severity: 'none',
      reason: 'Waiting to be processed',
      checks: item.checks || []
    }))
  });

  logProgress(`Starting diagnostics. Total modules: ${totalModules}. Parallel workers: ${PARALLEL_CONCURRENCY}`);

  async function executeModule(entry) {
    activeModules += 1;
    const start = Date.now();
    const moduleNumber = completedModules + activeModules;
    const pct = Math.round((completedModules / totalModules) * 100);
    const bar = makeBar(pct, 18);
    const runLabel = `[${moduleNumber}/${totalModules}] (${pct}%) ${bar} Running module: ${entry.id} (active=${activeModules})`;
    logProgress(runLabel);
    dashboard.broadcast({
      type: 'progress',
      phase: 'running',
      moduleId: entry.id,
      totalModules,
      completedModules,
      label: runLabel,
      note: 'Collecting diagnostics data...'
    });

    const heartbeat = setInterval(() => {
      const elapsed = Date.now() - start;
      const heartbeatLabel = `[${moduleNumber}/${totalModules}] ${entry.id} still running... elapsed ${formatDurationMs(elapsed)}`;
      logProgress(heartbeatLabel);
      dashboard.broadcast({
        type: 'progress',
        phase: 'running',
        moduleId: entry.id,
        totalModules,
        completedModules,
        label: heartbeatLabel,
        note: `Elapsed ${formatDurationMs(elapsed)}`
      });
    }, 15000);

    try {
      const output = await entry.fn();
      clearInterval(heartbeat);
      activeModules -= 1;
      completedModules += 1;
      resultsMap[entry.id] = output;
      resultByModule[entry.id] = output;
      const completedLabel = `[${completedModules}/${totalModules}] Completed ${entry.id} in ${formatDurationMs(Date.now() - start)} with status=${output.status}, severity=${output.severity}`;
      logProgress(completedLabel);
      dashboard.broadcast({
        type: 'progress',
        phase: 'done',
        moduleId: entry.id,
        totalModules,
        completedModules,
        label: completedLabel,
        note: output.reasoning
      });
      dashboard.broadcast({
        type: 'module-result',
        moduleId: entry.id,
        status: output.status,
        severity: output.severity,
        reasoning: output.reasoning,
        findings: (output.rawData && output.rawData.findings) || [],
        rawData: output.rawData || {}
      });
      const partialResults = moduleRegistry
        .map((item) => resultsMap[item.id])
        .filter(Boolean);
      const liveScore = calculateLiveScore(partialResults);
      dashboard.broadcast({ type: 'score-update', score: liveScore.score, band: liveScore.band });
    } catch (error) {
      clearInterval(heartbeat);
      activeModules -= 1;
      completedModules += 1;
      const failed = createExecutionFailure(entry.id, error);
      resultsMap[entry.id] = failed;
      resultByModule[entry.id] = failed;
      const failedLabel = `[${completedModules}/${totalModules}] Failed ${entry.id} in ${formatDurationMs(Date.now() - start)}. Continuing.`;
      logProgress(failedLabel);
      dashboard.broadcast({
        type: 'progress',
        phase: 'failed',
        moduleId: entry.id,
        totalModules,
        completedModules,
        label: failedLabel,
        note: failed.reasoning
      });
      dashboard.broadcast({
        type: 'module-result',
        moduleId: entry.id,
        status: failed.status,
        severity: failed.severity,
        reasoning: failed.reasoning,
        findings: [],
        rawData: failed.rawData || {}
      });
      const partialResults = moduleRegistry
        .map((item) => resultsMap[item.id])
        .filter(Boolean);
      const liveScore = calculateLiveScore(partialResults);
      dashboard.broadcast({ type: 'score-update', score: liveScore.score, band: liveScore.band });
    }
  }

  async function workerLoop() {
    while (true) {
      const current = nextModuleIndex;
      if (current >= moduleRegistry.length) {
        return;
      }
      nextModuleIndex += 1;
      const entry = moduleRegistry[current];
      await executeModule(entry);
    }
  }

  const workerCount = Math.min(PARALLEL_CONCURRENCY, moduleRegistry.length);
  const workers = Array.from({ length: workerCount }, () => workerLoop());
  await Promise.all(workers);

  const results = moduleRegistry
    .map((item) => resultsMap[item.id])
    .filter(Boolean);

  logProgress('Running self-diagnosis engine.');
  const diagnosis = await selfDiagnosisEngine(resultByModule, results);
  logProgress('Calculating weighted score.');
  const scoreSummary = await scoring(results, diagnosis);
  dashboard.broadcast({ type: 'score-update', score: scoreSummary.score, band: scoreSummary.band });
  logProgress('Generating HTML report.');
  const reportPath = await htmlReport({
    generatedAt: new Date().toISOString(),
    results,
    diagnosis,
    scoreSummary
  });

  logProgress('Diagnostics complete. Printing summary.');

  dashboard.broadcast({
    type: 'final',
    diagnosis,
    scoreSummary,
    results
  });

  printConsoleReport(results, diagnosis, scoreSummary, reportPath);

  const outDir = path.join(process.cwd(), 'dist');
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch (error) {
  }

  await new Promise((resolve) => setTimeout(resolve, 1800));
  await dashboard.shutdown();
}

run().catch((error) => {
  console.error('Fatal diagnostics failure:', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});