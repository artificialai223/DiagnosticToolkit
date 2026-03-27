const { SEVERITY_WEIGHT } = require('../lib/result');

function severityRank(value) {
  const rank = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  return rank[value] || 0;
}

module.exports = async function scoringModule(results, diagnosis) {
  const moduleCount = Array.isArray(results) ? results.length : 0;
  if (moduleCount === 0) {
    return {
      score: 100,
      band: 'healthy',
      overallSeverity: 'none',
      rubric: {
        critical: -40,
        high: -25,
        medium: -10,
        low: -3
      }
    };
  }

  let totalPenalty = 0;

  for (const result of results) {
    totalPenalty += SEVERITY_WEIGHT[result.severity] || 0;
  }

  const maxPenalty = moduleCount * (SEVERITY_WEIGHT.critical || 40);
  let score = Math.round((1 - totalPenalty / maxPenalty) * 100);

  if (score < 0) {
    score = 0;
  }
  if (score > 100) {
    score = 100;
  }

  let band = 'healthy';
  if (score < 40) {
    band = 'unhealthy';
  } else if (score < 60) {
    band = 'degraded';
  } else if (score < 80) {
    band = 'moderate';
  }

  const overallSeverity = results.reduce((top, item) => {
    return severityRank(item.severity) > severityRank(top) ? item.severity : top;
  }, 'none');

  return {
    score,
    band,
    overallSeverity,
    rubric: {
      critical: -40,
      high: -25,
      medium: -10,
      low: -3
    }
  };
};