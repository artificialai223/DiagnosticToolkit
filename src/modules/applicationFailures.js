const { runPowerShell } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function applicationFailuresModule() {
  const rawData = {};
  const findings = [];

  const appErrors = await runPowerShell("Get-WinEvent -FilterHashtable @{LogName='Application';ID=1000,1001;StartTime=(Get-Date).AddDays(-7)} -ErrorAction SilentlyContinue | Select-Object -First 80 TimeCreated,Id,ProviderName,Message | ConvertTo-Json -Depth 6");
  rawData.applicationErrors = appErrors.stdout || appErrors.stderr;

  const vssErrors = await runPowerShell("Get-WinEvent -FilterHashtable @{LogName='Application';ProviderName='VSS';Level=2;StartTime=(Get-Date).AddDays(-14)} -ErrorAction SilentlyContinue | Select-Object -First 40 TimeCreated,Id,Message | ConvertTo-Json -Depth 6");
  rawData.vssErrors = vssErrors.stdout || vssErrors.stderr;

  const dotNetErrors = await runPowerShell("Get-WinEvent -FilterHashtable @{LogName='Application';ProviderName='.NET Runtime';Level=2;StartTime=(Get-Date).AddDays(-14)} -ErrorAction SilentlyContinue | Select-Object -First 40 TimeCreated,Id,Message | ConvertTo-Json -Depth 6");
  rawData.dotNetErrors = dotNetErrors.stdout || dotNetErrors.stderr;

  const crashLoop = await runPowerShell("$events=Get-WinEvent -FilterHashtable @{LogName='Application';ID=1000;StartTime=(Get-Date).AddHours(-24)} -ErrorAction SilentlyContinue; $group=$events | Group-Object ProviderName | Sort-Object Count -Descending | Select-Object -First 5 Name,Count; $group | ConvertTo-Json -Depth 4");
  rawData.crashLoops = crashLoop.stdout || crashLoop.stderr;

  if (appErrors.ok && appErrors.stdout && appErrors.stdout !== '[]' && appErrors.stdout !== 'null') {
    findings.push({ ok: false, severity: 'medium', reason: 'Application crash events (1000/1001) detected.' });
  }

  if (vssErrors.ok && vssErrors.stdout && vssErrors.stdout !== '[]' && vssErrors.stdout !== 'null') {
    findings.push({ ok: false, severity: 'medium', reason: 'VSS errors detected in application logs.' });
  }

  if (dotNetErrors.ok && dotNetErrors.stdout && dotNetErrors.stdout !== '[]' && dotNetErrors.stdout !== 'null') {
    findings.push({ ok: false, severity: 'medium', reason: '.NET runtime errors detected.' });
  }

  if (crashLoop.ok && /\"Count\"\s*:\s*([3-9]|[1-9]\d+)/i.test(crashLoop.stdout)) {
    findings.push({ ok: false, severity: 'high', reason: 'Crash loop pattern detected for one or more providers.' });
  }

  if (findings.length === 0) {
    findings.push({ ok: true, severity: 'none', reason: 'No major application failure patterns detected.' });
  }

  return createModuleResult('applicationFailures', findings, rawData);
};