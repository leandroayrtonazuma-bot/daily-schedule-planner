@echo off
chcp 65001 >nul
cd /d "%~dp0"
title スケジュールアプリ  -  この窓を閉じると停止します

rem --- すでに起動中ならブラウザを開くだけ ---
powershell -NoProfile -Command "try{$null=Invoke-WebRequest 'http://localhost:3000' -TimeoutSec 2 -UseBasicParsing; exit 0}catch{exit 1}"
if not errorlevel 1 (
    echo すでに起動しています。ブラウザを開きます。
    start "" http://localhost:3000
    timeout /t 2 >nul
    exit /b
)

rem --- 初回だけ依存パッケージを入れる ---
if not exist "node_modules" (
    echo 初回セットアップ中です。数分かかります...
    call npm install
    if errorlevel 1 (
        echo.
        echo セットアップに失敗しました。Node.js が入っているか確認してください。
        pause
        exit /b 1
    )
)

echo サーバーを起動しています。準備ができたらブラウザが自動で開きます...
echo （終わるときは、この窓を閉じるか Ctrl+C を押してください）
echo.

rem --- 起動を待ってブラウザを開く ---
start "" /b powershell -NoProfile -Command "for($i=0;$i -lt 120;$i++){ try{ $null=Invoke-WebRequest 'http://localhost:3000' -TimeoutSec 2 -UseBasicParsing; Start-Process 'http://localhost:3000'; break } catch { Start-Sleep -Seconds 1 } }"

npm run dev

echo.
echo サーバーが停止しました。
pause
