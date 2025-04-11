function isStringArrayArray(arr: string[] | string[][]): arr is Array<[string, string]> {
    return arr.length > 0 && Array.isArray(arr[0])
}

export { isStringArrayArray }
