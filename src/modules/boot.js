const { runPowerShell, runCommand } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function bootModule() {
  const rawData = {};
  const findings = [];

  const startupDuration = await runPowerShell("Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Diagnostics-Performance/Operational';ID=100;StartTime=(Get-Date).AddDays(-7)} -ErrorAction SilentlyContinue | Select-Object -First 10 TimeCreated,@{Name='BootDurationMs';Expression={$_.Properties[6].Value}},Message | ConvertTo-Json -Depth 6");
  rawData.startupDuration = startupDuration.stdout || startupDuration.stderr;

  const driverFailures = await runPowerShell("Get-WinEvent -FilterHashtable @{LogName='System';Level=2;StartTime=(Get-Date).AddDays(-7)} -ErrorAction SilentlyContinue | Where-Object {$_.ProviderName -match 'Service Control Manager|Kernel-PnP|Ntfs'} | Select-Object -First 40 TimeCreated,Id,ProviderName,Message | ConvertTo-Json -Depth 6");
  rawData.driverFailures = driverFailures.stdout || driverFailures.stderr;

  const fastStartup = await runPowerShell("$v=(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' -Name HiberbootEnabled -ErrorAction SilentlyContinue).HiberbootEnabled; [pscustomobject]@{FastStartupEnabled=([int]$v -eq 1)} | ConvertTo-Json");
  rawData.fastStartup = fastStartup.stdout || fastStartup.stderr;

  const bcd = await runCommand('bcdedit /enum');
  rawData.bcd = bcd.stdout || bcd.stderr;

  if (startupDuration.ok && /\"BootDurationMs\"\s*:\s*([3-9]\d{4,}|[1-9]\d{5,})/i.test(startupDuration.stdout)) {
    findings.push({ ok: false, severity: 'medium', reason: 'Startup duration is high (>30s).' });
  }

  if (driverFailures.ok && driverFailures.stdout && driverFailures.stdout !== '[]' && driverFailures.stdout !== 'null') {
    findings.push({ ok: false, severity: 'medium', reason: 'Boot-time driver/service failure events detected.' });
  }

  if (fastStartup.ok && /\"FastStartupEnabled\"\s*:\s*true/i.test(fastStartup.stdout)) {
    findings.push({ ok: false, severity: 'low', reason: 'Fast Startup is enabled and may contribute to stability issues on some systems.' });
  }

  if (!bcd.ok || /The boot configuration data store could not be opened|error/i.test(bcd.stdout + bcd.stderr)) {
    findings.push({ ok: false, severity: 'high', reason: 'BCD health check indicates an access or configuration problem.' });
  }

  if (findings.length === 0) {
    findings.push({ ok: true, severity: 'none', reason: 'Boot subsystem checks passed.' });
  }

  return createModuleResult('boot', findings, rawData);
};