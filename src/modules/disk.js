const { runPowerShell } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function diskModule() {
  const rawData = {};
  const findings = [];

  const queueLength = await runPowerShell("Get-Counter '\\PhysicalDisk(_Total)\\Avg. Disk Queue Length' | Select-Object -ExpandProperty CounterSamples | Select-Object Path,CookedValue | ConvertTo-Json -Depth 4");
  rawData.queueLength = queueLength.stdout || queueLength.stderr;

  const logical = await runPowerShell("Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select-Object DeviceID,Size,FreeSpace,VolumeName | ConvertTo-Json -Depth 4");
  rawData.logicalDisks = logical.stdout || logical.stderr;

  if (!queueLength.ok || !queueLength.stdout) {
    findings.push({ ok: false, severity: 'low', reason: 'Disk queue telemetry unavailable.' });
  } else {
    const match = queueLength.stdout.match(/\"CookedValue\"\s*:\s*([0-9\.]+)/i);
    if (match && Number(match[1]) > 4) {
      findings.push({ ok: false, severity: 'high', reason: 'Disk queue length is high (>4).' });
    } else if (match && Number(match[1]) > 2) {
      findings.push({ ok: false, severity: 'medium', reason: 'Disk queue length is elevated (>2).' });
    } else {
      findings.push({ ok: true, severity: 'none', reason: 'Disk queue length is normal.' });
    }
  }

  return createModuleResult('disk', findings, rawData);
};