import { getSpider } from '../src'

test('X Spider', async () => {
    const url = 'https://x.com/hanamiya_nina'
    const spider = getSpider(url)
    if (spider) {
        let id = await new spider()._match_valid_url(url, spider)?.groups?.id
        expect(id).toBe('hanamiya_nina')
    }
})
