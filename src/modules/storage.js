const { runPowerShell, runCommand } = require('../lib/exec');
const { createModuleResult } = require('../lib/result');

module.exports = async function storageModule() {
  const rawData = {};
  const findings = [];

  const diskSpace = await runPowerShell("Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | ForEach-Object { [pscustomobject]@{Drive=$_.DeviceID; SizeGB=[math]::Round($_.Size/1GB,2); FreeGB=[math]::Round($_.FreeSpace/1GB,2); FreePct=[math]::Round(($_.FreeSpace/$_.Size)*100,2)} } | ConvertTo-Json -Depth 4");
  rawData.diskSpace = diskSpace.stdout || diskSpace.stderr;

  const chkdsk = await runCommand('chkdsk /scan');
  rawData.chkdsk = chkdsk.stdout || chkdsk.stderr;

  const tempSize = await runPowerShell("$p=$env:TEMP; if(Test-Path $p){ (Get-ChildItem -Path $p -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum } else { 0 }");
  rawData.tempBytes = tempSize.stdout || tempSize.stderr;

  const softwareDistribution = await runPowerShell("$p='C:\\Windows\\SoftwareDistribution'; if(Test-Path $p){ (Get-ChildItem -Path $p -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum } else { 0 }");
  rawData.softwareDistributionBytes = softwareDistribution.stdout || softwareDistribution.stderr;

  const winSxs = await runPowerShell("$p='C:\\Windows\\WinSxS'; if(Test-Path $p){ (Get-ChildItem -Path $p -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum } else { 0 }");
  rawData.winSxsBytes = winSxs.stdout || winSxs.stderr;

  const orphanedProfiles = await runPowerShell("$profiles=Get-CimInstance Win32_UserProfile | Where-Object {$_.Special -eq $false}; $dirs=Get-ChildItem 'C:\\Users' -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name; $profileNames=$profiles | ForEach-Object { Split-Path $_.LocalPath -Leaf }; Compare-Object -ReferenceObject $dirs -DifferenceObject $profileNames | Select-Object InputObject,SideIndicator | ConvertTo-Json -Depth 4");
  rawData.orphanedProfiles = orphanedProfiles.stdout || orphanedProfiles.stderr;

  if (diskSpace.ok) {
    const lowDisk = /\"FreePct\"\s*:\s*([0-9]+\.?[0-9]*)/g;
    let match;
    while ((match = lowDisk.exec(diskSpace.stdout)) !== null) {
      if (Number(match[1]) < 10) {
        findings.push({ ok: false, severity: 'high', reason: 'At least one disk has less than 10% free space.' });
        break;
      }
    }
  } else {
    findings.push({ ok: false, severity: 'medium', reason: 'Disk space telemetry unavailable.' });
  }

  if (chkdsk.ok && /failed|errors found|corrupt/i.test(chkdsk.stdout)) {
    findings.push({ ok: false, severity: 'high', reason: 'CHKDSK /scan reported filesystem errors.' });
  }

  const tempBytes = Number((tempSize.stdout || '0').replace(/[^0-9]/g, '')) || 0;
  if (tempBytes > 5 * 1024 * 1024 * 1024) {
    findings.push({ ok: false, severity: 'low', reason: 'Temp directory bloat exceeds 5 GB.' });
  }

  const swdBytes = Number((softwareDistribution.stdout || '0').replace(/[^0-9]/g, '')) || 0;
  if (swdBytes > 10 * 1024 * 1024 * 1024) {
    findings.push({ ok: false, severity: 'medium', reason: 'SoftwareDistribution exceeds 10 GB.' });
  }

  const winsxsBytes = Number((winSxs.stdout || '0').replace(/[^0-9]/g, '')) || 0;
  if (winsxsBytes > 20 * 1024 * 1024 * 1024) {
    findings.push({ ok: false, severity: 'low', reason: 'WinSxS size is unusually large.' });
  }

  if (orphanedProfiles.ok && orphanedProfiles.stdout && orphanedProfiles.stdout !== '[]' && orphanedProfiles.stdout !== 'null') {
    findings.push({ ok: false, severity: 'low', reason: 'Potential orphaned user profiles found.' });
  }

  if (findings.length === 0) {
    findings.push({ ok: true, severity: 'none', reason: 'Storage checks passed.' });
  }

  return createModuleResult('storage', findings, rawData);
};