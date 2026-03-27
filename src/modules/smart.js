const { runPowerShell } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function smartModule() {
  const rawData = {};
  const findings = [];

  const smart = await runPowerShell("Get-WmiObject -Namespace root\\wmi -Class MSStorageDriver_FailurePredictStatus | Select-Object InstanceName,PredictFailure,Reason | ConvertTo-Json -Depth 4");
  rawData.failurePredict = smart.stdout || smart.stderr;

  const fallback = await runPowerShell("Get-CimInstance Win32_DiskDrive | Select-Object Model,Status,SerialNumber | ConvertTo-Json -Depth 4");
  rawData.diskStatus = fallback.stdout || fallback.stderr;

  if (smart.ok && smart.stdout && /\"PredictFailure\"\s*:\s*true/i.test(smart.stdout)) {
    findings.push({ ok: false, severity: 'critical', reason: 'SMART predicts disk failure.' });
  } else if (fallback.ok && fallback.stdout && /\"Status\"\s*:\s*\"(Pred Fail|Error|Degraded)\"/i.test(fallback.stdout)) {
    findings.push({ ok: false, severity: 'high', reason: 'Disk status reports degraded health.' });
  } else if (!smart.ok && !fallback.ok) {
    findings.push({ ok: false, severity: 'low', reason: 'SMART telemetry unavailable.' });
  } else {
    findings.push({ ok: true, severity: 'none', reason: 'No SMART failure indicators found.' });
  }

  return createModuleResult('smart', findings, rawData);
};