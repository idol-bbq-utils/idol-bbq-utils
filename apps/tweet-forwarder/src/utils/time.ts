import dayjs, { ManipulateType } from 'dayjs'

async function delay(time: number) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true)
        }, time)
    })
}

function formatTime(time: number | string) {
    return dayjs(time).format('YYYY-MM-DD HH:mmZ')
}

function getSubtractTime(time: number, offset: string) {
    const match = offset.match(/(\d+)([a-zA-Z]+)/)
    if (!match) throw new Error('Invalid offset format')
    console.log(match)
    return dayjs
        .unix(time)
        .subtract(parseInt(match[1], 10), match[2] as ManipulateType)
        .unix()
}

export { delay, formatTime, getSubtractTime }
