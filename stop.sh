#!/bin/bash

# ============================================================================
# AI 游戏图标工坊 - 停止服务脚本
# ============================================================================

PID_FILE="/tmp/icon-generator.pid"
WEBHOOK_PID_FILE="/tmp/icon-generator-webhook.pid"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}停止所有服务...${NC}"

# 停止 HTTP 服务器
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        rm -f "$PID_FILE"
        echo -e "  ${GREEN}✓ HTTP 服务器已停止 (PID: $PID)${NC}"
    else
        rm -f "$PID_FILE"
        echo -e "  ${YELLOW}HTTP 服务器进程已不存在，已清理 PID 文件${NC}"
    fi
else
    echo -e "  ${YELLOW}HTTP 服务器未在运行${NC}"
fi

# 停止 Webhook 服务器
if [ -f "$WEBHOOK_PID_FILE" ]; then
    PID=$(cat "$WEBHOOK_PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        rm -f "$WEBHOOK_PID_FILE"
        echo -e "  ${GREEN}✓ Webhook 服务器已停止 (PID: $PID)${NC}"
    else
        rm -f "$WEBHOOK_PID_FILE"
        echo -e "  ${YELLOW}Webhook 服务器进程已不存在，已清理 PID 文件${NC}"
    fi
else
    echo -e "  ${YELLOW}Webhook 服务器未在运行${NC}"
fi

echo ""
echo -e "${GREEN}所有服务已停止${NC}"
