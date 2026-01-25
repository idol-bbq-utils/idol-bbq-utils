import { test, expect, describe } from 'bun:test'
import { AppConfig } from '../src/index'
import type { AppConfigType } from '../src/types'
import { SendTargetPlatformEnum } from '@idol-bbq-utils/sender'
import { Platform } from '@idol-bbq-utils/spider/types'
import { UserAgent } from '@idol-bbq-utils/spider'
import { TranslatorProvider } from '@idol-bbq-utils/translator'

describe('AppConfig - Configuration Merging', () => {
    describe('Crawler Configuration Merging', () => {
        test('should merge global and task-level crawler config', () => {
            const config: AppConfigType = {
                config: {
                    cfg_crawler: {
                        cron: '0 * * * *',
                        cookie_string: 'global-cookie',
                        interval_time: {
                            min: 1000,
                            max: 5000,
                        },
                    },
                },
                crawlers: [
                    {
                        name: 'test-crawler',
                        websites: ['https://x.com/user1'],
                        task_type: 'article',
                        config: {
                            cfg_crawler: {
                                cron: '*/10 * * * *',
                                user_agent: 'custom-agent',
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            expect(crawlers).toHaveLength(1)
            const crawler = crawlers[0]!
            expect(crawler.config).toBeDefined()
            expect(crawler.config!.cron).toBe('*/10 * * * *')
            expect(crawler.config!.cookie_string).toBe('global-cookie')
            expect(crawler.config!.user_agent).toBe('custom-agent')
            expect(crawler.config!.interval_time?.min).toBe(1000)
            expect(crawler.config!.interval_time?.max).toBe(5000)
        })

        test('should deeply merge nested crawler config objects', () => {
            const config: AppConfigType = {
                config: {
                    cfg_crawler: {
                        interval_time: {
                            min: 1000,
                            max: 5000,
                        },
                    },
                },
                crawlers: [
                    {
                        websites: ['https://x.com/user1'],
                        config: {
                            cfg_crawler: {
                                interval_time: {
                                    max: 10000,
                                } as any,
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            const crawler = crawlers[0]!
            expect(crawler.config).toBeDefined()
            expect(crawler.config!.interval_time?.min).toBe(1000)
            expect(crawler.config!.interval_time?.max).toBe(10000)
        })

        test('should use global config when disable_overwrite is set in global', () => {
            const config: AppConfigType = {
                config: {
                    cfg_crawler: {
                        cron: '0 * * * *',
                        cookie_string: 'global-cookie',
                        disable_overwrite: true,
                    },
                },
                crawlers: [
                    {
                        websites: ['https://x.com/user1'],
                        config: {
                            cfg_crawler: {
                                cron: '*/10 * * * *',
                                user_agent: 'custom-agent',
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            const crawler = crawlers[0]!
            expect(crawler.config).toBeDefined()
            expect(crawler.config!.cron).toBe('0 * * * *')
            expect(crawler.config!.user_agent).toBe(UserAgent.CHROME)
        })

        test('should use task config when disable_overwrite is set in task', () => {
            const config: AppConfigType = {
                config: {
                    cfg_crawler: {
                        cron: '0 * * * *',
                        cookie_string: 'global-cookie',
                    },
                },
                crawlers: [
                    {
                        websites: ['https://x.com/user1'],
                        config: {
                            cfg_crawler: {
                                cron: '*/10 * * * *',
                                user_agent: 'custom-agent',
                                disable_overwrite: true,
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            const crawler = crawlers[0]!
            expect(crawler.config).toBeDefined()
            expect(crawler.config!.cron).toBe('*/10 * * * *')
            expect(crawler.config!.cookie_string).toBe('global-cookie')
        })

        test('should apply default crawler config', () => {
            const config: AppConfigType = {
                crawlers: [
                    {
                        websites: ['https://x.com/user1'],
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            const crawler = crawlers[0]!
            expect(crawler.config).toBeDefined()
            expect(crawler.config!.cron).toBe(AppConfig.DEFAULT_CRAWLER_CONFIG.cron!)
            expect(crawler.config!.interval_time).toEqual(AppConfig.DEFAULT_CRAWLER_CONFIG.interval_time!)
            expect(crawler.config!.user_agent).toBe(AppConfig.DEFAULT_CRAWLER_CONFIG.user_agent!)
        })

        test('should sanitize websites correctly', () => {
            const config: AppConfigType = {
                crawlers: [
                    {
                        origin: 'https://x.com',
                        paths: ['/user1', '/user2'],
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            const crawler = crawlers[0]!
            expect(crawler.websites).toContain('https://x.com/user1')
            expect(crawler.websites).toContain('https://x.com/user2')
        })
    })

    describe('Translator Configuration Merging', () => {
        test('should merge global and task-level translator config', () => {
            const config: AppConfigType = {
                config: {
                    cfg_crawler: {
                        translator: {
                            provider: TranslatorProvider.Google,
                            api_key: 'global-api-key',
                            config: {
                                prompt: 'Translate the following text to Chinese',
                                model_id: 'gemini-2.0-flash',
                            },
                        },
                    },
                },
                crawlers: [
                    {
                        websites: ['https://x.com/user1'],
                        config: {
                            cfg_crawler: {
                                translator: {
                                    provider: TranslatorProvider.Google,
                                    api_key: 'global-api-key',
                                    config: {
                                        model_id: 'gemini-1.5-pro',
                                    },
                                },
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            const crawler = crawlers[0]!
            expect(crawler.config).toBeDefined()
            expect(crawler.config!.translator).toBeDefined()
            expect(crawler.config!.translator!.provider).toBe(TranslatorProvider.Google)
            expect(crawler.config!.translator!.api_key).toBe('global-api-key')
            expect(crawler.config!.translator!.config?.prompt).toBe('Translate the following text to Chinese')
            expect(crawler.config!.translator!.config?.model_id).toBe('gemini-1.5-pro')
        })

        test('should deeply merge translator config fields', () => {
            const config: AppConfigType = {
                config: {
                    cfg_crawler: {
                        translator: {
                            provider: TranslatorProvider.BigModel,
                            api_key: 'global-key',
                            config: {
                                prompt: 'global-prompt',
                                base_url: 'https://api.global.com',
                                name: 'global-translator',
                            },
                        },
                    },
                },
                crawlers: [
                    {
                        websites: ['https://x.com/user1'],
                        config: {
                            cfg_crawler: {
                                translator: {
                                    provider: TranslatorProvider.BigModel,
                                    api_key: 'global-key',
                                    config: {
                                        prompt: 'task-prompt',
                                        model_id: 'glm-4-plus',
                                    },
                                },
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            const crawler = crawlers[0]!
            expect(crawler.config).toBeDefined()
            expect(crawler.config!.translator).toBeDefined()
            expect(crawler.config!.translator!.config?.prompt).toBe('task-prompt')
            expect(crawler.config!.translator!.config?.base_url).toBe('https://api.global.com')
            expect(crawler.config!.translator!.config?.name).toBe('global-translator')
            expect(crawler.config!.translator!.config?.model_id).toBe('glm-4-plus')
        })

        test('should replace translator when using different provider', () => {
            const config: AppConfigType = {
                config: {
                    cfg_crawler: {
                        translator: {
                            provider: TranslatorProvider.Google,
                            api_key: 'google-key',
                            config: {
                                model_id: 'gemini-2.0-flash',
                            },
                        },
                    },
                },
                crawlers: [
                    {
                        websites: ['https://x.com/user1'],
                        config: {
                            cfg_crawler: {
                                translator: {
                                    provider: TranslatorProvider.BigModel,
                                    api_key: 'bigmodel-key',
                                    config: {
                                        model_id: 'glm-4-flash',
                                    },
                                },
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            const crawler = crawlers[0]!
            expect(crawler.config).toBeDefined()
            expect(crawler.config!.translator).toBeDefined()
            expect(crawler.config!.translator!.provider).toBe(TranslatorProvider.BigModel)
            expect(crawler.config!.translator!.api_key).toBe('bigmodel-key')
            expect(crawler.config!.translator!.config?.model_id).toBe('glm-4-flash')
        })

        test('should handle translator with extended_payload', () => {
            const config: AppConfigType = {
                config: {
                    cfg_crawler: {
                        translator: {
                            provider: TranslatorProvider.OpenAI,
                            api_key: 'openai-key',
                            config: {
                                extended_payload: {
                                    temperature: 0.7,
                                    max_tokens: 1000,
                                },
                            },
                        },
                    },
                },
                crawlers: [
                    {
                        websites: ['https://x.com/user1'],
                        config: {
                            cfg_crawler: {
                                translator: {
                                    provider: TranslatorProvider.OpenAI,
                                    api_key: 'openai-key',
                                    config: {
                                        extended_payload: {
                                            max_tokens: 2000,
                                            top_p: 0.9,
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            const crawler = crawlers[0]!
            expect(crawler.config).toBeDefined()
            expect(crawler.config!.translator).toBeDefined()
            expect(crawler.config!.translator!.config?.extended_payload).toBeDefined()
            expect(crawler.config!.translator!.config!.extended_payload!.temperature).toBe(0.7)
            expect(crawler.config!.translator!.config!.extended_payload!.max_tokens).toBe(2000)
            expect(crawler.config!.translator!.config!.extended_payload!.top_p).toBe(0.9)
        })

        test('should handle missing translator in task config', () => {
            const config: AppConfigType = {
                config: {
                    cfg_crawler: {
                        translator: {
                            provider: TranslatorProvider.QwenMT,
                            api_key: 'qwen-key',
                            config: {
                                prompt: 'global-prompt',
                            },
                        },
                    },
                },
                crawlers: [
                    {
                        websites: ['https://x.com/user1'],
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            const crawler = crawlers[0]!
            expect(crawler.config).toBeDefined()
            expect(crawler.config!.translator).toBeDefined()
            expect(crawler.config!.translator!.provider).toBe(TranslatorProvider.QwenMT)
            expect(crawler.config!.translator!.api_key).toBe('qwen-key')
            expect(crawler.config!.translator!.config?.prompt).toBe('global-prompt')
        })

        test('should handle task-only translator config', () => {
            const config: AppConfigType = {
                crawlers: [
                    {
                        websites: ['https://x.com/user1'],
                        config: {
                            cfg_crawler: {
                                translator: {
                                    provider: TranslatorProvider.ByteDance,
                                    api_key: 'bytedance-key',
                                    config: {
                                        model_id: 'doubao-pro-128k',
                                    },
                                },
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            const crawler = crawlers[0]!
            expect(crawler.config).toBeDefined()
            expect(crawler.config!.translator).toBeDefined()
            expect(crawler.config!.translator!.provider).toBe(TranslatorProvider.ByteDance)
            expect(crawler.config!.translator!.api_key).toBe('bytedance-key')
            expect(crawler.config!.translator!.config?.model_id).toBe('doubao-pro-128k')
        })
    })

    describe('Sender Configuration Merging', () => {
        test('should merge global and task-level sender config', () => {
            const config: AppConfigType = {
                config: {
                    cfg_sender: {
                        cron: '0 * * * *',
                        render_type: 'text',
                    },
                },
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                        },
                    },
                ],
                senders: [
                    {
                        websites: ['https://x.com/user1'],
                        targets: ['tg-1'],
                        config: {
                            cfg_sender: {
                                cron: '*/15 * * * *',
                                media: {} as any,
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const senders = appConfig.getTaskSenders()

            expect(senders).toHaveLength(1)
            const sender = senders[0]!
            expect(sender.config).toBeDefined()
            expect(sender.config!.cfg_sender).toBeDefined()
            expect(sender.config!.cfg_sender!.cron).toBe('*/15 * * * *')
            expect(sender.config!.cfg_sender!.render_type).toBe('text')
        })

        test('should use global sender config when disable_overwrite is set', () => {
            const config: AppConfigType = {
                config: {
                    cfg_sender: {
                        cron: '0 * * * *',
                        render_type: 'text',
                        disable_overwrite: true,
                    },
                },
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                        },
                    },
                ],
                senders: [
                    {
                        websites: ['https://x.com/user1'],
                        targets: ['tg-1'],
                        config: {
                            cfg_sender: {
                                cron: '*/15 * * * *',
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const senders = appConfig.getTaskSenders()

            const sender = senders[0]!
            expect(sender.config).toBeDefined()
            expect(sender.config!.cfg_sender).toBeDefined()
            expect(sender.config!.cfg_sender!.cron).toBe('0 * * * *')
        })
    })

    describe('SendTarget Configuration Merging (4-level)', () => {
        test('should merge 4 levels: default -> global -> target -> sender unified -> runtime', () => {
            const config: AppConfigType = {
                config: {
                    cfg_send_target: {
                        block_until: '1h',
                        accept_keywords: ['global-keyword'],
                    },
                },
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                            block_until: '30m',
                            filter_keywords: ['target-filter'],
                        },
                    },
                ],
                senders: [
                    {
                        websites: ['https://x.com/user1'],
                        targets: [
                            {
                                id: 'tg-1',
                                cfg_send_target: {
                                    block_until: '10m',
                                },
                            },
                        ],
                        config: {
                            cfg_send_target: {
                                replace_regex: 'test',
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const senders = appConfig.getTaskSenders()

            const sender = senders[0]!
            expect(sender.targets).toHaveLength(1)
            const target = sender.targets[0]!

            expect(target.config.block_until).toBe('10m')
            expect(target.config.accept_keywords).toEqual(['global-keyword'])
            expect(target.config.filter_keywords).toEqual(['target-filter'])
            expect(target.config.replace_regex).toBe('test')
        })

        test('should stop merging when disable_overwrite is set at any level', () => {
            const config: AppConfigType = {
                config: {
                    cfg_send_target: {
                        block_until: '1h',
                    },
                },
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                            block_until: '30m',
                            disable_overwrite: true,
                        },
                    },
                ],
                senders: [
                    {
                        websites: ['https://x.com/user1'],
                        targets: [
                            {
                                id: 'tg-1',
                                cfg_send_target: {
                                    block_until: '10m',
                                },
                            },
                        ],
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const senders = appConfig.getTaskSenders()

            const sender = senders[0]!
            const target = sender.targets[0]!
            expect(target.config.block_until).toBe('30m')
        })

        test('should apply default send target config', () => {
            const config: AppConfigType = {
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const targets = appConfig.getSendTargets()

            const target = targets[0]!
            expect(target.config.block_until).toBe(AppConfig.DEFAULT_SEND_TARGET_CONFIG.block_until!)
        })

        test('should throw error for duplicate send target IDs', () => {
            const config: AppConfigType = {
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                        },
                    },
                    {
                        platform: SendTargetPlatformEnum.QQ,
                        id: 'tg-1',
                        config: {
                            url: 'http://localhost',
                            group_id: '123',
                            token: 'test',
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            expect(() => appConfig.resolveConfig()).toThrow('Duplicate send target key: tg-1')
        })

        test('should throw error for non-existent send target reference', () => {
            const config: AppConfigType = {
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                        },
                    },
                ],
                senders: [
                    {
                        websites: ['https://x.com/user1'],
                        targets: ['non-existent-target'],
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            expect(() => appConfig.resolveConfig()).toThrow('Send target not found: non-existent-target')
        })
    })

    describe('Complex Nested Merging', () => {
        test('should deeply merge complex nested objects', () => {
            const config: AppConfigType = {
                config: {
                    cfg_send_target: {
                        block_rules: [
                            {
                                platform: Platform.X,
                                task_type: 'article',
                                sub_type: ['retweet'],
                                block_type: 'once',
                                block_until: '6h',
                            },
                        ],
                    },
                },
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                            accept_keywords: ['keyword1', 'keyword2'],
                        },
                    },
                ],
                senders: [
                    {
                        websites: ['https://x.com/user1'],
                        targets: ['tg-1'],
                        config: {
                            cfg_send_target: {
                                filter_keywords: ['filter1'],
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const senders = appConfig.getTaskSenders()

            const sender = senders[0]!
            const target = sender.targets[0]!
            expect(target.config.block_rules).toBeDefined()
            expect(target.config.block_rules!.length).toBe(1)
            expect(target.config.accept_keywords).toEqual(['keyword1', 'keyword2'])
            expect(target.config.filter_keywords).toEqual(['filter1'])
        })

        test('should handle empty config objects gracefully', () => {
            const config: AppConfigType = {
                crawlers: [
                    {
                        websites: ['https://x.com/user1'],
                    },
                ],
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                        },
                    },
                ],
                senders: [
                    {
                        websites: ['https://x.com/user1'],
                        targets: ['tg-1'],
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            expect(() => appConfig.resolveConfig()).not.toThrow()

            const crawlers = appConfig.getTaskCrawlers()
            const senders = appConfig.getTaskSenders()

            expect(crawlers).toHaveLength(1)
            expect(senders).toHaveLength(1)
        })
    })

    describe('Getter Methods', () => {
        test('should return task crawlers', () => {
            const config: AppConfigType = {
                crawlers: [{ websites: ['https://x.com/user1'] }, { websites: ['https://x.com/user2'] }],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            expect(crawlers).toHaveLength(2)
        })

        test('should return task senders', () => {
            const config: AppConfigType = {
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                        },
                    },
                ],
                senders: [
                    { websites: ['https://x.com/user1'], targets: ['tg-1'] },
                    { websites: ['https://x.com/user2'], targets: ['tg-1'] },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const senders = appConfig.getTaskSenders()

            expect(senders).toHaveLength(2)
        })

        test('should return send targets', () => {
            const config: AppConfigType = {
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                        },
                    },
                    {
                        platform: SendTargetPlatformEnum.QQ,
                        id: 'qq-1',
                        config: {
                            url: 'http://localhost',
                            group_id: '123',
                            token: 'test',
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const targets = appConfig.getSendTargets()

            expect(targets).toHaveLength(2)
        })

        test('should return raw config', () => {
            const config: AppConfigType = {
                crawlers: [{ websites: ['https://x.com/user1'] }],
            }

            const appConfig = new AppConfig(config)
            const rawConfig = appConfig.getRawConfig()

            expect(rawConfig).toEqual(config)
        })
    })

    describe('Priority Levels Verification', () => {
        test('crawler config priority: task > global > default', () => {
            const config: AppConfigType = {
                config: {
                    cfg_crawler: {
                        cron: 'global-cron',
                    },
                },
                crawlers: [
                    {
                        websites: ['https://x.com/user1'],
                        config: {
                            cfg_crawler: {
                                cron: 'task-cron',
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const crawlers = appConfig.getTaskCrawlers()

            const crawler = crawlers[0]!
            expect(crawler.config).toBeDefined()
            expect(crawler.config!.cron).toBe('task-cron')
        })

        test('sender config priority: task > global > default', () => {
            const config: AppConfigType = {
                config: {
                    cfg_sender: {
                        cron: 'global-cron',
                    },
                },
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                        },
                    },
                ],
                senders: [
                    {
                        websites: ['https://x.com/user1'],
                        targets: ['tg-1'],
                        config: {
                            cfg_sender: {
                                cron: 'task-cron',
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const senders = appConfig.getTaskSenders()

            const sender = senders[0]!
            expect(sender.config).toBeDefined()
            expect(sender.config!.cfg_sender).toBeDefined()
            expect(sender.config!.cfg_sender!.cron).toBe('task-cron')
        })

        test('send target config priority: runtime > sender unified > target > global > default', () => {
            const config: AppConfigType = {
                config: {
                    cfg_send_target: {
                        block_until: 'global',
                    },
                },
                send_targets: [
                    {
                        platform: SendTargetPlatformEnum.Telegram,
                        id: 'tg-1',
                        config: {
                            token: 'test-token',
                            chat_id: 'test-chat',
                            block_until: 'target',
                        },
                    },
                ],
                senders: [
                    {
                        websites: ['https://x.com/user1'],
                        targets: [
                            {
                                id: 'tg-1',
                                cfg_send_target: {
                                    block_until: 'runtime',
                                },
                            },
                        ],
                        config: {
                            cfg_send_target: {
                                replace_regex: 'sender-unified',
                            },
                        },
                    },
                ],
            }

            const appConfig = new AppConfig(config)
            appConfig.resolveConfig()
            const senders = appConfig.getTaskSenders()

            const sender = senders[0]!
            const target = sender.targets[0]!
            expect(target.config.block_until).toBe('runtime')
        })
    })
})
