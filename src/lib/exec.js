const { exec } = require('child_process');

function runCommand(command, options = {}) {
  const timeout = options.timeout || 120000;
  const cwd = options.cwd || process.cwd();

  return new Promise((resolve) => {
    exec(
      command,
      {
        timeout,
        cwd,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 10
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          code: error && typeof error.code === 'number' ? error.code : 0,
          stdout: (stdout || '').trim(),
          stderr: (stderr || '').trim(),
          error: error ? String(error.message || error) : null
        });
      }
    );
  });
}

function runPowerShell(psCommand, options = {}) {
  const escaped = psCommand.replace(/"/g, '\\"');
  const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${escaped}"`;
  return runCommand(command, options);
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

module.exports = {
  runCommand,
  runPowerShell,
  safeJsonParse
};