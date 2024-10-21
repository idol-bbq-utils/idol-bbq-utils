import dayjs from 'dayjs'

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

export { delay, formatTime }
