#!/bin/bash

# ============================================================================
# AI 游戏图标工坊 - 一键启动脚本 (后台运行版)
# 同时启动 HTTP 服务器和 GitHub Webhook 服务器
# ============================================================================

# 配置
PORT=${PORT:-3500}
WEBHOOK_PORT=${WEBHOOK_PORT:-3501}
HOST=${HOST:-0.0.0.0}
PID_FILE="/tmp/icon-generator.pid"
WEBHOOK_PID_FILE="/tmp/icon-generator-webhook.pid"
LOG_FILE="/tmp/icon-generator.log"
WEBHOOK_LOG_FILE="/tmp/icon-generator-webhook.log"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║          🎨 AI 游戏图标工坊 - 服务启动器                  ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if command -v lsof &> /dev/null; then
        if lsof -Pi :$port -sTCP:LISTEN -t &> /dev/null; then
            return 1
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            return 1
        fi
    fi
    return 0
}

# 获取本机IP
get_local_ip() {
    if command -v hostname &> /dev/null; then
        hostname -I 2>/dev/null | awk '{print $1}'
    elif command -v ip &> /dev/null; then
        ip route get 1 2>/dev/null | awk '{print $7}' | head -1
    else
        echo "localhost"
    fi
}

# 检查进程是否运行
is_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# 启动 HTTP 服务器
start_http_server() {
    echo -e "${BLUE}[1/2] 启动 HTTP 服务器...${NC}"
    
    if is_running "$PID_FILE"; then
        local pid=$(cat "$PID_FILE")
        echo -e "  ${YELLOW}HTTP 服务器已在运行 (PID: $pid)${NC}"
        return 0
    fi
    
    if ! check_port $PORT; then
        echo -e "  ${YELLOW}警告: 端口 $PORT 已被占用${NC}"
        echo -e "  请使用 ${CYAN}PORT=其他端口 ./start.sh${NC} 来指定其他端口"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
    
    if command -v python3 &> /dev/null; then
        nohup python3 -m http.server $PORT --bind $HOST > "$LOG_FILE" 2>&1 &
        echo $! > "$PID_FILE"
    elif command -v python &> /dev/null; then
        local py_version=$(python -c 'import sys; print(sys.version_info[0])')
        if [ "$py_version" = "3" ]; then
            nohup python -m http.server $PORT --bind $HOST > "$LOG_FILE" 2>&1 &
        else
            nohup python -m SimpleHTTPServer $PORT > "$LOG_FILE" 2>&1 &
        fi
        echo $! > "$PID_FILE"
    elif command -v php &> /dev/null; then
        nohup php -S $HOST:$PORT > "$LOG_FILE" 2>&1 &
        echo $! > "$PID_FILE"
    else
        echo -e "  ${RED}错误: 未找到可用的 HTTP 服务器 (Python/PHP)${NC}"
        return 1
    fi
    
    sleep 1
    
    if is_running "$PID_FILE"; then
        echo -e "  ${GREEN}✓ HTTP 服务器启动成功 (端口: $PORT)${NC}"
        return 0
    else
        echo -e "  ${RED}✗ HTTP 服务器启动失败${NC}"
        return 1
    fi
}

# 启动 Webhook 服务器
start_webhook_server() {
    echo -e "${BLUE}[2/2] 启动 Webhook 服务器...${NC}"
    
    if is_running "$WEBHOOK_PID_FILE"; then
        local pid=$(cat "$WEBHOOK_PID_FILE")
        echo -e "  ${YELLOW}Webhook 服务器已在运行 (PID: $pid)${NC}"
        return 0
    fi
    
    if ! check_port $WEBHOOK_PORT; then
        echo -e "  ${YELLOW}警告: 端口 $WEBHOOK_PORT 已被占用${NC}"
        echo -e "  请使用 ${CYAN}WEBHOOK_PORT=其他端口 ./start.sh${NC} 来指定其他端口"
        return 1
    fi
    
    # 检查 webhook-server.py 是否存在
    if [ ! -f "$SCRIPT_DIR/webhook-server.py" ]; then
        echo -e "  ${YELLOW}跳过: webhook-server.py 不存在${NC}"
        return 0
    fi
    
    cd "$SCRIPT_DIR"
    
    if command -v python3 &> /dev/null; then
        nohup python3 webhook-server.py $WEBHOOK_PORT > "$WEBHOOK_LOG_FILE" 2>&1 &
    elif command -v python &> /dev/null; then
        nohup python webhook-server.py $WEBHOOK_PORT > "$WEBHOOK_LOG_FILE" 2>&1 &
    else
        echo -e "  ${YELLOW}跳过: 未找到 Python${NC}"
        return 0
    fi
    
    echo $! > "$WEBHOOK_PID_FILE"
    sleep 1
    
    if is_running "$WEBHOOK_PID_FILE"; then
        echo -e "  ${GREEN}✓ Webhook 服务器启动成功 (端口: $WEBHOOK_PORT)${NC}"
        return 0
    else
        echo -e "  ${RED}✗ Webhook 服务器启动失败${NC}"
        return 1
    fi
}

