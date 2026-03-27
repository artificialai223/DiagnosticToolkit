const { runCommand, runPowerShell } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function networkModule() {
  const rawData = {};
  const findings = [];

  const ipconfig = await runCommand('ipconfig /all');
  rawData.ipconfig = ipconfig.stdout || ipconfig.stderr;

  const gateway = await runPowerShell("Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1 InterfaceAlias,NextHop,RouteMetric | ConvertTo-Json -Depth 4");
  rawData.defaultGateway = gateway.stdout || gateway.stderr;

  const dnsResolve = await runCommand('nslookup microsoft.com');
  rawData.dnsResolve = dnsResolve.stdout || dnsResolve.stderr;

  const pingGateway = await runPowerShell("$gw=(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1 -ExpandProperty NextHop); if($gw){ ping $gw -n 3 } else { 'NO_GATEWAY' }");
  rawData.gatewayPing = pingGateway.stdout || pingGateway.stderr;

  const pingInternet = await runCommand('ping 8.8.8.8 -n 4');
  rawData.internetPing = pingInternet.stdout || pingInternet.stderr;

  const nicStats = await runPowerShell("Get-NetAdapterStatistics | Select-Object Name,ReceivedErrors,OutboundErrors,ReceivedDiscardedPackets,OutboundDiscardedPackets | ConvertTo-Json -Depth 4");
  rawData.nicStats = nicStats.stdout || nicStats.stderr;

  if (!ipconfig.ok) {
    findings.push({ ok: false, severity: 'medium', reason: 'Failed to collect IP configuration.' });
  }

  if (!dnsResolve.ok || /can't find|timed out|Non-existent domain/i.test(dnsResolve.stdout + dnsResolve.stderr)) {
    findings.push({ ok: false, severity: 'high', reason: 'DNS resolution failure detected.' });
  }

  if (pingInternet.ok && /\(([1-9]\d?)% loss\)|([1-9]\d?)% loss/i.test(pingInternet.stdout)) {
    findings.push({ ok: false, severity: 'medium', reason: 'Packet loss detected on internet ping.' });
  }

  if (pingGateway.ok && /Request timed out/i.test(pingGateway.stdout)) {
    findings.push({ ok: false, severity: 'high', reason: 'Default gateway is unreachable.' });
  }

  if (nicStats.ok && /\"(ReceivedErrors|OutboundErrors|ReceivedDiscardedPackets|OutboundDiscardedPackets)\"\s*:\s*[1-9]/i.test(nicStats.stdout)) {
    findings.push({ ok: false, severity: 'medium', reason: 'NIC error counters are non-zero.' });
  }

  if (findings.length === 0) {
    findings.push({ ok: true, severity: 'none', reason: 'Network health checks passed.' });
  }

  return createModuleResult('network', findings, rawData);
};