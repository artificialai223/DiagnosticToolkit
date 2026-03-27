const { runCommand, runPowerShell } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function domainModule() {
  const rawData = {};
  const findings = [];

  const dcReachability = await runCommand('nltest /dsgetdc:');
  rawData.dcReachability = dcReachability.stdout || dcReachability.stderr;

  const kerberosFailures = await runPowerShell("Get-WinEvent -FilterHashtable @{LogName='Security';ID=4771;StartTime=(Get-Date).AddDays(-7)} -ErrorAction SilentlyContinue | Select-Object -First 30 TimeCreated,Id,Message | ConvertTo-Json -Depth 6");
  rawData.kerberosFailures = kerberosFailures.stdout || kerberosFailures.stderr;

  const gpoErrors = await runPowerShell("Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-GroupPolicy';Level=2;StartTime=(Get-Date).AddDays(-7)} -ErrorAction SilentlyContinue | Select-Object -First 30 TimeCreated,Id,Message | ConvertTo-Json -Depth 6");
  rawData.gpoErrors = gpoErrors.stdout || gpoErrors.stderr;

  const driveMappings = await runPowerShell("Get-WinEvent -FilterHashtable @{LogName='System';ID=4098;StartTime=(Get-Date).AddDays(-7)} -ErrorAction SilentlyContinue | Select-Object -First 25 TimeCreated,Id,ProviderName,Message | ConvertTo-Json -Depth 6");
  rawData.driveMappingErrors = driveMappings.stdout || driveMappings.stderr;

  if (!dcReachability.ok || /failed|error/i.test(dcReachability.stdout + dcReachability.stderr)) {
    findings.push({ ok: false, severity: 'high', reason: 'Domain Controller reachability check failed.' });
  }

  if (kerberosFailures.ok && kerberosFailures.stdout && kerberosFailures.stdout !== '[]' && kerberosFailures.stdout !== 'null') {
    findings.push({ ok: false, severity: 'medium', reason: 'Kerberos failure events detected.' });
  }

  if (gpoErrors.ok && gpoErrors.stdout && gpoErrors.stdout !== '[]' && gpoErrors.stdout !== 'null') {
    findings.push({ ok: false, severity: 'medium', reason: 'Group Policy processing errors detected.' });
  }

  if (driveMappings.ok && driveMappings.stdout && driveMappings.stdout !== '[]' && driveMappings.stdout !== 'null') {
    findings.push({ ok: false, severity: 'low', reason: 'Failed drive mapping events detected.' });
  }

  if (findings.length === 0) {
    findings.push({ ok: true, severity: 'none', reason: 'Domain connectivity and policy checks passed.' });
  }

  return createModuleResult('domain', findings, rawData);
};