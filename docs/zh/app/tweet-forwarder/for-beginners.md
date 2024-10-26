# Windows

## 环境准备

-   [git](https://git-scm.com/downloads)

-   [nodejs](https://nodejs.org/zh-cn) (版本为v20)

## 具体步骤

1. 打开powershell / 终端

2. 检查环境是否安装成功
   比如

```bash
> git --version
git version 2.45.1.windows.1
```

```bash
> node --version
v20.14.0
```

只要有版本号出现那么就行

3. 命令部分

```bash
npm install -g pnpm # 安装pnpm包管理器
# 克隆本仓库
git clone https://github.com/idol-bbq-utils/idol-bbq-utils.git
cd idol-bbq-utils
pnpm install
pnpm lerna run --scope=@idol-bbq-utils/tweet-forwarder generate
pnpm build
pnpm run:forwarder
```

4. 如果显示以下信息，那么就说明成功了！

```bash
> pnpm run:forwarder

> idol-bbq-utils@0.0.0 run:forwarder /home/chocoie/projects/idol-bbq-utils/idol-bbq-utils
> lerna run --scope=@idol-bbq-utils/tweet-forwarder run

lerna notice cli v8.1.6
lerna info versioning independent
lerna notice filter including "@idol-bbq-utils/tweet-forwarder"
lerna info filter [ '@idol-bbq-utils/tweet-forwarder' ]

> @idol-bbq-utils/tweet-forwarder:run


> @idol-bbq-utils/tweet-forwarder@0.0.0 run /home/chocoie/projects/idol-bbq-utils/idol-bbq-utils/app/tweet-forwarder
> node lib/main.js

Browser launched
2024-10-26T18:49:47+08:00 [tweet-forwarder] [info]: "[test-bot] init"
2024-10-26T18:49:47+08:00 [tweet-forwarder] [debug]: {"cron":"*/2 * * * *","interval_time":{"max":0,"min":0}}
2024-10-26T18:49:47+08:00 [tweet-forwarder] [info]: "[test-bot] job created for https://x.com, with type default"
```

如果在安装过程中遇到其它问题请善用**搜索引擎**或者**chatgpt**😉。如果遇到网络问题，那么我相信能访问github的你也能解决网络相关的问题。

## 其它说明

**默认配置文件** 你只需要修改 [app/tweet-forwarder/config.yaml](../../../../app/tweet-forwarder/config.yaml) 就行

> 配置文件说明参考 [assets/tweet-forwarder/config.example.prod.zh.yaml](../../../../assets/tweet-forwarder/config.example.prod.zh.yaml)

**启用gallery-dl**

**安装** gallery-dl 或者 **下载** gallery-dl standalone可执行文件，path可以输入命令或者是可执行文件的存放地址
