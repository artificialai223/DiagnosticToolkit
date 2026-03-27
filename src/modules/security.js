const { runPowerShell, runCommand } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function securityModule() {
  const rawData = {};
  const findings = [];

  const defender = await runPowerShell("Get-MpComputerStatus | Select-Object RealTimeProtectionEnabled,AntispywareEnabled,AntivirusEnabled,QuickScanAge,FullScanAge | ConvertTo-Json -Depth 4");
  rawData.defender = defender.stdout || defender.stderr;

  const firewall = await runPowerShell("Get-NetFirewallProfile | Select-Object Name,Enabled,DefaultInboundAction,DefaultOutboundAction | ConvertTo-Json -Depth 4");
  rawData.firewall = firewall.stdout || firewall.stderr;

  const unsignedProcesses = await runPowerShell("Get-Process | Select-Object -First 120 -ExpandProperty Path | Where-Object { $_ -and (Test-Path $_) } | ForEach-Object { $sig=Get-AuthenticodeSignature $_; if($sig.Status -ne 'Valid'){ [pscustomobject]@{Path=$_;SignatureStatus=$sig.Status} } } | ConvertTo-Json -Depth 5");
  rawData.unsignedProcesses = unsignedProcesses.stdout || unsignedProcesses.stderr;

  const startupItems = await runPowerShell("$runKeys=@('HKLM:Software\\Microsoft\\Windows\\CurrentVersion\\Run','HKCU:Software\\Microsoft\\Windows\\CurrentVersion\\Run'); $items=@(); foreach($k in $runKeys){ if(Test-Path $k){ $props=(Get-ItemProperty $k | Select-Object * -ExcludeProperty PSPath,PSParentPath,PSChildName,PSDrive,PSProvider); $items += $props } }; $items | ConvertTo-Json -Depth 6");
  rawData.startupItems = startupItems.stdout || startupItems.stderr;

  const rdpState = await runPowerShell("$deny=(Get-ItemProperty 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -Name fDenyTSConnections -ErrorAction SilentlyContinue).fDenyTSConnections; [pscustomobject]@{RdpEnabled=([int]$deny -eq 0)} | ConvertTo-Json");
  rawData.rdpState = rdpState.stdout || rdpState.stderr;

  const rdpListening = await runCommand('netstat -ano | findstr :3389');
  rawData.rdpListening = rdpListening.stdout || rdpListening.stderr;

  const admins = await runCommand('net localgroup administrators');
  rawData.localAdmins = admins.stdout || admins.stderr;

  if (defender.ok && /\"RealTimeProtectionEnabled\"\s*:\s*false/i.test(defender.stdout)) {
    findings.push({ ok: false, severity: 'critical', reason: 'Defender real-time protection is disabled.' });
  }

  if (firewall.ok && /\"Enabled\"\s*:\s*false/i.test(firewall.stdout)) {
    findings.push({ ok: false, severity: 'high', reason: 'At least one firewall profile is disabled.' });
  }

  if (unsignedProcesses.ok && unsignedProcesses.stdout && unsignedProcesses.stdout !== '[]' && unsignedProcesses.stdout !== 'null') {
    findings.push({ ok: false, severity: 'medium', reason: 'Unsigned or invalidly signed running process paths found.' });
  }

  if (startupItems.ok && /(AppData|Temp|\\\\Users\\\\Public)/i.test(startupItems.stdout)) {
    findings.push({ ok: false, severity: 'medium', reason: 'Suspicious startup item paths detected.' });
  }

  if (rdpState.ok && /\"RdpEnabled\"\s*:\s*true/i.test(rdpState.stdout) && rdpListening.ok && rdpListening.stdout) {
    findings.push({ ok: false, severity: 'medium', reason: 'RDP exposure detected (enabled and listening on 3389).' });
  }

  if (admins.ok) {
    const memberLines = admins.stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^Alias name|^Comment|^Members|^-+|^The command completed/i.test(line));
    if (memberLines.length > 5) {
      findings.push({ ok: false, severity: 'medium', reason: 'Local Administrators group has more than 5 members.' });
    }
  }

  if (findings.length === 0) {
    findings.push({ ok: true, severity: 'none', reason: 'Security baseline checks passed.' });
  }

  return createModuleResult('security', findings, rawData);
};