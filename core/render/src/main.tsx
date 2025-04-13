import satori from 'satori'
import fs from 'fs'
import { Resvg } from '@resvg/resvg-js'
import dayjs from 'dayjs'
import { platformArticleMapToActionText } from '@idol-bbq-utils/spider/const'
import type { Article } from './types'
import { loadDynamicAsset } from './img'

const article = {
    id: 2183,
    platform: 1,
    a_id: '1910575219397554192',
    u_id: 'amane_bushi',
    username: '進藤あまね',
    created_at: 1744351603,
    content: '畠中さんありがとうございます✨️😭',
    translation: '非常感谢畠中先生✨️😭',
    translated_by: 'DeepSeek-v3',
    url: 'https://x.com/amane_bushi/status/1910575219397554192',
    type: 'conversation',
    ref: {
        id: 2182,
        platform: 1,
        a_id: '1910389132813336688',
        u_id: 'lilith0913',
        username: '畠中愛🎮声優･クリエイター👾',
        created_at: 1744307237,
        content: 'わーーーーっ！！！！\nおめでとうございます！！！🎉✨',
        translation: '哇————！！！！\n恭喜你！！！🎉✨',
        translated_by: 'DeepSeek-v3',
        url: 'https://x.com/lilith0913/status/1910389132813336688',
        type: 'conversation',
        ref: {
            id: 2072,
            platform: 1,
            a_id: '1910328568523169896',
            u_id: 'amane_bushi',
            username: '進藤あまね',
            created_at: 1744292797,
            content:
                'ラブライブ！蓮ノ空女学院スクールアイドルクラブ 105期新メンバー 桂城 泉 役 進藤あまねです！\n\nラブライブ！が大好きです❣️\nこれから泉ちゃんと共に皆さんの心に素敵な夢と花を咲かせられるよう、精進致します🪷\nよろしくお願いいたします💚\n\n#新メンバーお披露目105期\n#蓮ノ空 #リンクラ #lovelive ',
            translation:
                '我是饰演《Love Live! 莲之空女学院学园偶像俱乐部》105期新成员桂城泉的进藤天音！\n\n超级喜欢《Love Live!》❣️\n今后我将与泉酱一起努力，在大家心中绽放美好的梦想与花朵🪷\n请多指教💚\n\n#新成员公开105期  \n#莲之空 #Linkra #lovelive',
            translated_by: 'DeepSeek-v3',
            url: 'https://x.com/amane_bushi/status/1910328568523169896',
            type: 'quoted',
            ref: {
                id: 2008,
                platform: 1,
                a_id: '1910302571396468773',
                u_id: 'hasunosora_SIC',
                username: 'ラブライブ！蓮ノ空女学院スクールアイドルクラブ（Link！Like！ラブライブ！）',
                created_at: 1744286599,
                content:
                    '🪷蓮ノ空女学院スクールアイドルクラブ🪷\n\n✨105期メンバー紹介✨\n#新メンバーお披露目105期\n\n　日野下 花帆\n　村野 さやか\n　大沢 瑠璃乃\n　百生 吟子\n　徒町 小鈴\n　安養寺 姫芽\n　セラス 柳田 リリエンフェルト\n　桂城 泉\n\n105期の蓮ノ空もよろしくお願いします🪷\n\n#蓮ノ空 #リンクラ #lovelive ',
                translation:
                    '🪷莲之空女学院学园偶像俱乐部🪷\n\n✨105期成员介绍✨\n#新成员公开105期\n\n　日野下 花帆\n　村野 沙耶香\n　大泽 瑠璃乃\n　百生 吟子\n　徒町 小铃\n　安养寺 姬芽\n　塞拉斯·柳田·莉莉安菲尔特\n　桂城 泉\n\n105期的莲之空也请多多关照🪷\n\n#蓮ノ空 #リンクラ #lovelive',
                translated_by: 'DeepSeek-v3',
                url: 'https://x.com/hasunosora_SIC/status/1910302571396468773',
                type: 'tweet',
                ref: null,
                has_media: true,
                media: [
                    {
                        type: 'photo',
                        url: 'https://pbs.twimg.com/media/GoLBdkEagAA6xni.jpg',
                    },
                ],
                extra: null,
                u_avatar: 'https://pbs.twimg.com/profile_images/1581612389681680385/cW-pDN_b.jpg',
            },
            has_media: true,
            media: [
                {
                    type: 'photo',
                    url: 'https://pbs.twimg.com/media/GoLZtBiaUAAGMBy.jpg',
                },
                {
                    type: 'photo',
                    url: 'https://pbs.twimg.com/media/GoLZtBiaEAA98NZ.jpg',
                },
                {
                    type: 'photo',
                    url: 'https://pbs.twimg.com/media/GoLZtBjaQAAWi39.jpg',
                },
            ],
            extra: null,
            u_avatar: 'https://pbs.twimg.com/profile_images/1785528174346211328/2uIsAKPL.jpg',
        },
        has_media: false,
        media: null,
        extra: null,
        u_avatar: 'https://pbs.twimg.com/profile_images/1844812440229535744/PL7kRwnr.jpg',
    },
    has_media: false,
    media: null,
    extra: null,
    u_avatar: 'https://pbs.twimg.com/profile_images/1785528174346211328/2uIsAKPL.jpg',
} as Article

