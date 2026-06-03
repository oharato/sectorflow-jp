@echo off
title SectorFlow JP - データ更新バッチ
echo ==================================================
echo   SectorFlow JP: データ更新バッチを起動しています...
echo ==================================================
echo.
node update.js
if %errorlevel% neq 0 (
    echo.
    echo [エラー] データの更新に失敗しました。
    color 0C
) else (
    echo.
    echo [成功] データが正常に更新されました！
    echo index.html を開いてブラウザで確認してください。
)
echo.
pause
