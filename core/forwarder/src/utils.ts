import dayjs, { type ManipulateType } from 'dayjs'

export function formatTime(time: number): string {
    return dayjs.unix(time).format('YYYY-MM-DD HH:mmZ')
}

export function getSubtractTime(time: number, offset: string): number {
    const match = offset.match(/(\d+)([a-zA-Z]+)/)
    if (match === null || !match[1] || !match[2]) throw new Error('Invalid offset format')
    return dayjs
        .unix(time)
        .subtract(parseInt(match[1], 10), match[2] as ManipulateType)
        .unix()
}

export function isStringArrayArray(arr: string[] | string[][]): arr is Array<[string, string]> {
    return arr.length > 0 && Array.isArray(arr[0])
}