const CARD_WIDTH = 600
const CONTENT_WIDTH = CARD_WIDTH - 16 * 2 - 64 - 12
const IMAGE_WIDTH = (CONTENT_WIDTH - 4) / 2
const BASE_FONT_SIZE = 16

function Metaline({ article }: { article: Article }) {
    return (
        <div
            tw="flex flex-wrap text-base leading-tight items-baseline"
            style={{
                columnGap: '8px',
            }}
        >
            <span tw="font-bold" lang="zh-CN" style={{ fontWeight: 700 }}>
                {article.username}
            </span>
            <span tw="font-normal text-[#536471]" lang="zh-CN">
                @{article.u_id} · {dayjs.unix(article.created_at).format('YY年MM月DD日 HH:mmZ')}
            </span>
            <span tw="text-xs text-[#536471]" lang="zh-CN">
                {platformArticleMapToActionText[article.platform][article.type]}
            </span>
        </div>
    )
}

function Divider({ text, dash }: { text?: string; dash?: boolean }) {
    return (
        <div tw="flex items-center px-5 h-3 text-xs leading-tight">
            <div
                tw="border-t border-[#CFD9DE] flex-grow"
                style={{
                    borderTopStyle: dash ? 'dashed' : 'solid',
                }}
            />
            {text && (
                <span tw="mx-2 text-[#CFD9DE]" lang="zh-CN">
                    {text}
                </span>
            )}
            {text && (
                <div
                    tw="border-t border-[#CFD9DE] flex-grow"
                    style={{
                        borderTopStyle: dash ? 'dashed' : 'solid',
                    }}
                />
            )}
        </div>
    )
}

