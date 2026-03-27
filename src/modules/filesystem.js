const { runPowerShell } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function filesystemModule() {
  const rawData = {};
  const findings = [];

  const uptime = await runPowerShell("$os=Get-CimInstance Win32_OperatingSystem; $up=(Get-Date)-$os.LastBootUpTime; [pscustomobject]@{LastBoot=$os.LastBootUpTime; UptimeHours=[math]::Round($up.TotalHours,2)} | ConvertTo-Json");
  rawData.uptime = uptime.stdout || uptime.stderr;

  const rebootEvents = await runPowerShell("Get-WinEvent -FilterHashtable @{LogName='System';ID=41;StartTime=(Get-Date).AddDays(-7)} -ErrorAction SilentlyContinue | Select-Object -First 25 TimeCreated,Id,ProviderName,Message | ConvertTo-Json -Depth 6");
  rawData.rebootEvents = rebootEvents.stdout || rebootEvents.stderr;

  const bsod = await runPowerShell("Get-WinEvent -FilterHashtable @{LogName='System';ID=1001;StartTime=(Get-Date).AddDays(-14)} -ErrorAction SilentlyContinue | Where-Object {$_.ProviderName -like '*BugCheck*' -or $_.Message -match 'bugcheck|blue screen'} | Select-Object -First 25 TimeCreated,Id,ProviderName,Message | ConvertTo-Json -Depth 6");
  rawData.bsod = bsod.stdout || bsod.stderr;

  if (rebootEvents.ok && rebootEvents.stdout && rebootEvents.stdout !== '[]' && rebootEvents.stdout !== 'null') {
    findings.push({ ok: false, severity: 'high', reason: 'Unexpected reboot events suggest reboot loop risk.' });
  }

  if (bsod.ok && bsod.stdout && bsod.stdout !== '[]' && bsod.stdout !== 'null') {
    findings.push({ ok: false, severity: 'critical', reason: 'Recent BSOD/BugCheck events detected.' });
  }

  if (!uptime.ok) {
    findings.push({ ok: false, severity: 'low', reason: 'Unable to determine uptime.' });
  }

  if (findings.length === 0) {
    findings.push({ ok: true, severity: 'none', reason: 'Filesystem and reboot stability checks passed.' });
  }

  return createModuleResult('filesystem', findings, rawData);
};