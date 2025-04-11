import dayjs, { type ManipulateType } from 'dayjs'

async function delay(time: number) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true)
        }, time)
    })
}

function formatTime(time: number) {
    return dayjs.unix(time).format('YYYY-MM-DD HH:mmZ')
}

function getSubtractTime(time: number, offset: string) {
    const match = offset.match(/(\d+)([a-zA-Z]+)/)
    if (match === null || !match[1] || !match[2]) throw new Error('Invalid offset format')
    return dayjs
        .unix(time)
        .subtract(parseInt(match[1], 10), match[2] as ManipulateType)
        .unix()
}

export { delay, formatTime, getSubtractTime }
