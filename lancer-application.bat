@echo off
set "APP_PATH=%~dp0dist\index.html"

if exist "%APP_PATH%" (
  start "" "%APP_PATH%"
) else (
  echo Le fichier dist\index.html est introuvable.
  echo Lancez d'abord la construction de l'application, puis relancez ce fichier.
  pause
)