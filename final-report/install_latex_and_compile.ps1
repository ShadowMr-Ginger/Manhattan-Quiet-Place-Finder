# Install TinyTeX locally (no admin required)
$installer = "install-bin-windows.bat"
Invoke-WebRequest -Uri "https://yihui.org/tinytex/$installer" -OutFile $installer
& ".\$installer"

# Add TinyTeX to PATH for this session
$env:PATH = "$env:APPDATA\TinyTeX\bin\windows;$env:PATH"

# Install required packages if needed
tlmgr install IEEEtran

# Compile the main report
cd "$PSScriptRoot"
pdflatex -interaction=nonstopmode Team5_HushHub.tex
pdflatex -interaction=nonstopmode Team5_HushHub.tex
