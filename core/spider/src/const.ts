import { Instagram, X } from './spiders'
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
        [Instagram.ArticleTypeEnum.STORIES]: '发布故事',
        [Instagram.ArticleTypeEnum.REEL]: '发布视频',
    },
}

const platformNameMap: Record<Platform, string> = {
    [Platform.X]: 'X',
    [Platform.Instagram]: 'Instagram',
}

export { platformArticleMapToActionText, platformNameMap }
