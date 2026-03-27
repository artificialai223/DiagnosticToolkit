const { runPowerShell } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function servicesModule() {
  const rawData = {};
  const findings = [];

  const coreServices = await runPowerShell("Get-Service wuauserv,bits,w32time | Select-Object Name,Status,StartType | ConvertTo-Json -Depth 4");
  rawData.services = coreServices.stdout || coreServices.stderr;

  if (!coreServices.ok || !coreServices.stdout) {
    findings.push({ ok: false, severity: 'high', reason: 'Unable to query critical Windows services.' });
  } else {
    if (/\"Name\"\s*:\s*\"wuauserv\"[\s\S]*?\"Status\"\s*:\s*\"Stopped\"/i.test(coreServices.stdout)) {
      findings.push({ ok: false, severity: 'high', reason: 'Windows Update service is stopped.' });
    }
    if (/\"Name\"\s*:\s*\"w32time\"[\s\S]*?\"Status\"\s*:\s*\"Stopped\"/i.test(coreServices.stdout)) {
      findings.push({ ok: false, severity: 'medium', reason: 'Windows Time service is stopped.' });
    }
    if (/\"Name\"\s*:\s*\"bits\"[\s\S]*?\"Status\"\s*:\s*\"Stopped\"/i.test(coreServices.stdout)) {
      findings.push({ ok: false, severity: 'medium', reason: 'BITS service is stopped.' });
    }
  }

  if (findings.length === 0) {
    findings.push({ ok: true, severity: 'none', reason: 'Core service checks passed.' });
  }

  return createModuleResult('services', findings, rawData);
};