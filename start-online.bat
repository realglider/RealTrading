@echo off
title TradingView AI Pro - Online Handy-Link & QR-Code
echo ================================================================
echo Starte lokalen Server + Oeffentlichen HTTPS Handy-Link...
echo Scanne gleich einfach den QR-Code oder oeffne die https:// URL!
echo ================================================================
start /B node "%~dp0server.js"
timeout /t 2 /nobreak >nul
ssh -o StrictHostKeyChecking=no -R 80:localhost:3000 nokey@localhost.run
pause
