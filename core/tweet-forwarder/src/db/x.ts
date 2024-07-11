import { ArticleTypeEnum, ITweetArticle } from '@idol-bbq-utils/spider/lib/websites/x/types/types'
import { prisma } from './client'
import { log } from '@/config'

async function saveTweet(tweet: ITweetArticle) {
    try {
        let res
        if (tweet.type === ArticleTypeEnum.REF && tweet.ref) {
            const ref_article = tweet.ref
            // make sure the ref is saved first
            const ref_id = await checkExistAndSave(ref_article)
            // save the tweet
            res = await save(tweet, ref_id)
        } else {
            res = await save(tweet)
        }
        return res?.id
    } catch (e) {
        log.error('saveTweet failed', e)
        return undefined
    }
}

async function checkExist(tweet: ITweetArticle) {
    return await prisma.x_tweets.findUnique({
        where: {
            u_id: tweet.u_id,
            timestamp: tweet.timestamp,
        },
    })
}

async function checkExistAndSave(tweet: ITweetArticle, ref?: number) {
    let exist_one = await checkExist(tweet)
    if (exist_one) {
        return exist_one.id
    }
    const item = await prisma.x_tweets.create({
        data: {
            u_id: tweet.u_id,
            username: tweet.username,
            timestamp: tweet.timestamp,
            text: tweet.text,
            type: tweet.type,
            tweet_link: tweet.tweet_link,
            has_media: !!tweet.has_media,
            forward_by: tweet.forward_by,
            ref: ref,
        },
    })
    return item.id
}

async function save(tweet: ITweetArticle, ref?: number) {
    let exist_one = await checkExist(tweet)
    if (exist_one) {
        return
    }
    const item = await prisma.x_tweets.create({
        data: {
            u_id: tweet.u_id,
            username: tweet.username,
            timestamp: tweet.timestamp,
            text: tweet.text,
            type: tweet.type,
            tweet_link: tweet.tweet_link,
            has_media: tweet.has_media,
            forward_by: tweet.forward_by,
            ref: ref,
        },
    })
    return item
}

async function getTweets(ids: number[]) {
    return await prisma.x_tweets.findMany({
        where: {
            id: {
                in: ids,
            },
        },
    })
}

async function getTweetById(id: number) {
    return await prisma.x_tweets.findUnique({
        where: {
            id,
        },
    })
}

export { saveTweet, getTweets, getTweetById }
