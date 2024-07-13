import { ArticleTypeEnum, ITweetArticle } from '@idol-bbq-utils/spider/lib/websites/x/types/types'
import { prisma, Prisma } from './client'
import { log } from '@/config'

export type ITweetDB = Prisma.x_tweetGetPayload<{}>

async function saveTweet(tweet: ITweetArticle) {
    try {
        let res
        if (tweet.type === ArticleTypeEnum.REF && tweet.ref) {
            const ref_article = tweet.ref
            // make sure the ref is saved first
            const ref = await checkExistAndSave(ref_article)
            // save the tweet
            res = await save(tweet, ref.id)
            return res
        }
        if (tweet.type === ArticleTypeEnum.FORWARD && tweet.forward_by) {
            // we save treat the forwarded tweet as the normal tweet
            tweet['type'] = ArticleTypeEnum.TWEET
            const ref = await checkExistAndSave(tweet)

            const res = await saveForward(tweet.forward_by, ref.id)
            if (!res) {
                return
            }
            return {
                ...ref,
                forward_by: {
                    username: res.username,
                    ref: res.ref,
                },
            }
        }
        res = await save(tweet)
        return res
    } catch (e) {
        log.error('saveTweet failed', e)
        return undefined
    }
}

async function checkExist(tweet: ITweetArticle) {
    return await prisma.x_tweet.findUnique({
        where: {
            u_id_timestamp: {
                u_id: tweet.u_id,
                timestamp: tweet.timestamp,
            },
        },
    })
}

async function checkExistAndSave(tweet: ITweetArticle, ref?: number) {
    let exist_one = await checkExist(tweet)
    if (exist_one) {
        return exist_one
    }
    const item = await prisma.x_tweet.create({
        data: {
            u_id: tweet.u_id,
            username: tweet.username,
            timestamp: tweet.timestamp,
            text: tweet.text,
            type: tweet.type,
            tweet_link: tweet.tweet_link,
            has_media: !!tweet.has_media,
            ref: ref,
        },
    })
    return item
}

async function save(tweet: ITweetArticle, ref?: number) {
    let exist_one = await checkExist(tweet)
    if (exist_one) {
        return
    }
    const item = await prisma.x_tweet.create({
        data: {
            u_id: tweet.u_id,
            username: tweet.username,
            timestamp: tweet.timestamp,
            text: tweet.text,
            type: tweet.type,
            tweet_link: tweet.tweet_link,
            has_media: tweet.has_media,
            ref: ref,
        },
    })
    return item
}

async function saveForward(username: string, ref: number) {
    const exist_one = await prisma.x_forward.findUnique({
        where: {
            ref_username: {
                ref,
                username,
            },
        },
    })
    if (exist_one) {
        return
    }

    const item = await prisma.x_forward.create({
        data: {
            ref,
            username,
        },
    })

    return item
}

async function getTweets(ids: number[]) {
    return await prisma.x_tweet.findMany({
        where: {
            id: {
                in: ids,
            },
        },
    })
}

async function saveFollows(username: string, u_id: string, follows: number, timestamp: number) {
    return await prisma.x_follows.create({
        data: {
            username,
            u_id,
            follows,
            timestamp: timestamp,
        },
    })
}

async function getPreviousNFollows(u_id: string, count: number = 5) {
    return await prisma.x_follows.findMany({
        where: {
            u_id: u_id,
        },
        orderBy: {
            timestamp: 'desc',
        },
        take: count,
    })
}

async function saveReply(replies: ITweetArticle[]) {
    let index = replies.length - 1
    // check the last one wether has been saved
    let exist_one = await checkExist(replies[index])
    if (exist_one) {
        return
    }

    let previous
    let res = []
    for (index = 0; index < replies.length; index = index + 1) {
        let cur_reply = replies[index]
        previous = await checkExistAndSave(cur_reply, previous?.id ?? undefined)
        res.push(previous)
    }
    return res
}

async function getTranslation(ref: number) {
    return await prisma.x_translation.findUnique({
        where: {
            ref,
        },
    })
}

async function saveTranslation(ref: number, text: string) {
    let exist_one = await getTranslation(ref)
    if (exist_one) {
        return exist_one
    }
    return await prisma.x_translation.create({
        data: {
            ref,
            text,
        },
    })
}

export { saveTweet, saveFollows, saveReply, saveTranslation, getTranslation, getTweets, getPreviousNFollows }
