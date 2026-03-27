const { runPowerShell, runCommand } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function vpnModule() {
  const rawData = {};
  const findings = [];

  const vpnAdapters = await runPowerShell("Get-NetAdapter -IncludeHidden | Where-Object { $_.Name -match 'VPN|TAP|TUN|AnyConnect|WireGuard|Forti|Juniper' -or $_.InterfaceDescription -match 'VPN|TAP|TUN|AnyConnect|WireGuard|Forti|Juniper' } | Select-Object Name,Status,InterfaceDescription | ConvertTo-Json -Depth 4");
  rawData.vpnAdapters = vpnAdapters.stdout || vpnAdapters.stderr;

  const ras = await runCommand('rasdial');
  rawData.rasdial = ras.stdout || ras.stderr;

  if (!vpnAdapters.ok && !ras.ok) {
    findings.push({ ok: false, severity: 'low', reason: 'Unable to query VPN state.' });
  } else {
    findings.push({ ok: true, severity: 'none', reason: 'VPN presence/state collected.' });
  }

  if (ras.ok && /No connections/i.test(ras.stdout)) {
    findings.push({ ok: false, severity: 'low', reason: 'No active VPN tunnel detected.' });
  }

  return createModuleResult('vpn', findings, rawData);
};