# idol-bbq-utils

> 偶像吃的瑞士军刀.jpg

-   [SNS转发爬虫](app/tweet-forwarder/README.md)

## 应用介绍

### SNS转发爬虫

目前实现的功能如下

<table>
  <tr>
    <th>抓取网站</th>
    <th>转发平台</th>
    <th>大模型翻译</th>
    <th>转发功能</th>
    <th>媒体文件功能（使用gallery-dl）</th>
  </tr>
  <tr>
    <td rowspan="12"><a href="https://x.com" target="_blank">推特(X)</a></td>
    <td>qq<a href="https://github.com/botuniverse/onebot-11" target="_blank">（onebot11）</a></td>
    <td rowspan="12">
        <a href="https://ai.google.dev/gemini-api/docs/api-key?hl=zh-cn" target="_blank" style="display: block;">谷歌 gemini（免费，api有区域限制）</a>
        <br>
        <a href="https://bigmodel.cn/dev/api/normal-model/glm-4" target="_blank" style="display: block;">智谱 glm-4-flash（免费）</a>
        <br>
        <a href="https://www.volcengine.com/docs/82379/1263594#%E9%80%82%E7%94%A8%E8%8C%83%E5%9B%B4" target="_blank" style="display: block;">字节豆包 doubao-128k-pro</a>
    </td>
    <td rowspan="12">
        转发原推文并翻译<br>转发带图/视频推文<br>粉丝数统计
    </td>
    <td rowspan="2">
        图片/视频
    </td>
  </tr>
  <tr>
    <td>telegram</td>
  </tr>
  <tr>
    <td>bilibili</td>
    <td>只有图片</td>
  </tr>
</table>

爬虫配置文件格式见 [config.yaml](assets/tweet-forwarder/config.example.prod.zh.yaml)

环境变量说明见下方Docker部署方式

[具体部署情况参考说明](#实战参考)

本仓库cookies文件格式是Netscape，可以使用浏览器扩展[Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)获取文件

[gallery-dl](https://github.com/mikf/gallery-dl) 仓库地址

#### 如何使用/部署

**Docker**

x86-64，debian

docker-compose.yaml 示例

```yaml
services:
    sns-forwarder:
        # build: # 宿主机从源码进行docker build
        #   context: .
        #   dockerfile: app/tweet-forwarder/Dockerfile
        image: ghcr.io/idol-bbq-utils/idol-bbq-utils:latest
        container_name: 'sns-forwarder'
        restart: 'on-failure'
        environment:
            - TZ=Asia/Shanghai
            # - NO_SANDBOX=true       # 如果容器启动时发现chrome提示namespace相关问题，可以尝试启用此环境变量
            # - CACHE_DIR_ROOT=       # log和图片的暂存目录，默认为/tmp
        volumes:
            - './assets/tweet-forwarder/config.example.yaml:/app/config.yaml' # 映射config.yaml
            - './assets/tweet-forwarder/data.db:/app/data.db' # 映射sqlite db
            - './assets:/app/assets' # 映射其余可能会用到的资源目录
            - '/tmp:/tmp' # 提供图片路径给qq onebot server，所以需要映射容器目录至主机上，假设onebot server也部署在本机
```

**直接运行**

需要nodejs（版本为20+）, pnpm

```bash
#/bin/bash

git clone https://github.com/idol-bbq-utils/idol-bbq-utils
cd idol-bbq-utils
# 设置prisma orm的数据库地址，此应用使用的是sqlite
export DATABASE_URL="file:../../../data.db"
# 安装依赖
pnpm install
# 初始化数据库
pnpm lerna run --scope=@idol-bbq-utils/tweet-forwarder generate
# 编译源码
pnpm pnpm lerna run --scope=@idol-bbq-utils/tweet-forwarder build --include-dependencies
# 准备配置文件
cp assets/config.example.yaml ./config.yaml

# 启动并运行
node ./app/tweet-forwrader/lib/main.js
```

#### 实战参考

由于受性能限制，我所使用的[配置文件](assets/tweet-forwarder/config.example.prod.zh.yaml)尽量在同一时间只允许使用一个浏览器标签页。所以可以看见我的爬虫规则都是在爬取完一个页面后才进行下一个用户信息的爬取。

此外，测试过程中发现推特会给每个账号设置**每日的推文浏览量上限**。目前我所使用的相对比较可靠的配置是：

-   两个账号，每天分别爬取12小时，爬取间隔为每10分钟一次。
-   爬取关注量不需要登录态。

**具体可以参考我所使用的[配置文件](assets/tweet-forwarder/config.example.prod.zh.yaml)**

-   如果爬取的用户没那么多，而且需要尝试更激进的策略，比如一分钟爬一次，那么可以自己探索下。

-   如果有使用docker的需求，请注意一下文件/文件夹的权限等

-   如果需要转发图片/视频，那么使用[gallery-dl.bin](https://github.com/mikf/gallery-dl?tab=readme-ov-file#standalone-executable)即可（注意这是glibc的）

##### 性能需求

内存至少大于1G（一般2G，防止swap），硬盘空间最少大于2G（因为你需要一个chrome），推荐2核及以上。

**实际测试情况**

```text
1C1G服务器 同时只能存在一个tab进行处理
程序一天死一次，4分钟做完任务爬取9个人的任务
与此同时服务器上的nginx照常使用，但无法使用docker进行ffmpeg rtmp转播

2C1G 没测多tab
3天挂一次，2分钟左右做完任务
使用docker进行ffmpeg转播，表现为kswapd0 20%左右的占用
内存占满，需要swap换页，导致问题发生

3C2G（当前配置）
比较稳定，2分钟左右完成一次任务
同时也可以使用docker进行ffmpeg rtmp转播
```

---

## 开发说明

> todo

## 其他说明

实际测试，可以使用alpine运行，(gallery-dl需要在alpine下重新编译为standalone)，chromium浏览器一直占用一个核100%的问题。
