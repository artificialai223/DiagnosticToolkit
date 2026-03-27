const SEVERITY_WEIGHT = {
  critical: 40,
  high: 25,
  medium: 10,
  low: 3,
  info: 0,
  none: 0
};

const SEVERITY_RANK = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
  none: 0
};

function normalizeSeverity(value) {
  if (!value || typeof value !== 'string') {
    return 'none';
  }
  const lowered = value.toLowerCase();
  return Object.prototype.hasOwnProperty.call(SEVERITY_WEIGHT, lowered) ? lowered : 'none';
}

function highestSeverity(findings) {
  let top = 'none';
  for (const finding of findings) {
    const severity = normalizeSeverity(finding.severity);
    if ((SEVERITY_RANK[severity] || 0) > (SEVERITY_RANK[top] || 0)) {
      top = severity;
    }
  }
  return top;
}

function createModuleResult(name, findings, rawData) {
  const issues = findings.filter((item) => item && item.ok === false);
  if (issues.length === 0) {
    return {
      name,
      status: 'healthy',
      severity: 'none',
      scorePenalty: 0,
      reasoning: 'No significant issues detected.',
      rawData: {
        ...rawData,
        findings
      }
    };
  }

  const severity = highestSeverity(issues);
  const scorePenalty = SEVERITY_WEIGHT[severity] || 0;

  return {
    name,
    status: severity === 'critical' ? 'fail' : 'warn',
    severity,
    scorePenalty,
    reasoning: issues.map((item) => item.reason).slice(0, 6).join(' | '),
    rawData: {
      ...rawData,
      findings
    }
  };
}

module.exports = {
  SEVERITY_WEIGHT,
  SEVERITY_RANK,
  createModuleResult
};