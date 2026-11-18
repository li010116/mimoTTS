@echo off
rem Encoding: GBK (CP936). Keep Windows CRLF line endings.
chcp 936 >nul
setlocal EnableExtensions DisableDelayedExpansion
set "MIMO_SERVICE_ROOT=%~dp0"
pushd "%MIMO_SERVICE_ROOT%"
if errorlevel 1 (
    echo 无法进入项目目录，请检查脚本位置。
    pause
    exit /b 1
)

:menu
cls
echo ========================================
echo          MiMo Studio 服务管理
echo ========================================
echo.
echo   1. 启动开发服务（修改代码自动更新）
echo   2. 构建并启动生产服务
echo   3. 停止服务
echo   0. 退出
echo.
echo   服务地址 http://127.0.0.1:3000
echo.
choice /c 1230 /n /m "请选择 [1/2/3/0] "
if errorlevel 4 goto quit
if errorlevel 3 goto stop
if errorlevel 2 goto production
if errorlevel 1 goto development
goto menu

:development
call :check_start
if errorlevel 1 goto wait
start "MiMo Studio - Development" cmd /k "pnpm dev --port 3000"
echo.
echo 已打开开发服务窗口，启动日志将在新窗口显示。
echo 服务就绪后访问 http://127.0.0.1:3000
goto wait

:production
call :check_start
if errorlevel 1 goto wait
echo.
echo 正在构建生产版本，请等待完成。
call pnpm build
if errorlevel 1 (
    echo.
    echo 构建失败，请查看上方错误信息。
    goto wait
)
start "MiMo Studio - Production" cmd /k "pnpm start --port 3000"
echo.
echo 已打开生产服务窗口，启动日志将在新窗口显示。
echo 服务就绪后访问 http://127.0.0.1:3000
goto wait

:stop
echo.
powershell -NoProfile -Command ^
    "$ErrorActionPreference = 'Stop';" ^
    "try {" ^
    "  $listeners = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue);" ^
    "  if ($listeners.Count -eq 0) { Write-Host '服务当前未运行。'; exit 0 };" ^
    "  $root = [System.IO.Path]::GetFullPath($env:MIMO_SERVICE_ROOT);" ^
    "  $serviceIds = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique);" ^
    "  foreach ($serviceId in $serviceIds) {" ^
    "    $process = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $serviceId);" ^
    "    $commandLine = ([string]$process.CommandLine).Replace('/', '\');" ^
    "    if ($commandLine.IndexOf($root, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {" ^
    "      Write-Host ('端口 3000 被其他或无法识别的进程占用，PID ' + $serviceId + '。请到对应终端按 Ctrl+C 停止。'); exit 1;" ^
    "    };" ^
    "  };" ^
    "  foreach ($serviceId in $serviceIds) { Stop-Process -Id $serviceId -ErrorAction Stop };" ^
    "  Write-Host 'MiMo Studio 服务已停止。';" ^
    "} catch { Write-Host ('停止失败：' + $_.Exception.Message); exit 1 }"
goto wait

:check_start
where node >nul 2>&1
if errorlevel 1 (
    echo 未找到 Node.js，请安装 Node.js 22 或更高的 LTS 版本。
    exit /b 1
)
where pnpm >nul 2>&1
if errorlevel 1 (
    echo 未找到 pnpm，请先安装 pnpm 并重新打开此脚本。
    exit /b 1
)
if not exist "node_modules\next\dist\bin\next" (
    echo 项目依赖尚未安装，请先在项目目录执行 pnpm install。
    exit /b 1
)
powershell -NoProfile -Command ^
    "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 1 }; exit 0"
if errorlevel 1 (
    echo 端口 3000 已被占用，请先选择停止服务，或在原服务窗口按 Ctrl+C。
    exit /b 1
)
exit /b 0

:wait
echo.
pause
goto menu

:quit
popd
endlocal
exit /b 0
