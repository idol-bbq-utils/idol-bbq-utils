import { createRequire } from 'module'
import { defineConfig, type DefaultTheme } from 'vitepress'

const require = createRequire(import.meta.url)
// const pkg = require('vitepress/package.json')

export const zh = defineConfig({
    lang: 'zh-Hans',
    description: 'The tool collections of idol-bbq-utils project',

    themeConfig: {
        nav: nav(),

        sidebar: {
            '/guide/': { base: '/guide/', items: sidebarGuide() },
            '/examples/': { base: '/examples/', items: sidebarExamples() },
            '/core/': { base: '/core/', items: sidebarCore() },
            '/app/': { base: '/app/', items: sidebarApp() },
        },

        editLink: {
            pattern: 'https://github.com/idol-bbq-utils/idol-bbq-utils/edit/main/docs/:path',
            text: '在 GitHub 上编辑此页面',
        },

        footer: {
            message: '基于 MIT 许可发布',
            copyright: `版权所有 © 2025-${new Date().getFullYear()} idol-bbq-utils`,
        },

        docFooter: {
            prev: '上一页',
            next: '下一页',
        },

        outline: {
            label: '页面导航',
        },

        lastUpdated: {
            text: '最后更新于',
            formatOptions: {
                dateStyle: 'short',
                timeStyle: 'medium',
            },
        },

        langMenuLabel: '多语言',
        returnToTopLabel: '回到顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '主题',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        skipToContentLabel: '跳转到内容',
    },
})

function nav(): DefaultTheme.NavItem[] {
    return [
        { text: '首页', link: '/' },
        {
            text: '指南',
            link: '/guide/getting-started',
            activeMatch: '/guide/',
        },
        {
            text: '示例参考',
            link: '/examples/',
            activeMatch: '/examples/',
        },
        // {
        //     text: pkg.version,
        //     items: [
        //         {
        //             text: '更新日志',
        //             link: 'https://github.com/vuejs/vitepress/blob/main/CHANGELOG.md',
        //         },
        //         {
        //             text: '参与贡献',
        //             link: 'https://github.com/vuejs/vitepress/blob/main/.github/contributing.md',
        //         },
        //     ],
        // },
    ]
}

function sidebarGuide(): DefaultTheme.SidebarItem[] {
    return [
        {
            text: '简介',
            collapsed: false,
            items: [
                { text: '什么是 idol-bbq-utils？', link: 'idol-bbq-utils' },
                { text: '快速开始', link: 'getting-started' },
                // { text: '路由', link: 'routing' },
                // { text: '部署', link: 'deploy' },
            ],
        },
        {
            text: '应用',
            collapsed: false,
            items: [{ text: '推文转发', link: 'tweet-forwarder' }],
        },
    ]
}

function sidebarExamples(): DefaultTheme.SidebarItem[] {
    return [
        {
            text: '示例参考',
            items: [
                { text: '站点配置', link: 'site-config' },
                { text: 'frontmatter 配置', link: 'frontmatter-config' },
                { text: '运行时 API', link: 'runtime-api' },
                { text: 'CLI', link: 'cli' },
                {
                    text: '默认主题',
                    base: '/reference/default-theme-',
                    items: [
                        { text: '概览', link: 'config' },
                        { text: '导航栏', link: 'nav' },
                        { text: '侧边栏', link: 'sidebar' },
                        { text: '主页', link: 'home-page' },
                        { text: '页脚', link: 'footer' },
                        { text: '布局', link: 'layout' },
                        { text: '徽章', link: 'badge' },
                        { text: '团队页', link: 'team-page' },
                        { text: '上下页链接', link: 'prev-next-links' },
                        { text: '编辑链接', link: 'edit-link' },
                        { text: '最后更新时间戳', link: 'last-updated' },
                        { text: '搜索', link: 'search' },
                        { text: 'Carbon Ads', link: 'carbon-ads' },
                    ],
                },
            ],
        },
    ]
}

function sidebarCore(): DefaultTheme.SidebarItem[] {
    return [
        {
            text: 'core 包',
            items: [
                {
                    text: 'spider 爬虫',
                    base: '/core/spider-',
                    items: [
                        { text: '基本介绍', link: 'basic' },
                        { text: '使用方法', link: 'usage' },
                    ],
                },
                { text: 'log 日志', link: 'log' },
                { text: 'utils 工具函数', link: 'utils' },
            ],
        },
    ]
}

function sidebarApp(): DefaultTheme.SidebarItem[] {
    return [
        {
            text: '推文转发',
            collapsed: false,
            items: [
                { text: '', link: 'site-config' },
                { text: 'frontmatter 配置', link: 'frontmatter-config' },
                { text: '运行时 API', link: 'runtime-api' },
                { text: 'CLI', link: 'cli' },
            ],
        },
    ]
}

export const search: DefaultTheme.AlgoliaSearchOptions['locales'] = {
    zh: {
        placeholder: '搜索文档',
        translations: {
            button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档',
            },
            modal: {
                searchBox: {
                    resetButtonTitle: '清除查询条件',
                    resetButtonAriaLabel: '清除查询条件',
                    cancelButtonText: '取消',
                    cancelButtonAriaLabel: '取消',
                },
                startScreen: {
                    recentSearchesTitle: '搜索历史',
                    noRecentSearchesText: '没有搜索历史',
                    saveRecentSearchButtonTitle: '保存至搜索历史',
                    removeRecentSearchButtonTitle: '从搜索历史中移除',
                    favoriteSearchesTitle: '收藏',
                    removeFavoriteSearchButtonTitle: '从收藏中移除',
                },
                errorScreen: {
                    titleText: '无法获取结果',
                    helpText: '你可能需要检查你的网络连接',
                },
                footer: {
                    selectText: '选择',
                    navigateText: '切换',
                    closeText: '关闭',
                    searchByText: '搜索提供者',
                },
                noResultsScreen: {
                    noResultsText: '无法找到相关结果',
                    suggestedQueryText: '你可以尝试查询',
                    reportMissingResultsText: '你认为该查询应该有结果？',
                    reportMissingResultsLinkText: '点击反馈',
                },
            },
        },
    },
}
