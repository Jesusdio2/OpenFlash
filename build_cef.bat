
@echo off
setlocal
cd /d "%~dp0"

call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat" x64
if errorlevel 1 (
    echo ERROR: No se pudo inicializar el entorno de MSVC.
    pause
    exit /b 1
)

cmake -S . -B cmake-build -A x64
if errorlevel 1 (
    echo ERROR: Fallo la configuracion de CMake.
    pause
    exit /b 1
)

cmake --build cmake-build --config Debug --target OpenFlash -- /m:4
if errorlevel 1 (
    echo ERROR: Fallo la compilacion de OpenFlash.
    pause
    exit /b 1
)

echo.
echo Compilacion completada correctamente.
pause
