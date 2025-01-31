function isStringArrayArray(arr: string[] | string[][]): arr is string[][] {
    return arr.length > 0 && Array.isArray(arr[0])
}

export { isStringArrayArray }
