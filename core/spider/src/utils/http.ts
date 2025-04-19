namespace HTTPClient {
    export async function download_webpage(url: string, headers: Record<string, string> = {}): Promise<Response> {
        return fetch(url, {
            method: 'GET',
            headers: {
                'user-agent': UserAgent.CHROME,
                ...headers,
            },
        })
    }
}

const UserAgent = {
    CHROME: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    FIREFOX: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0',
    SAFARI: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15',
}

export { HTTPClient, UserAgent }
