import { afterEach, describe, expect, test } from 'bun:test'
import { QQForwarder } from '../src'

const servers: Bun.Server<unknown>[] = []

afterEach(async () => {
    for (const server of servers.splice(0)) {
        await server.stop(true)
    }
})

describe('QQForwarder', () => {
    test('prefers remote media URLs over local file URIs', async () => {
        let payload: any
        let authorization: string | null = null
        const server = Bun.serve({
            port: 0,
            async fetch(request) {
                authorization = request.headers.get('authorization')
                payload = await request.json()
                return Response.json({ status: 'ok', retcode: 0, data: { message_id: 1 } })
            },
        })
        servers.push(server)

        const forwarder = new QQForwarder(
            {
                url: `http://127.0.0.1:${server.port}`,
                group_id: '123456',
                token: 'onebot-token',
            },
            'qq-test',
        )

        await forwarder.send('hello', {
            media: [
                {
                    media_type: 'photo',
                    path: '/local/cache/image.png',
                    url: 'https://media.example.com/image.png',
                },
            ],
        })

        expect(authorization).toBe('Bearer onebot-token')
        expect(payload).toEqual({
            group_id: '123456',
            message: [
                { type: 'text', data: { text: 'hello' } },
                { type: 'image', data: { file: 'https://media.example.com/image.png' } },
            ],
        })
    })
})
