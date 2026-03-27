module.exports = async function selfDiagnosisEngine(resultByModule, results) {
  const probableCauses = [];

  const cpuIssue = (resultByModule.cpu && resultByModule.cpu.severity) || 'none';
  const smartIssue = (resultByModule.smart && resultByModule.smart.severity) || 'none';
  const networkReason = (resultByModule.network && resultByModule.network.reasoning) || '';
  const osReason = (resultByModule.osIntegrity && resultByModule.osIntegrity.reasoning) || '';
  const storageReason = (resultByModule.storage && resultByModule.storage.reasoning) || '';
  const m365Reason = (resultByModule.m365 && resultByModule.m365.reasoning) || '';
  const rebootReason = (resultByModule.filesystem && resultByModule.filesystem.reasoning) || '';

  const bootLoop = /reboot loop|Unexpected reboot/i.test(rebootReason);
  const highCpuTemp = /thermal/i.test((resultByModule.cpu && JSON.stringify(resultByModule.cpu.rawData)) || '');
  const smartFail = /SMART predicts disk failure|degraded/i.test((resultByModule.smart && resultByModule.smart.reasoning) || '');
  const dnsFail = /DNS resolution failure/i.test(networkReason);
  const gatewayReachable = !/gateway is unreachable/i.test(networkReason);
  const sfcFail = /SFC detected integrity violations/i.test(osReason);
  const dismFail = /DISM detected component store corruption/i.test(osReason);
  const lowDisk = /less than 10% free space/i.test(storageReason);
  const oneDriveBacklog = /OneDrive log\/backlog appears excessive/i.test(m365Reason);

  if (bootLoop && highCpuTemp) {
    probableCauses.push({
      title: 'Thermal instability',
      explanation: 'Frequent reboot events combined with thermal pressure indicate potential cooling or CPU throttling instability.',
      affectedSubsystems: ['boot', 'cpu', 'filesystem'],
      severity: 'high'
    });
  }

  if (bootLoop && smartFail) {
    probableCauses.push({
      title: 'Storage failing',
      explanation: 'Reboot instability and SMART failure indicators strongly suggest disk degradation.',
      affectedSubsystems: ['smart', 'storage', 'boot'],
      severity: 'critical'
    });
  }

  if (dnsFail && gatewayReachable) {
    probableCauses.push({
      title: 'DNS resolver outage',
      explanation: 'Gateway path is available but DNS resolution fails, indicating resolver or upstream DNS misconfiguration.',
      affectedSubsystems: ['network', 'domain'],
      severity: 'high'
    });
  }

  if (sfcFail && dismFail) {
    probableCauses.push({
      title: 'OS component corruption',
      explanation: 'SFC and DISM both report integrity issues, pointing to deeper Windows component corruption.',
      affectedSubsystems: ['osIntegrity', 'services'],
      severity: 'critical'
    });
  }

  if (oneDriveBacklog && lowDisk) {
    probableCauses.push({
      title: 'Sync blocked by disk space',
      explanation: 'OneDrive backlog and low disk availability indicate sync clients are blocked by storage constraints.',
      affectedSubsystems: ['m365', 'storage'],
      severity: 'high'
    });
  }

  if (resultByModule.security && resultByModule.security.severity === 'critical') {
    probableCauses.push({
      title: 'Security baseline failure',
      explanation: 'Critical security controls are disabled or exposed, increasing compromise risk and operational instability.',
      affectedSubsystems: ['security'],
      severity: 'critical'
    });
  }

  if (resultByModule.applicationFailures && /Crash loop pattern/i.test(resultByModule.applicationFailures.reasoning || '')) {
    probableCauses.push({
      title: 'Application crash loop',
      explanation: 'Repeated application faults suggest unstable runtime dependencies, corrupted profile data, or incompatible updates.',
      affectedSubsystems: ['applicationFailures', 'osIntegrity'],
      severity: 'high'
    });
  }

  if (resultByModule.domain && /Domain Controller reachability check failed/i.test(resultByModule.domain.reasoning || '')) {
    probableCauses.push({
      title: 'Domain communication failure',
      explanation: 'Domain controller access failures can cascade into auth, policy, and drive-mapping issues.',
      affectedSubsystems: ['domain', 'network'],
      severity: 'high'
    });
  }

  if (probableCauses.length === 0) {
    probableCauses.push({
      title: 'No dominant root cause',
      explanation: 'No single multi-branch pattern dominates; review module findings for isolated issues.',
      affectedSubsystems: results.filter((r) => r.severity !== 'none').map((r) => r.name),
      severity: 'low'
    });
  }

  const highestSeverity = probableCauses.reduce((top, current) => {
    const rank = { critical: 4, high: 3, medium: 2, low: 1 };
    return (rank[current.severity] || 0) > (rank[top] || 0) ? current.severity : top;
  }, 'low');

  return {
    probableCauses,
    explanation: probableCauses.map((item) => item.title).join('; '),
    affectedSubsystems: [...new Set(probableCauses.flatMap((item) => item.affectedSubsystems))],
    severityAssessment: highestSeverity
  };
};