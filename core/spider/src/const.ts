import { Instagram, Tiktok, X, Youtube } from './spiders'
import { Platform } from './types'

/**
 * 初始化顺序问题，
 * 因为在初始化时，X 会引用文件中的Platform
 * 但此处由引用了X，而此时X并没有完成初始化。
 * 所以X里不能使用这里的参数
 */
const platformArticleMapToActionText: Record<Platform, Record<string, string>> = {
    [Platform.X]: {
        [X.ArticleTypeEnum.TWEET]: '发布推文',
        [X.ArticleTypeEnum.RETWEET]: '转发推文',
        [X.ArticleTypeEnum.CONVERSATION]: '回复推文',
        [X.ArticleTypeEnum.QUOTED]: '引用推文',
    },
    [Platform.Instagram]: {
        [Instagram.ArticleTypeEnum.POST]: '发布帖子',
        [Instagram.ArticleTypeEnum.STORY]: '发布故事',
        // [Instagram.ArticleTypeEnum.HIGHLIGHTS]: '发布highlights',
        // [Instagram.ArticleTypeEnum.REEL]: '发布视频',
    },
    [Platform.TikTok]: {
        [Tiktok.ArticleTypeEnum.POST]: '发布视频',
    },
    [Platform.YouTube]: {
        [Youtube.ArticleTypeEnum.POST]: '发布帖子',
        // [Youtube.ArticleTypeEnum.SHORTS]: '发布短视频',
    },
}

const platformNameMap: Record<Platform, string> = {
    [Platform.X]: 'X',
    [Platform.Instagram]: 'Instagram',
    [Platform.TikTok]: 'TikTok',
    [Platform.YouTube]: 'YouTube',
}

const platformPresetHeadersMap: Record<Platform, Record<string, string>> = {
    [Platform.X]: {},
    [Platform.Instagram]: {},
    [Platform.TikTok]: {
        'referer': 'https://www.tiktok.com/',
    },
    [Platform.YouTube]: {},
}

export { platformArticleMapToActionText, platformNameMap, platformPresetHeadersMap }
