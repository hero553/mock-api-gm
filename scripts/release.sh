#!/bin/bash

# 发布脚本
# 使用方法: ./scripts/release.sh [major|minor|patch]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}错误: 请指定版本类型 [major|minor|patch]${NC}"
    echo "用法: ./scripts/release.sh [major|minor|patch]"
    exit 1
fi

VERSION_TYPE=$1

# 验证版本类型
if [[ ! "$VERSION_TYPE" =~ ^(major|minor|patch)$ ]]; then
    echo -e "${RED}错误: 版本类型必须是 major, minor 或 patch${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 开始发布流程...${NC}"

# 检查是否有未提交的更改
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  检测到未提交的更改${NC}"
    git status -s
    read -p "是否继续? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 确保在主分支
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    echo -e "${YELLOW}⚠️  当前不在主分支 (当前: $CURRENT_BRANCH)${NC}"
    read -p "是否继续? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 拉取最新代码
echo -e "${GREEN}📥 拉取最新代码...${NC}"
git pull origin $CURRENT_BRANCH

# 运行测试
echo -e "${GREEN}🧪 运行代码检查...${NC}"
yarn tsc --noEmit

# 构建
echo -e "${GREEN}🔨 构建项目...${NC}"
yarn build

# 读取当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}当前版本: ${CURRENT_VERSION}${NC}"

# 计算新版本
IFS='.' read -r -a version_parts <<< "$CURRENT_VERSION"
major="${version_parts[0]}"
minor="${version_parts[1]}"
patch="${version_parts[2]}"

case $VERSION_TYPE in
    major)
        major=$((major + 1))
        minor=0
        patch=0
        ;;
    minor)
        minor=$((minor + 1))
        patch=0
        ;;
    patch)
        patch=$((patch + 1))
        ;;
esac

NEW_VERSION="$major.$minor.$patch"
echo -e "${GREEN}新版本: ${NEW_VERSION}${NC}"

# 确认发布
read -p "确认发布版本 v${NEW_VERSION}? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}发布已取消${NC}"
    exit 1
fi

# 更新 package.json
echo -e "${GREEN}📝 更新 package.json...${NC}"
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json
rm package.json.bak

# 更新 vite.config.ts 中的版本号
echo -e "${GREEN}📝 更新 vite.config.ts...${NC}"
sed -i.bak "s/version: '.*'/version: '$NEW_VERSION'/" vite.config.ts
rm vite.config.ts.bak

# 重新构建
echo -e "${GREEN}🔨 重新构建...${NC}"
yarn build

# 提交更改
echo -e "${GREEN}💾 提交版本更改...${NC}"
git add package.json vite.config.ts CHANGELOG.md
git commit -m "chore: release v${NEW_VERSION}"

# 创建标签
echo -e "${GREEN}🏷️  创建标签...${NC}"
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"

# 推送到远程
echo -e "${GREEN}📤 推送到远程仓库...${NC}"
git push origin $CURRENT_BRANCH
git push origin "v${NEW_VERSION}"

echo -e "${GREEN}✅ 发布成功！${NC}"
echo -e "${GREEN}版本 v${NEW_VERSION} 已发布${NC}"
echo -e "${GREEN}GitHub Actions 将自动构建并创建 Release${NC}"
echo -e "${GREEN}查看发布: https://github.com/YOUR_USERNAME/YOUR_REPO/releases${NC}"

