const { runCommand, runPowerShell } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function systemIdentityModule() {
  const rawData = {};
  const findings = [];

  const systemInfo = await runCommand('systeminfo');
  rawData.systeminfo = systemInfo.stdout || systemInfo.stderr;

  const osInfo = await runPowerShell("Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,LastBootUpTime | ConvertTo-Json -Depth 3");
  rawData.os = osInfo.stdout;

  const computerInfo = await runPowerShell("Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer,Model,Domain,PartOfDomain,TotalPhysicalMemory | ConvertTo-Json -Depth 3");
  rawData.computerSystem = computerInfo.stdout;

  if (!systemInfo.ok) {
    findings.push({ ok: false, severity: 'low', reason: 'Unable to query system identity via systeminfo.' });
  }

  if (!osInfo.ok) {
    findings.push({ ok: false, severity: 'low', reason: 'Unable to query OS metadata.' });
  }

  if (systemInfo.ok || osInfo.ok || computerInfo.ok) {
    findings.push({ ok: true, severity: 'none', reason: 'System identity collected.' });
  }

  return createModuleResult('systemIdentity', findings, rawData);
};