#!/usr/bin/env python3
"""
GitHub Webhook 服务器
用于接收 GitHub push 事件并自动执行 git pull 更新代码

使用方法:
  python3 webhook-server.py [端口号]
  默认端口: 3501

GitHub Webhook 配置:
  1. 进入仓库 Settings -> Webhooks -> Add webhook
  2. Payload URL: http://你的服务器IP:3501/webhook
  3. Content type: application/json
  4. Secret: 设置一个密钥（可选但推荐）
  5. 选择 "Just the push event"
"""

import http.server
import json
import subprocess
import os
import sys
import hmac
import hashlib
from datetime import datetime

# 配置
WEBHOOK_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3501
# Webhook 密钥（在 GitHub Webhook 设置中配置相同的值，留空则不验证）
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', '')
# 项目目录（webhook-server.py 所在目录）
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
# 日志文件
LOG_FILE = os.path.join(PROJECT_DIR, 'webhook.log')


def log(message):
    """写入日志"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_line = f"[{timestamp}] {message}"
    print(log_line)
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(log_line + '\n')
    except Exception as e:
        print(f"写入日志失败: {e}")


def verify_signature(payload, signature):
    """验证 GitHub Webhook 签名"""
    if not WEBHOOK_SECRET:
        return True
    
    if not signature:
        return False
    
    # GitHub 使用 sha256
    expected = 'sha256=' + hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected, signature)


def git_pull():
    """执行 git pull 更新代码"""
    try:
        log("开始执行 git pull...")
        
        # 切换到项目目录
        os.chdir(PROJECT_DIR)
        
        # 先 fetch
        result_fetch = subprocess.run(
            ['git', 'fetch', 'origin'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result_fetch.returncode != 0:
            log(f"git fetch 失败: {result_fetch.stderr}")
            return False, result_fetch.stderr
        
        # 再 pull
        result_pull = subprocess.run(
            ['git', 'pull', 'origin', 'main'],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result_pull.returncode == 0:
            output = result_pull.stdout.strip()
            log(f"git pull 成功: {output}")
            return True, output
        else:
            log(f"git pull 失败: {result_pull.stderr}")
            return False, result_pull.stderr
            
    except subprocess.TimeoutExpired:
        log("git 操作超时")
        return False, "操作超时"
    except Exception as e:
        log(f"git pull 异常: {str(e)}")
        return False, str(e)


class WebhookHandler(http.server.BaseHTTPRequestHandler):
    """处理 GitHub Webhook 请求"""
    
    def log_message(self, format, *args):
        """覆盖默认日志，使用自定义日志"""
        log(f"HTTP: {args[0]}")
    
    def send_json_response(self, status_code, data):
        """发送 JSON 响应"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def do_GET(self):
        """处理 GET 请求 - 用于健康检查"""
        if self.path == '/health' or self.path == '/':
            self.send_json_response(200, {
                'status': 'ok',
                'message': 'Webhook 服务器运行中',
                'project_dir': PROJECT_DIR
            })
        else:
            self.send_json_response(404, {'error': '未找到'})
    
    def do_POST(self):
        """处理 POST 请求 - 接收 Webhook"""
        if self.path != '/webhook':
            self.send_json_response(404, {'error': '未找到'})
            return
        
        # 读取请求体
        content_length = int(self.headers.get('Content-Length', 0))
        payload = self.rfile.read(content_length)
        
        # 验证签名
        signature = self.headers.get('X-Hub-Signature-256', '')
        if not verify_signature(payload, signature):
            log("Webhook 签名验证失败")
            self.send_json_response(403, {'error': '签名验证失败'})
            return
        
        # 解析 JSON
        try:
            data = json.loads(payload.decode('utf-8'))
        except json.JSONDecodeError:
            log("无效的 JSON 数据")
            self.send_json_response(400, {'error': '无效的 JSON'})
            return
        
        # 检查事件类型
        event_type = self.headers.get('X-GitHub-Event', '')
        log(f"收到 GitHub 事件: {event_type}")
        
        if event_type == 'ping':
            # GitHub 连接测试
            log("Webhook ping 测试成功")
            self.send_json_response(200, {'message': 'pong'})
            return
        
        if event_type != 'push':
            log(f"忽略非 push 事件: {event_type}")
            self.send_json_response(200, {'message': f'忽略事件: {event_type}'})
            return
        
        # 获取推送信息
        ref = data.get('ref', '')
        pusher = data.get('pusher', {}).get('name', '未知')
        commits = data.get('commits', [])
        commit_count = len(commits)
        
        log(f"Push 事件: {pusher} 推送了 {commit_count} 个提交到 {ref}")
        
        # 只处理 main/master 分支
        if ref not in ['refs/heads/main', 'refs/heads/master']:
            log(f"忽略非主分支推送: {ref}")
            self.send_json_response(200, {'message': f'忽略分支: {ref}'})
            return
        
        # 执行 git pull
        success, message = git_pull()
        
        if success:
            self.send_json_response(200, {
                'status': 'success',
                'message': '更新成功',
                'git_output': message
            })
        else:
            self.send_json_response(500, {
                'status': 'error',
                'message': '更新失败',
                'error': message
            })


def main():
    """启动 Webhook 服务器"""
    log("=" * 50)
    log("GitHub Webhook 服务器启动")
    log(f"监听端口: {WEBHOOK_PORT}")
    log(f"项目目录: {PROJECT_DIR}")
    log(f"密钥验证: {'已启用' if WEBHOOK_SECRET else '未启用'}")
    log("=" * 50)
    log("")
    log("GitHub Webhook 配置指南:")
    log("  1. 进入仓库 Settings -> Webhooks -> Add webhook")
    log(f"  2. Payload URL: http://你的服务器IP:{WEBHOOK_PORT}/webhook")
    log("  3. Content type: application/json")
    log("  4. Secret: (可选) 设置后请配置 WEBHOOK_SECRET 环境变量")
    log("  5. 选择 'Just the push event'")
    log("")
    
    server = http.server.HTTPServer(('0.0.0.0', WEBHOOK_PORT), WebhookHandler)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("服务器已停止")
        server.shutdown()


if __name__ == '__main__':
    main()