# 显示访问信息
show_access_info() {
    local LOCAL_IP=$(get_local_ip)
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ 所有服务已启动！${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}📱 应用访问${NC}"
    echo -e "     本地:     http://localhost:$PORT"
    if [ "$LOCAL_IP" != "localhost" ] && [ -n "$LOCAL_IP" ]; then
        echo -e "     局域网:   http://$LOCAL_IP:$PORT"
    fi
    echo ""
    
    if is_running "$WEBHOOK_PID_FILE"; then
        echo -e "  ${CYAN}🔄 Webhook 配置${NC}"
        echo -e "     Payload URL: http://$LOCAL_IP:$WEBHOOK_PORT/webhook"
        echo -e "     健康检查:    http://$LOCAL_IP:$WEBHOOK_PORT/health"
        echo ""
    fi
    
    echo -e "  ${CYAN}📁 文件位置${NC}"
    echo -e "     HTTP 日志:     $LOG_FILE"
    if is_running "$WEBHOOK_PID_FILE"; then
        echo -e "     Webhook 日志:  $WEBHOOK_LOG_FILE"
    fi
    echo ""
    echo -e "  ${YELLOW}停止所有服务: ./stop.sh${NC}"
    echo ""
}

# 停止所有服务
stop_all() {
    echo -e "${BLUE}停止所有服务...${NC}"
    
    if is_running "$PID_FILE"; then
        local pid=$(cat "$PID_FILE")
        kill "$pid" 2>/dev/null
        rm -f "$PID_FILE"
        echo -e "  ${GREEN}✓ HTTP 服务器已停止${NC}"
    else
        echo -e "  ${YELLOW}HTTP 服务器未运行${NC}"
    fi
    
    if is_running "$WEBHOOK_PID_FILE"; then
        local pid=$(cat "$WEBHOOK_PID_FILE")
        kill "$pid" 2>/dev/null
        rm -f "$WEBHOOK_PID_FILE"
        echo -e "  ${GREEN}✓ Webhook 服务器已停止${NC}"
    else
        echo -e "  ${YELLOW}Webhook 服务器未运行${NC}"
    fi
}

# 显示状态
show_status() {
    echo -e "${CYAN}服务状态:${NC}"
    echo ""
    
    if is_running "$PID_FILE"; then
        local pid=$(cat "$PID_FILE")
        echo -e "  HTTP 服务器:     ${GREEN}运行中${NC} (PID: $pid, 端口: $PORT)"
    else
        echo -e "  HTTP 服务器:     ${RED}未运行${NC}"
    fi
    
    if is_running "$WEBHOOK_PID_FILE"; then
        local pid=$(cat "$WEBHOOK_PID_FILE")
        echo -e "  Webhook 服务器:  ${GREEN}运行中${NC} (PID: $pid, 端口: $WEBHOOK_PORT)"
    else
        echo -e "  Webhook 服务器:  ${RED}未运行${NC}"
    fi
    echo ""
}

# 显示日志
show_logs() {
    local log_type=${1:-all}
    
    case "$log_type" in
        http)
            if [ -f "$LOG_FILE" ]; then
                echo -e "${CYAN}HTTP 服务器日志 (最近 30 行):${NC}"
                tail -n 30 "$LOG_FILE"
            else
                echo -e "${YELLOW}HTTP 日志文件不存在${NC}"
            fi
            ;;
        webhook)
            if [ -f "$WEBHOOK_LOG_FILE" ]; then
                echo -e "${CYAN}Webhook 服务器日志 (最近 30 行):${NC}"
                tail -n 30 "$WEBHOOK_LOG_FILE"
            else
                echo -e "${YELLOW}Webhook 日志文件不存在${NC}"
            fi
            ;;
        *)
            if [ -f "$LOG_FILE" ]; then
                echo -e "${CYAN}═══ HTTP 服务器日志 ═══${NC}"
                tail -n 15 "$LOG_FILE"
                echo ""
            fi
            if [ -f "$WEBHOOK_LOG_FILE" ]; then
                echo -e "${CYAN}═══ Webhook 服务器日志 ═══${NC}"
                tail -n 15 "$WEBHOOK_LOG_FILE"
            fi
            ;;
    esac
}

# 显示帮助
show_help() {
    echo "用法: $0 {start|stop|restart|status|logs}"
    echo ""
    echo "命令:"
    echo "  start          启动所有服务"
    echo "  stop           停止所有服务"
    echo "  restart        重启所有服务"
    echo "  status         查看服务状态"
    echo "  logs           查看所有日志"
    echo "  logs http      只看 HTTP 日志"
    echo "  logs webhook   只看 Webhook 日志"
    echo ""
    echo "环境变量:"
    echo "  PORT           HTTP 服务器端口 (默认: 3500)"
    echo "  WEBHOOK_PORT   Webhook 端口 (默认: 3501)"
    echo "  HOST           绑定地址 (默认: 0.0.0.0)"
}

# 主入口
case "${1:-start}" in
    start)
        show_banner
        start_http_server
        start_webhook_server
        show_access_info
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        sleep 1
        show_banner
        start_http_server
        start_webhook_server
        show_access_info
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        show_help
        exit 1
        ;;
esac
