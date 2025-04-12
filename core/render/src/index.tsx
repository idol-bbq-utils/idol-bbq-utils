import satori from 'satori'
import fs from 'fs'
import { Resvg } from '@resvg/resvg-js'
import type { GenericArticle, Platform } from '@idol-bbq-utils/spider/types'
import dayjs from 'dayjs'
import { platformArticleMapToActionText } from '@idol-bbq-utils/spider/const'

type Article = GenericArticle<Platform> & {
    translation?: string
    translated_by?: string
}

const article = {
    platform: 2,
    a_id: 'DIRRV35T5_r',
    u_id: '_mmiya_mm',
    username: '三宅美羽',
    created_at: 1744296268,
    content:
        'ラブライブ！蓮ノ空女学院スクールアイドルクラブ 105期新メンバー　セラス 柳田 リリエンフェルト 役　三宅 美羽です。\n\nこれからの3年間、せっちゃんと一緒に精一杯頑張って、楽しく過ごしていきます。よろしくお願いいたします🪷✨\n\n#新メンバーお披露目105期\n#蓮ノ空\n#リンクラ\n#lovelive',
    translation: `《Love Live! 莲之空女学院学园偶像俱乐部》105期新成员——饰演塞拉斯·柳田·莉莉安菲尔特的三宅美羽报到。\n\n接下来的三年里，我会和塞拉斯酱一起全力以赴，共度快乐时光。请多多指教🪷✨\n\n#新成员公开105期\n#莲之空\n#LinkCrew\n#lovelive`,
    translated_by: 'DeepSeek-v3',
    url: 'https://x.com/_mmiya_mm/status/1910336812855521655/',
    type: 'tweet',
    ref: null,
    has_media: true,
    media: [
        {
            alt: '三宅美羽(みやけみう)のバストアップ自撮り写真です。\n臙脂色の長袖のセーラー服、青緑のタイを着用し、片手を肩に添えています。鎖骨の下あたりまで伸びた茶髪を緩く巻き、耳元両サイドにピンクのリボンを装着しています。前髪は1:9くらいの割合で分けています。\n微笑を浮かべています。\n\n背景の色は臙脂色より少し明るめの赤色です。',
            translated_by: 'DeepSeek-v3',
            translation:
                '三宅美羽的丰胸自拍照。  \n身着胭脂红色长袖水手服，系着蓝绿色领带，一只手轻搭在肩上。茶色长发微卷垂至锁骨下方，耳侧两边别着粉色蝴蝶结。刘海以约1:9的比例分向两侧。  \n面带微笑。  \n\n背景色是比胭脂红稍亮的红色。',
            type: 'photo',
            url: 'https://pbs.twimg.com/media/GoLhNCPagAAWUwB.jpg',
        },
        {
            alt: '進藤あまね(しんどうあまね)さんと三宅美羽(みやけみう)の写真です。\n二人とも臙脂色の長袖のセーラー服、進藤さんは黄色、三宅は青緑のタイを着用しています。\n\n三宅の背後に進藤さんが立っていて、進藤さんが三宅の側頭部と肩にそれぞれ手を添え、顔も三宅の頭部に近づけてくれています。\n\n進藤さんは黒髪のウルフカット、見目麗しく、きりりとした表情を浮かべています。\n三宅は鎖骨の下あたりまで伸びた茶髪を緩く巻き、耳元両サイドにピンクのリボンを装着しています。前髪は1:9くらいの割合で分けています。きゅっと口を固く結ぶようにして微笑を浮かべています。両手でピースしています。\n\n\n背景の色は臙脂色より少し明るい赤色です。',
            translated_by: 'DeepSeek-v3',
            translation:
                '这是进藤天音（Shindo Amane）和三宅美羽（Miyake Miu）的照片。\n\n两人都穿着胭脂红色的长袖水手服，进藤系着黄色领巾，三宅则佩戴青绿色领巾。\n\n三宅身后站着进藤，进藤将手分别搭在三宅的太阳穴和肩膀上，脸庞也贴近三宅的头部。\n\n进藤留着黑色狼剪发型，容貌秀丽，神情凛然。三宅则拥有一头及锁骨下方的微卷棕发，双耳侧佩戴粉色蝴蝶结，刘海按1:9比例偏分。她抿紧嘴唇露出微笑，双手比着剪刀手。\n\n背景是比胭脂红稍明亮的赤色。',
            type: 'photo',
            url: 'https://pbs.twimg.com/media/GoLhNCWb0AASsij.jpg',
        },
        {
            alt: '三宅美羽(みやけみう)の全身写真です。\n臙脂色の長袖のセーラー服、青緑のタイ、黒タイツ、焦茶のストラップ付きローファーを着用しています。\n鎖骨の下あたりまで伸びた茶髪を緩く巻き、耳元両サイドにピンクのリボンを装着しています。前髪は1:9くらいの割合で分けています。ちょっぴりはにかんでいます。\n\n片足を軽く曲げ、両手はパーの形で開いて肘を曲げ、鎖骨の辺りに掲げています。\n\n背景の色は臙脂色より少し明るめの赤色です。',
            translated_by: 'DeepSeek-v3',
            translation:
                '这是三宅美羽（Miyake Miu）的全身照。\n她穿着胭脂红色的长袖水手服，系着青绿色领带，搭配黑色裤袜和深棕色带扣乐福鞋。\n茶色头发松散地卷曲至锁骨下方位置，双耳侧佩戴粉色蝴蝶结。刘海按约1:9比例斜分，带着些许羞涩神情。\n\n她微微屈起一条腿，双手呈"布"状张开，手肘弯曲举至锁骨高度。\n\n背景是比胭脂红稍明亮的赤色。',
            type: 'photo',
            url: 'https://pbs.twimg.com/media/GoLhNCSagAAkxrx.jpg',
        },
        {
            alt: '三宅美羽(みやけみう)の全身写真です。\n臙脂色の長袖のセーラー服、青緑のタイ、黒タイツ、焦茶のストラップ付きローファーを着用しています。\n鎖骨の下あたりまで伸びた茶髪を緩く巻き、耳元両サイドにピンクのリボンを装着しています。前髪は1:9くらいの割合で分けています。満足気なドヤ顔です。\n\n両足を大きく開き、両手はチョキの形で開いて肘を曲げ、左右に解き放っています。写真ではピースがぶれています。\n\n背景の色は臙脂色より少し明るめの赤色です。',
            translated_by: 'DeepSeek-v3',
            translation:
                '这是三宅美羽（Miyake Miu）的全身照片。\n她身着胭脂红色的长袖水手服，搭配青绿色领带、黑色连裤袜以及带有深棕色鞋带的乐福鞋。\n茶色头发松软地卷曲着，长度延伸至锁骨下方，双耳旁装饰着粉色蝴蝶结。前刘海以约1:9的比例分界。脸上洋溢着得意的神情。\n\n双腿大幅度张开，双手比着剪刀手手肘弯曲，向左右两侧伸展。照片中的剪刀手有些模糊。\n\n背景色是比胭脂红稍明亮的红色。',
            type: 'photo',
            url: 'https://pbs.twimg.com/media/GoLhNCTbQAALF-E.jpg',
        },
    ],
    extra: null,
    u_avatar: 'https://pbs.twimg.com/profile_images/1841604612991934464/QB-S8UBi.jpg',
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
            <span tw="font-bold" lang="ja-JP">
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
            {text && <span tw="mx-2 text-[#CFD9DE]">{text}</span>}
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
                name: 'Noto Sans zh-CN',
                data: fs.readFileSync('./assets/fonts/NotoSansSC-Regular.ttf'),
                style: 'normal',
                weight: 400,
                lang: 'zh-CN',
            },
            {
                name: 'Noto Sans jp',
                data: fs.readFileSync('./assets/fonts/NotoSansJP-Regular.ttf'),
                style: 'normal',
                weight: 400,
                lang: 'ja-JP',
            },
            {
                name: 'Noto Sans',
                data: fs.readFileSync('./assets/fonts/NotoSans-Regular.ttf'),
                style: 'normal',
                weight: 400,
            },
            {
                name: 'Noto Sans zh-CN',
                data: fs.readFileSync('./assets/fonts/NotoSansSC-Bold.ttf'),
                style: 'normal',
                weight: 700,
                lang: 'zh-CN',
            },
            {
                name: 'Noto Sans jp',
                data: fs.readFileSync('./assets/fonts/NotoSansJP-Bold.ttf'),
                style: 'normal',
                weight: 700,
                lang: 'ja-JP',
            },
            {
                name: 'Noto Sans',
                data: fs.readFileSync('./assets/fonts/NotoSans-Bold.ttf'),
                style: 'normal',
                weight: 700,
            },
        ],
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
