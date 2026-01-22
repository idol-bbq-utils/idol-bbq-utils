import { parseRawContent, parseTranslationContent } from '@/text'
import type { Article } from '@/types'
import { X } from '@idol-bbq-utils/spider'
import { platformArticleMapToActionText } from '@idol-bbq-utils/spider/const'
import clsx from 'clsx'
import dayjs from 'dayjs'
import _, { reduce } from 'lodash'
import type { JSX } from 'react/jsx-runtime'
import SVG from '@/img/assets/svg'
import { KOZUE } from '@/img/assets/img'

const CARD_WIDTH = 600
const CONTENT_WIDTH = CARD_WIDTH - 16 * 2 - 64 - 12
const BASE_FONT_SIZE = 16

function getContentWidth(level: number) {
    if (level === 0) {
        return CONTENT_WIDTH
    }
    return CONTENT_WIDTH - 16 * 2 * level
}

function getImageWidth(level: number) {
    if (level === 0) {
        return (CONTENT_WIDTH - 4) / 2
    }
    return (CONTENT_WIDTH - 4 - 16 * 2 * level) / 2
}

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
                tw="border-t border-idol-tertiary flex-grow"
                style={{
                    borderTopStyle: dash ? 'dashed' : 'solid',
                }}
            />
            {text && (
                <span tw="mx-2 text-idol-tertiary" lang="zh-CN">
                    {text}
                </span>
            )}
            {text && (
                <div
                    tw="border-t border-idol-tertiary flex-grow"
                    style={{
                        borderTopStyle: dash ? 'dashed' : 'solid',
                    }}
                />
            )}
        </div>
    )
}

