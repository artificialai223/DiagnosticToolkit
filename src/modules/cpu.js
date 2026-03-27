const { runPowerShell } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function cpuModule() {
  const rawData = {};
  const findings = [];

  const cpuLoad = await runPowerShell("Get-CimInstance Win32_Processor | Select-Object Name,LoadPercentage,MaxClockSpeed,CurrentClockSpeed | ConvertTo-Json -Depth 4");
  rawData.cpu = cpuLoad.stdout || cpuLoad.stderr;

  const thermal = await runPowerShell("Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature | Select-Object CurrentTemperature,InstanceName | ConvertTo-Json -Depth 4");
  rawData.thermal = thermal.stdout || thermal.stderr;

  if (!cpuLoad.ok || !cpuLoad.stdout) {
    findings.push({ ok: false, severity: 'medium', reason: 'CPU utilization telemetry unavailable.' });
  } else if (/\"LoadPercentage\"\s*:\s*(9\d|100)/i.test(cpuLoad.stdout)) {
    findings.push({ ok: false, severity: 'high', reason: 'CPU load is critically high (>=90%).' });
  } else if (/\"LoadPercentage\"\s*:\s*(8\d)/i.test(cpuLoad.stdout)) {
    findings.push({ ok: false, severity: 'medium', reason: 'CPU load is elevated (>=80%).' });
  } else {
    findings.push({ ok: true, severity: 'none', reason: 'CPU load within expected range.' });
  }

  if (thermal.ok && thermal.stdout && /(CurrentTemperature\"\s*:\s*[3-9]\d{3,})/.test(thermal.stdout)) {
    findings.push({ ok: false, severity: 'medium', reason: 'High ACPI thermal readings detected.' });
  }

  return createModuleResult('cpu', findings, rawData);
};