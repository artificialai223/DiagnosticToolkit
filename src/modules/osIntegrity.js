const { runPowerShell, runCommand } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function osIntegrityModule() {
  const rawData = {};
  const findings = [];

  const pendingReboot = await runPowerShell("$paths=@('HKLM:SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending','HKLM:SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired','HKLM:SYSTEM\\CurrentControlSet\\Control\\Session Manager'); $exists=$false; foreach($p in $paths){ if(Test-Path $p){ $exists=$true } }; [pscustomobject]@{PendingReboot=$exists} | ConvertTo-Json");
  rawData.pendingReboot = pendingReboot.stdout || pendingReboot.stderr;

  const failedUpdates = await runPowerShell("Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-WindowsUpdateClient';Level=2;StartTime=(Get-Date).AddDays(-14)} -ErrorAction SilentlyContinue | Select-Object -First 30 TimeCreated,Id,Message | ConvertTo-Json -Depth 6");
  rawData.failedUpdates = failedUpdates.stdout || failedUpdates.stderr;

  const sfc = await runCommand('sfc /verifyonly');
  rawData.sfc = sfc.stdout || sfc.stderr;

  const dism = await runCommand('DISM /Online /Cleanup-Image /ScanHealth');
  rawData.dism = dism.stdout || dism.stderr;

  const wmi = await runCommand('winmgmt /verifyrepository');
  rawData.wmi = wmi.stdout || wmi.stderr;

  const timeSync = await runCommand('w32tm /query /status');
  rawData.timeSync = timeSync.stdout || timeSync.stderr;

  if (pendingReboot.ok && /\"PendingReboot\"\s*:\s*true/i.test(pendingReboot.stdout)) {
    findings.push({ ok: false, severity: 'medium', reason: 'System has a pending reboot.' });
  }
  if (failedUpdates.ok && failedUpdates.stdout && failedUpdates.stdout !== '[]' && failedUpdates.stdout !== 'null') {
    findings.push({ ok: false, severity: 'medium', reason: 'Recent failed Windows updates detected.' });
  }
  if (sfc.ok && /Windows Resource Protection found integrity violations/i.test(sfc.stdout)) {
    findings.push({ ok: false, severity: 'high', reason: 'SFC detected integrity violations.' });
  }
  if (dism.ok && /component store is repairable|corrupt/i.test(dism.stdout)) {
    findings.push({ ok: false, severity: 'high', reason: 'DISM detected component store corruption.' });
  }
  if (wmi.ok && /inconsistent/i.test(wmi.stdout)) {
    findings.push({ ok: false, severity: 'medium', reason: 'WMI repository is inconsistent.' });
  }
  if (!timeSync.ok || /error|failed/i.test(timeSync.stdout + timeSync.stderr)) {
    findings.push({ ok: false, severity: 'low', reason: 'Time synchronization query indicates issues.' });
  }

  if (findings.length === 0) {
    findings.push({ ok: true, severity: 'none', reason: 'OS integrity checks passed.' });
  }

  return createModuleResult('osIntegrity', findings, rawData);
};