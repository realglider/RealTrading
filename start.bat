@echo off
title RealTrading Strategie Server
echo Starte RealTrading Strategie auf http://localhost:3000 ...
start "" "http://localhost:3000"
node "%~dp0server.js"
pause