function MediaGroup({ media: _media }: { media: Exclude<Article['media'], null> }) {
    const media = _media.filter((m) => m.type === 'photo' || m.type === 'video_thumbnail')
    const last_media = media.length % 2 === 1 ? media.pop() : null
    return (
        <div
            tw="flex rounded-lg overflow-hidden shadow-sm flex-wrap"
            style={{
                gap: '4px',
            }}
        >
            {media.map((m, i) => (
                <div key={i} tw="flex overflow-hidden" style={{ flexBasis: '244px' }}>
                    <div
                        tw="flex relative w-full"
                        style={{
                            paddingTop: '56.25%',
                        }}
                    >
                        <img
                            src={m.url}
                            tw="left-0 right-0 top-0 bottom-0 absolute"
                            style={{
                                objectFit: 'cover',
                            }}
                        />
                    </div>
                </div>
            ))}

            {last_media && (
                <div tw="flex">
                    <div
                        tw="flex relative w-full"
                        style={{
                            paddingTop: '56.25%',
                        }}
                    >
                        <img
                            src={last_media.url}
                            tw="left-0 right-0 top-0 bottom-0 absolute"
                            style={{
                                objectFit: 'cover',
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * 在Node.js环境中估算文本在指定容器宽度和字体大小下的行数
 * @param {string} text - 要计算的文本内容
 * @param {number} fontSize - 字体大小(px)
 * @param {number} containerWidth - 容器宽度(px)
 * @return {number} 估算的文本行数
 */
function estimateTextLinesHeight(text: string, fontSize: number, containerWidth: number) {
    if (!text) {
        return 0
    }
    // 1. 处理硬换行符 - 分割文本成行
    const paragraphs = text.split('\n')

    // 2. 估算每个字符的平均宽度 - 一个粗略的估计
    // 英文字符约为字体大小的0.6倍，中日韩字符约为字体大小的1.0倍
    const avgCharWidthLatin = fontSize * 0.6 // 拉丁字符(英文、数字等)
    const avgCharWidthCJK = fontSize * 1.0 // 中日韩字符

    let totalLines = 0

    // 3. 处理每个段落
    for (const paragraph of paragraphs) {
        if (paragraph.length === 0) {
            // 空行计为一行
            totalLines += 1
            continue
        }

        // 估算这个段落的总宽度
        let paragraphWidth = 0

        for (const char of paragraph) {
            // 判断字符是拉丁字符还是CJK字符
            // 这是一个简化的判断，实际情况可能更复杂
            const charCode = char.charCodeAt(0)
            if (charCode > 0x3000) {
                // 粗略判断是否为CJK字符
                paragraphWidth += avgCharWidthCJK
            } else {
                paragraphWidth += avgCharWidthLatin
            }
        }

        // 计算此段落需要的行数
        const linesNeeded = Math.max(1, Math.ceil(paragraphWidth / containerWidth))
        totalLines += linesNeeded
    }

    return totalLines * fontSize * 1.25 // 1.25是行高的倍数
}

function estimateImagesHeight(media: Exclude<Article['media'], null>) {
    if (!media || media.length === 0) {
        return 0
    }
    const imageCount = media.filter((m) => m.type === 'photo' || m.type === 'video_thumbnail').length
    return (
        ((imageCount % 2) * CONTENT_WIDTH + Math.floor(imageCount / 2) * IMAGE_WIDTH) * (9 / 16) +
        (Math.ceil(imageCount / 2) - 1) * 4
    )
}

function BaseCard({ article }: { article: Article }) {
    return (
        <div
            tw="p-4 pb-5 bg-white rounded-2xl shadow-sm h-full w-full flex flex-row"
            style={{
                columnGap: '12px',
            }}
        >
            {article.u_avatar ? (
                <img tw="w-16 h-16 rounded-full flex-none" src={article.u_avatar} alt={article.username} />
            ) : (
                <div tw="w-16 h-16 rounded-full bg-gray-200 flex-none" />
            )}
            <div
                tw="flex flex-col"
                style={{
                    rowGap: '0.5rem',
                    width: `${CONTENT_WIDTH}px`,
                }}
            >
                <Metaline article={article} />
                {article.translation && (
                    <pre
                        tw="w-full my-0 text-base leading-tight"
                        style={{
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {article.translation}
                    </pre>
                )}
                {article.translation && (
                    <Divider text={article.translated_by ? `由${article.translated_by}提供翻译` : ''} />
                )}
                {article.content && (
                    <pre
                        tw="w-full text-[#525252] my-0 text-base leading-tight"
                        style={{
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {article.content}
                    </pre>
                )}
                {((article.media && article.media.length > 0) || article.extra) && <Divider dash />}
                {article.media && article.media.length > 0 && <MediaGroup media={article.media} />}
            </div>
        </div>
    )
}

async function main() {
    const contentHeightArray = [
        estimateTextLinesHeight(
            `@${article.u_id} · ${dayjs.unix(article.created_at).format('YY年MM月DD日 HH:mmZ')}`,
            BASE_FONT_SIZE,
            CONTENT_WIDTH,
        ), // metaline
        estimateTextLinesHeight(article.translation ?? '', BASE_FONT_SIZE, CONTENT_WIDTH), // translation
        article.translation ? 1 : 0, // translation divider
        estimateTextLinesHeight(article.content ?? '', BASE_FONT_SIZE, CONTENT_WIDTH), // content
        article.extra ? 1 : 0, // extra divider
        article.has_media ? 1 : 0, // media or extra divider
        estimateImagesHeight(article.media ?? []), // media
    ]
    const estimatedHeight = [
        16, // padding top
        contentHeightArray.flatMap((item, index) => (index < contentHeightArray.length - 1 ? [item, 12] : [item])), // content
        20, // padding bottom
    ]
        .flat()
        .reduce((a, b) => a + b, 0)
    const svg = await satori(<BaseCard article={article} />, {
        width: CARD_WIDTH,
        height: estimatedHeight,
        fonts: [
            {
                name: 'Noto Sans',
                data: fs.readFileSync('./assets/fonts/NotoSans-Regular.ttf'),
                style: 'normal',
                weight: 400,
            },
            {
                name: 'Noto Sans',
                data: fs.readFileSync('./assets/fonts/NotoSans-Bold.ttf'),
                style: 'normal',
                weight: 700,
            },
        ],
        loadAdditionalAsset: (code: string, text: string) => {
            console.log('loadAdditionalAsset', code, text)
            return loadDynamicAsset('twemoji', code, text)
        },
    })
    const resvg = new Resvg(svg, {
        fitTo: {
            mode: 'width',
            value: CARD_WIDTH * 2,
        },
    })
    const data = resvg.render()
    const imageBuffer = data.asPng()
    fs.writeFileSync('./output.png', imageBuffer)
}

main()
