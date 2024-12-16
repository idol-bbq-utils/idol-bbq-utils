# idol-bbq-utils

> 偶像吃的瑞士军刀.jpg

-   [SNS转发爬虫](app/tweet-forwarder/README.md)

## SNS转发爬虫

[直接上手的指南](docs/zh/app/tweet-forwarder/for-beginners.md)

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

-   配置文件: [config.yaml](assets/tweet-forwarder/config.example.prod.zh.yaml)

-   cookie: 本仓库cookies文件格式是Netscape，可以使用浏览器扩展[Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)获取文件

-   gallery-dl: [gallery-dl](https://github.com/mikf/gallery-dl) 仓库地址

-   如何部署: [具体部署情况参考说明](#实战参考)

-   环境变量: 说明见下方Docker部署方式

### 如何使用/部署

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

### 实战参考

由于受性能限制，我所使用的[配置文件](assets/tweet-forwarder/config.example.prod.zh.yaml)尽量在同一时间只允许使用一个浏览器标签页。所以可以看见我的爬虫规则都是在爬取完一个页面后才进行下一个用户信息的爬取。

此外，测试过程中发现推特会给每个账号设置**每日的推文浏览量上限**。目前我所使用的相对比较可靠的配置是：

-   两个账号，每天分别爬取12小时，爬取间隔为每10分钟一次。
-   爬取关注量不需要登录态。

**具体可以参考我所使用的[配置文件](assets/tweet-forwarder/config.example.prod.zh.yaml)**

-   如果爬取的用户没那么多，而且需要尝试更激进的策略，比如一分钟爬一次，那么可以自己探索下。

-   如果有使用docker的需求，请注意一下文件/文件夹的权限等

-   如果需要转发图片/视频，那么使用[gallery-dl.bin](https://github.com/mikf/gallery-dl?tab=readme-ov-file#standalone-executable)即可（注意这是glibc的）

### 性能需求

内存至少大于1G（一般2G，防止swap），硬盘空间最少大于2G（因为你需要一个chrome），推荐2核及以上。

如果你需要在同一时间内同时爬取两个及以上网站，推荐内存大于1G。

**实际测试情况**

| 核  | 内存 | 操作系统/架构                                                    | 可用情况 | 多tab | 具体表现                                                                                                                                                                                        |
| --- | ---- | ---------------------------------------------------------------- | -------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 1G   | ubuntu 22.04 / amd64 / Common KVM processor @ 2.40GHz            | ❌       | ❌    | 同时只能存在一个tab进行处理<br>程序一天死一次，4分钟做完爬取9个人的任务<br>不过使用docker的情况下可以较为方便的让爬虫自启<br>与此同时服务器上用于反代的nginx照常使用，但无法进行ffmpeg rtmp转播 |
| 2   | 1G   | ubuntu 22.04 / amd64                                             | ❌       | ❌    | 3天挂一次，2分钟左右做完任务，之后会越来越慢<br>如果同时使用docker进行ffmpeg转播，表现为kswapd0 20%左右的占用<br>内存占满，需要swap换页，导致问题发生                                           |
| 3   | 2G   | ubuntu 22.04 / amd64                                             | ✅       | 没测  | 比较稳定，2分钟左右完成一次任务<br>同时也可以使用docker进行ffmpeg rtmp转播                                                                                                                      |
| 8   | 4G   | ubuntu 22.04 / amd64 / Intel(R) Xeon(R) CPU E5-2697 v2 @ 2.70GHz | ✅       | ✅    | 非常稳定，程序可以保持至少10天正常运行<br>在系统只运行此转发爬虫的重型应用的情况下，待机内存占用为600~700MB，工作时的内存（两个爬虫同时运行）占用接近1G<br>同时可以使用ffmpeg rtmp进行流畅转播  |

### 其他说明

实际测试，可以使用alpine运行，(gallery-dl需要在alpine下重新编译为standalone)，chromium浏览器一直占用一个核100%的问题。

## 开发说明

> todo
