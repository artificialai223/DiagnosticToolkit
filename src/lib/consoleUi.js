const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function paint(color, text, options = {}) {
  const prefix = `${options.bold ? ANSI.bold : ''}${color || ''}`;
  return `${prefix}${text}${ANSI.reset}`;
}

function severityColor(severity) {
  switch (severity) {
    case 'critical':
      return ANSI.red;
    case 'high':
      return ANSI.magenta;
    case 'medium':
      return ANSI.yellow;
    case 'low':
      return ANSI.blue;
    default:
      return ANSI.green;
  }
}

function statusColor(status) {
  switch (status) {
    case 'fail':
      return ANSI.red;
    case 'warn':
      return ANSI.yellow;
    default:
      return ANSI.green;
  }
}

function makeBar(percent, width = 24) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return `█`.repeat(filled) + `░`.repeat(empty);
}

module.exports = {
  ANSI,
  paint,
  severityColor,
  statusColor,
  makeBar
};