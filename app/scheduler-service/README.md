# Scheduler Service

调度服务，负责任务调度和转发执行。

## 功能特性

- **Spider 任务调度**: 根据配置的 cron 表达式定时触发爬虫任务
- **Forwarder 任务调度**: 根据配置的 cron 表达式定时触发转发任务
- **Forwarder Worker**: 消费 Redis SENDER 队列，执行实际的转发操作

## 运行模式

通过环境变量可以控制服务的运行模式，支持三种部署方式：

### 1. 混合模式（默认）

**环境变量:**
```bash
ENABLE_SCHEDULER=true          # 启用任务调度器
ENABLE_SENDER_WORKER=true   # 启用转发 worker
```

**适用场景:**
- 单机部署
- 中小规模应用
- 简化运维复杂度

**特点:**
- 一个服务包含所有功能
- 调度和执行在同一进程
- 最简单的部署方式

### 2. 纯调度模式

**环境变量:**
```bash
ENABLE_SCHEDULER=true          # 启用任务调度器
ENABLE_SENDER_WORKER=false  # 禁用转发 worker
```

**适用场景:**
- 需要独立扩展 forwarder worker
- 调度器和 worker 需要不同的资源配置
- 高可用部署（调度器单实例，worker 多实例）

**特点:**
- 只负责任务调度，不执行转发
- 需要单独部署 forwarder-worker 服务
- 调度器轻量级，资源占用少

### 3. 纯 Worker 模式

**环境变量:**
```bash
ENABLE_SCHEDULER=false         # 禁用任务调度器
ENABLE_SENDER_WORKER=true   # 启用转发 worker
```

**适用场景:**
- 横向扩展 forwarder worker
- 增加转发吞吐量
- 多实例部署

**特点:**
- 只消费队列，不调度任务
- 可以启动多个实例
- 适合高负载场景

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `ENABLE_SCHEDULER` | `true` | 是否启用任务调度器 |
| `ENABLE_SENDER_WORKER` | `true` | 是否启用转发 worker |
| `SENDER_WORKER_CONCURRENCY` | `3` | 转发 worker 并发数 |
| `REDIS_HOST` | `localhost` | Redis 主机地址 |
| `REDIS_PORT` | `6379` | Redis 端口 |
| `REDIS_PASSWORD` | - | Redis 密码（可选） |
| `REDIS_DB` | `0` | Redis 数据库编号 |
| `DATABASE_URL` | - | 数据库连接字符串 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `TZ` | - | 时区设置 |

## Docker Compose 部署示例

### 混合模式部署

```yaml
scheduler:
  image: idol-bbq-scheduler
  environment:
    - ENABLE_SCHEDULER=true
    - ENABLE_SENDER_WORKER=true
    - SENDER_WORKER_CONCURRENCY=3
```

### 分离部署（调度器 + 独立 Worker）

```yaml
scheduler:
  image: idol-bbq-scheduler
  environment:
    - ENABLE_SCHEDULER=true
    - ENABLE_SENDER_WORKER=false

forwarder-worker:
  image: idol-bbq-scheduler
  environment:
    - ENABLE_SCHEDULER=false
    - ENABLE_SENDER_WORKER=true
    - SENDER_WORKER_CONCURRENCY=5
  deploy:
    replicas: 3
```

## 启动日志

服务启动时会输出当前运行模式：

```
[Scheduler] Scheduler service initializing...
[Scheduler] Mode: Scheduler=true, ForwarderWorker=true
[Scheduler] Started forwarder worker (concurrency: 3)
[Scheduler] Initialized spider scheduler with 5 crawler(s)
[Scheduler] Initialized sender scheduler with 10 sender(s)
[Scheduler] Scheduler service started successfully
```

## 注意事项

1. **至少启用一种模式**: `ENABLE_SCHEDULER` 和 `ENABLE_SENDER_WORKER` 不能同时为 `false`
2. **配置文件**: 即使是纯 Worker 模式，也需要挂载 `config.yaml`（用于读取转发配置）
3. **数据库访问**: Forwarder Worker 需要访问数据库查询文章数据，必须配置 `DATABASE_URL`
4. **资源配置**: 
   - 调度器: 轻量级，建议 256MB 内存
   - Worker: 中量级，建议 512MB-1GB 内存（取决于并发数）
   - 混合模式: 建议 1GB 内存

## 故障排查

### 服务启动失败

**错误**: `Both ENABLE_SCHEDULER and ENABLE_SENDER_WORKER are disabled`

**解决**: 至少将其中一个设置为 `true`

### Worker 不消费队列

**可能原因**:
1. `ENABLE_SENDER_WORKER=false`
2. Redis 连接失败
3. 队列中没有任务

**检查方法**:
```bash
# 查看日志
docker logs idol-bbq-scheduler

# 检查 Redis 队列
redis-cli llen bull:sender:wait
```

### 调度器不生成任务

**可能原因**:
1. `ENABLE_SCHEDULER=false`
2. 配置文件中没有定义 sender 任务
3. cron 表达式尚未触发

**检查方法**:
```bash
# 查看配置
cat config.yaml | grep -A 10 senders

# 查看日志
docker logs idol-bbq-scheduler | grep "Initialized sender scheduler"
```
