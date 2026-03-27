const { runPowerShell } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function memoryModule() {
  const rawData = {};
  const findings = [];

  const memory = await runPowerShell("$os=Get-CimInstance Win32_OperatingSystem; $total=[double]$os.TotalVisibleMemorySize; $free=[double]$os.FreePhysicalMemory; $usedPct=[math]::Round((($total-$free)/$total)*100,2); [pscustomobject]@{TotalKB=$total;FreeKB=$free;UsedPct=$usedPct} | ConvertTo-Json");
  rawData.memory = memory.stdout || memory.stderr;

  const hungProcesses = await runPowerShell("Get-Process | Where-Object {$_.Responding -eq $false} | Select-Object -First 25 Name,Id,CPU,StartTime | ConvertTo-Json -Depth 4");
  rawData.hungProcesses = hungProcesses.stdout || hungProcesses.stderr;

  if (!memory.ok || !memory.stdout) {
    findings.push({ ok: false, severity: 'medium', reason: 'Memory pressure telemetry unavailable.' });
  } else if (/\"UsedPct\"\s*:\s*(9\d|100)/i.test(memory.stdout)) {
    findings.push({ ok: false, severity: 'high', reason: 'Memory pressure is critical (>=90% used).' });
  } else if (/\"UsedPct\"\s*:\s*(8\d)/i.test(memory.stdout)) {
    findings.push({ ok: false, severity: 'medium', reason: 'Memory pressure is elevated (>=80% used).' });
  } else {
    findings.push({ ok: true, severity: 'none', reason: 'Memory utilization is healthy.' });
  }

  if (hungProcesses.ok && hungProcesses.stdout && hungProcesses.stdout !== 'null' && hungProcesses.stdout !== '[]') {
    findings.push({ ok: false, severity: 'medium', reason: 'Hung/non-responding processes detected.' });
  }

  return createModuleResult('memory', findings, rawData);
};