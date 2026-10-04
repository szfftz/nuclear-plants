#!/bin/bash
# 建置後把 dist/ 推到 gh-pages 分支（同 political-spectrum 的做法）
set -e

echo "📦 建置專案..."
npm run build

cd dist
rm -rf .git
git init -q -b gh-pages
# 使用 ~/.ssh/config 裡 github.com-szfftz 這個 host，走 szfftz 的 SSH key
git remote add origin git@github.com-szfftz:szfftz/nuclear-plants.git
git config user.name "szfftz"
git config user.email "smilekevin7261@gmail.com"
# 讓 GitHub Pages 不要用 Jekyll 處理
touch .nojekyll
git add -A
git commit -q -m "Deploy to GitHub Pages - $(date +'%Y-%m-%d %H:%M:%S')"

echo "📤 推送到 gh-pages 分支..."
git push -f origin gh-pages
rm -rf .git
cd ..

echo "✅ 部署完成！幾分鐘內會更新：https://szfftz.github.io/nuclear-plants/"
