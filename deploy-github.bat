@echo off
chcp 65001 > nul
echo ========================================================
echo        🚀 깃허브 배포 (GitHub Pages 업데이트)
echo ========================================================
echo.
echo 1. 클라이언트 빌드 중...
cd client
call npm run build
if %errorlevel% neq 0 (
    echo 빌드 실패!
    pause
    exit /b
)
cd dist
echo.
echo 2. gh-pages 브랜치로 배포 중...
git init
git checkout -B gh-pages
git add -A
git commit -m "Update site"
git remote add origin https://github.com/Bwaaab/my-budget.git
git push -f origin gh-pages
rd /s /q .git
cd ..\..
echo.
echo ========================================================
echo 🎉 배포가 완료되었습니다!
echo 👉 https://bwaaab.github.io/my-budget/
echo ========================================================
pause
