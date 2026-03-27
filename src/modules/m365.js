const { runPowerShell } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

function parseNumber(value) {
  const cleaned = String(value || '').replace(/[^0-9]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

module.exports = async function m365Module() {
  const rawData = {};
  const findings = [];

  const cDrive = await runPowerShell("$d=Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\"; if($d){ [pscustomobject]@{Size=$d.Size;Free=$d.FreeSpace} | ConvertTo-Json } else { '{}' }");
  rawData.cDrive = cDrive.stdout || cDrive.stderr;
  const driveFreeMatch = (cDrive.stdout || '').match(/\"Free\"\s*:\s*(\d+)/i);
  const driveFreeBytes = driveFreeMatch ? Number(driveFreeMatch[1]) : 0;

  const oneNoteCache = await runPowerShell("$p=Join-Path $env:LOCALAPPDATA 'Microsoft\\OneNote'; if(Test-Path $p){ (Get-ChildItem $p -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum } else { 0 }");
  rawData.oneNoteCacheBytes = oneNoteCache.stdout || oneNoteCache.stderr;
  const oneNoteBytes = parseNumber(oneNoteCache.stdout);

  if (driveFreeBytes > 0) {
    const oneNotePctOfFree = Math.round((oneNoteBytes / driveFreeBytes) * 100);
    if (oneNotePctOfFree >= 90) {
      findings.push({ ok: false, severity: 'high', reason: `OneNote cache high (${oneNotePctOfFree}% of free disk space).` });
    } else {
      findings.push({ ok: true, severity: 'none', reason: `OneNote cache usage low (${oneNotePctOfFree}% of free disk space).` });
    }
  } else if (oneNoteBytes > 2 * 1024 * 1024 * 1024) {
    findings.push({ ok: false, severity: 'medium', reason: 'OneNote cache usage is high (>2 GB).' });
  } else {
    findings.push({ ok: true, severity: 'none', reason: 'OneNote cache usage low.' });
  }

  const wordCache = await runPowerShell("$paths=@((Join-Path $env:LOCALAPPDATA 'Microsoft\\Office\\16.0\\OfficeFileCache'),(Join-Path $env:LOCALAPPDATA 'Microsoft\\Office\\15.0\\OfficeFileCache')); $size=0; foreach($p in $paths){ if(Test-Path $p){ $size+=(Get-ChildItem $p -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum } }; $size");
  rawData.wordCacheBytes = wordCache.stdout || wordCache.stderr;
  const wordCacheBytes = parseNumber(wordCache.stdout);
  if (wordCacheBytes > 1500 * 1024 * 1024) {
    findings.push({ ok: false, severity: 'medium', reason: 'Word cache usage high (>1.5 GB).' });
  } else {
    findings.push({ ok: true, severity: 'none', reason: 'Word cache usage low.' });
  }

  const oneDriveState = await runPowerShell("$p=Join-Path $env:LOCALAPPDATA 'Microsoft\\OneDrive\\logs'; $size=0; if(Test-Path $p){ $size=(Get-ChildItem $p -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum }; $proc=Get-Process OneDrive -ErrorAction SilentlyContinue; [pscustomobject]@{OneDriveRunning=($null -ne $proc); LogBytes=$size} | ConvertTo-Json");
  rawData.oneDriveState = oneDriveState.stdout || oneDriveState.stderr;

  const teamsCache = await runPowerShell("$paths=@((Join-Path $env:APPDATA 'Microsoft\\Teams'),(Join-Path $env:LOCALAPPDATA 'Packages\\MSTeams_8wekyb3d8bbwe'),(Join-Path $env:LOCALAPPDATA 'Microsoft\\EdgeWebView')); $total=0; foreach($p in $paths){ if(Test-Path $p){ $total += (Get-ChildItem $p -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum } }; [pscustomobject]@{TeamsAndWebViewBytes=$total} | ConvertTo-Json");
  rawData.teamsCache = teamsCache.stdout || teamsCache.stderr;

  const outlookOst = await runPowerShell("$p=Join-Path $env:LOCALAPPDATA 'Microsoft\\Outlook'; if(Test-Path $p){ Get-ChildItem $p -Filter *.ost -ErrorAction SilentlyContinue | Select-Object Name,@{N='SizeGB';E={[math]::Round($_.Length/1GB,2)}} | ConvertTo-Json -Depth 4 } else { '[]' }");
  rawData.outlookOst = outlookOst.stdout || outlookOst.stderr;

  const c2r = await runPowerShell("Get-Service ClickToRunSvc -ErrorAction SilentlyContinue | Select-Object Name,Status,StartType | ConvertTo-Json -Depth 4");
  rawData.officeC2R = c2r.stdout || c2r.stderr;

  const licensing = await runPowerShell("$paths=@('C:\\Program Files\\Microsoft Office\\Office16\\OSPP.VBS','C:\\Program Files (x86)\\Microsoft Office\\Office16\\OSPP.VBS'); $path=$paths | Where-Object { Test-Path $_ } | Select-Object -First 1; if($path){ cscript //nologo $path /dstatus } else { 'OSPP_NOT_FOUND' }");
  rawData.officeLicensing = licensing.stdout || licensing.stderr;

  const oneDriveBacklogBytesMatch = (oneDriveState.stdout || '').match(/\"LogBytes\"\s*:\s*(\d+)/i);
  const oneDriveBacklogBytes = oneDriveBacklogBytesMatch ? Number(oneDriveBacklogBytesMatch[1]) : 0;
  if (oneDriveBacklogBytes > 500 * 1024 * 1024) {
    findings.push({ ok: false, severity: 'medium', reason: 'OneDrive log/backlog appears excessive.' });
  } else {
    findings.push({ ok: true, severity: 'none', reason: 'OneDrive backlog low.' });
  }

  if (teamsCache.ok) {
    const teamsBytesMatch = (teamsCache.stdout || '').match(/\"TeamsAndWebViewBytes\"\s*:\s*(\d+)/i);
    const teamsBytes = teamsBytesMatch ? Number(teamsBytesMatch[1]) : 0;
    if (teamsBytes > 2 * 1024 * 1024 * 1024) {
      findings.push({ ok: false, severity: 'low', reason: 'Teams/WebView cache usage is high (>2 GB).' });
    } else {
      findings.push({ ok: true, severity: 'none', reason: 'Teams/WebView cache usage low.' });
    }
  }

  if (c2r.ok && /\"Status\"\s*:\s*\"Stopped\"/i.test(c2r.stdout)) {
    findings.push({ ok: false, severity: 'medium', reason: 'Office Click-to-Run service is stopped.' });
  } else {
    findings.push({ ok: true, severity: 'none', reason: 'Office Click-to-Run service running.' });
  }

  if (/LICENSE STATUS:\s*---NOTIFICATIONS---|UNLICENSED/i.test(licensing.stdout)) {
    findings.push({ ok: false, severity: 'high', reason: 'Office licensing appears unhealthy or unlicensed.' });
  } else {
    findings.push({ ok: true, severity: 'none', reason: 'Office licensing appears healthy.' });
  }

  if (outlookOst.ok && /\"SizeGB\"\s*:\s*([2-9]\d|[1-9]\d{2,})/i.test(outlookOst.stdout)) {
    findings.push({ ok: false, severity: 'medium', reason: 'Outlook OST file size is very large.' });
  } else {
    findings.push({ ok: true, severity: 'none', reason: 'Outlook OST size is within expected range.' });
  }

  return createModuleResult('m365', findings, rawData);
};