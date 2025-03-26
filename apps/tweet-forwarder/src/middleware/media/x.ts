const _VALID_URL = /https:\/\/pbs\.twimg\.com\/card_img\/\d+\/(?<id>[\w-]+)\?.*/

export function plainUrlConventor(url: string): {
    url: string
    filename: string
} | null {
    const match = url.match(_VALID_URL)
    if (!match) {
        return null
    }
    const id = match.groups?.id
    const url_obj = new URL(url)
    const filename = `${id}.${url_obj.searchParams.get('format')}`
    url_obj.searchParams.set('name', 'orig')
    return {
        url: url_obj.toString(),
        filename,
    }
}