function MediaGroup({ media: _media, level }: { media: Exclude<Article['media'], null>; level: number }) {
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
                <div key={i} tw="flex overflow-hidden" style={{ flexBasis: `${getImageWidth(level)}px` }}>
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
 * @return {number} 估算的文本高度
 */
function estimateTextLinesHeight(text: string, fontSize: number, containerWidth: number) {
    text = text.trim()
    if (!text) {
        return 0
    }
    // 1. 处理硬换行符 - 分割文本成行
    const paragraphs = text.split('\n')

    // 2. 估算每个字符的平均宽度 - 一个粗略的估计
    // 英文字符约为字体大小的0.6倍，中日韩字符约为字体大小的1.0倍
    const avgCharWidthLatin = fontSize * 0.6 // 拉丁字符(英文、数字等)
    const avgCharWidthCJK = fontSize * 0.95 // 中日韩字符、magic number

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

function estimateImagesHeight(media: Exclude<Article['media'], null>, level: number = 0) {
    if (!media || media.length === 0) {
        return 0
    }
    const imageCount = media.filter((m) => m.type === 'photo' || m.type === 'video_thumbnail').length
    return (
        ((imageCount % 2) * getContentWidth(level) + Math.floor(imageCount / 2) * getImageWidth(level)) * (9 / 16) +
        (Math.ceil(imageCount / 2) - 1) * 4
    )
}

function ArticleContent({ article, level = 0 }: { article: Article; level: number }) {
    function Content() {
        return (
            <div
                tw={clsx('flex flex-col', {
                    'pb-6': level === 0 && isConversationType(article.type),
                })}
                style={{
                    rowGap: '4px',
                    width: `${level === 0 ? CONTENT_WIDTH : CONTENT_WIDTH - 2 * 16 * level}px`,
                }}
            >
                {level === 0 && <Metaline article={article} />}
                {level !== 0 && (
                    <div
                        tw="flex flex-row"
                        style={{
                            columnGap: '4px',
                        }}
                    >
                        {article.u_avatar ? (
                            <img tw="w-8 h-8 rounded-full flex-none" src={article.u_avatar} alt={article.username} />
                        ) : (
                            <div tw="w-8 h-8 rounded-full bg-gray-200 flex-none" />
                        )}
                        <div tw="flex flex-shrink">
                            <Metaline article={article} />
                        </div>
                    </div>
                )}
                {article.translation && (
                    <pre
                        tw="w-full my-0 text-base leading-tight"
                        style={{
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {parseTranslationContent(article)}
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
                        {parseRawContent(article)}
                    </pre>
                )}
                {((article.media && article.media.length > 0) || article.extra) && <Divider dash />}
                {article.media && article.media.length > 0 && <MediaGroup media={article.media} level={level} />}
                {article.ref && typeof article.ref === 'object' && (
                    <ArticleContent article={article.ref} level={level + 1} />
                )}
            </div>
        )
    }
    return level === 0 ? (
        <div
            tw="flex flex-row"
            style={{
                columnGap: '12px',
            }}
        >
            <div tw="flex flex-col items-center" style={{ rowGap: '6px' }}>
                {article.u_avatar ? (
                    <img tw="w-16 h-16 rounded-full flex-none" src={article.u_avatar} alt={article.username} />
                ) : (
                    <div tw="w-16 h-16 rounded-full bg-gray-200 flex-none" />
                )}
                {isConversationType(article.type) && <div tw="flex-grow bg-idol-tertiary w-[2px] rounded-full"></div>}
            </div>
            <Content />
        </div>
    ) : (
        <div tw="flex border border-idol-tertiary rounded-lg p-4 shadow-md">
            <Content />
        </div>
    )
}

function isConversationType(type: Article['type']): boolean {
    return ([X.ArticleTypeEnum.CONVERSATION] as Array<Article['type']>).includes(type)
}

function flatArticle(article: Article): Array<Article> {
    const articles: Array<Article> = []
    let currentArticle: Article | null = article
    while (currentArticle && isConversationType(currentArticle.type)) {
        articles.push({
            ...currentArticle,
            ref: null,
        })
        if (currentArticle.ref && typeof currentArticle.ref === 'object') {
            currentArticle = currentArticle.ref
        } else {
            currentArticle = null
        }
    }
    currentArticle && articles.push(currentArticle)
    return articles
}

function BaseCard({ article, paddingHeight }: { article: Article; paddingHeight: number }) {
    const flattedArticle = flatArticle(article)
    return (
        <div
            tw="p-4 pb-5 bg-white rounded-2xl shadow-sm h-full w-full flex flex-col relative"
            style={{
                rowGap: '6px',
            }}
        >
            <img
                tw="absolute right-4 top-4 opacity-20"
                style={{
                    transform: 'rotate(6deg)',
                }}
                width={32}
                height={32 * SVG[article.platform].ratio}
                src={SVG[article.platform].icon}
            />
            {flattedArticle.map((item, index) => (
                <ArticleContent key={index} article={item} level={0} />
            ))}
            {/* {paddingHeight > 0 && (
                <div tw="flex justify-center items-center opacity-20">
                    <img src={KOZUE} width={paddingHeight}/>
                </div>
            )} */}
        </div>
    )
}

function estimatedArticleHeight(article: Article, level: number = 0): number {
    const basePadding = 16 * 2
    const articleHeightArray = [
        estimateTextLinesHeight(
            `${article.username} @${article.u_id} · ${dayjs.unix(article.created_at).format('YY年MM月DD日 HH:mmZ')} ${platformArticleMapToActionText[article.platform][article.type]}`,
            BASE_FONT_SIZE,
            getContentWidth(level) - (level === 0 ? 0 : 32), // maybe subtract the avatar width
        ), // metaline
        estimateTextLinesHeight(parseTranslationContent(article) ?? '', BASE_FONT_SIZE, getContentWidth(level)), // translation
        article.translation ? 12 : 0, // translation divider
        estimateTextLinesHeight(parseRawContent(article) ?? '', BASE_FONT_SIZE, getContentWidth(level)), // content
        article.has_media ? 12 : 0, // media or extra divider
        estimateImagesHeight(article.media ?? [], level), // media
        article.ref && typeof article.ref === 'object'
            ? estimatedArticleHeight(article.ref, level + 1) + basePadding * (level + 1)
            : 0, // ref
    ]
    return _(articleHeightArray)
        .filter((item) => item > 0)
        .flatMap((item) => [item, 4])
        .dropRight(1)
        .reduce((a, b) => a + b, 0)
}

function articleParser(article: Article): {
    component: JSX.Element
    height: number
} {
    let flattedArticleHeightArray = flatArticle(article).map((item) => estimatedArticleHeight(item, 0))
    let estimatedHeight = [
        16, // padding top
        _(flattedArticleHeightArray)
            .filter((item) => item > 0)
            .flatMap((item) => [item, 24 + 6])
            .dropRight(1) // content
            .reduce((a, b) => a + b, 0),
        20, // padding bottom
    ]
        .flat()
        .reduce((a, b) => a + b, 0)

    let paddingHeight = 0
    if (estimatedHeight / CARD_WIDTH < 1 / 3) {
        paddingHeight = (CARD_WIDTH * 1) / 3 - estimatedHeight
    }
    return {
        component: <BaseCard article={article} paddingHeight={paddingHeight} />,
        height: estimatedHeight + paddingHeight,
    }
}

export { estimateImagesHeight, estimateTextLinesHeight, BaseCard, articleParser }
export { BASE_FONT_SIZE, CARD_WIDTH, CONTENT_WIDTH }
