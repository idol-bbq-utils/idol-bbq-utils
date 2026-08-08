import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'crypto'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { DufsMediaStorage, MediaStorageTypeEnum } from '../src'

const temporaryDirectories: string[] = []
const servers: Bun.Server<unknown>[] = []

afterEach(async () => {
    for (const server of servers.splice(0)) {
        await server.stop(true)
    }
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('DufsMediaStorage', () => {
    test('uploads with basic auth and returns a tokenized content-addressed public URL', async () => {
        const content = Buffer.from('image-data')
        const directory = await mkdtemp(path.join(os.tmpdir(), 'dufs-media-storage-'))
        temporaryDirectories.push(directory)
        const filePath = path.join(directory, 'rendered.PNG')
        await writeFile(filePath, content)

        const receivedRequests: Array<{ method: string; url: string; authorization: string | null }> = []
        let receivedBody: Buffer | undefined
        const server = Bun.serve({
            port: 0,
            async fetch(request) {
                receivedRequests.push({
                    method: request.method,
                    url: request.url,
                    authorization: request.headers.get('authorization'),
                })
                if (request.method === 'PUT') {
                    receivedBody = Buffer.from(await request.arrayBuffer())
                    return new Response(null, { status: 201 })
                }
                return new Response('download-token')
            },
        })
        servers.push(server)

        const storage = new DufsMediaStorage({
            type: MediaStorageTypeEnum.DUFS,
            upload_url: `http://127.0.0.1:${server.port}/private`,
            public_url: 'https://media.example.com/private',
            username: 'sender',
            password: 'secret',
        })

        const result = await storage.upload(filePath)
        const hash = createHash('sha256').update(content).digest('hex')

        const uploadRequest = receivedRequests[0]!
        const tokenRequest = receivedRequests[1]!
        expect(uploadRequest.method).toBe('PUT')
        expect(new URL(uploadRequest.url).pathname).toBe(`/private/${hash}.png`)
        expect(uploadRequest.authorization).toBe(`Basic ${Buffer.from('sender:secret').toString('base64')}`)
        expect(receivedBody).toEqual(content)
        expect(tokenRequest.method).toBe('GET')
        expect(new URL(tokenRequest.url).pathname).toBe(`/private/${hash}.png`)
        expect(new URL(tokenRequest.url).searchParams.has('tokengen')).toBe(true)
        expect(tokenRequest.authorization).toBe(`Basic ${Buffer.from('sender:secret').toString('base64')}`)
        expect(result).toEqual({
            key: `${hash}.png`,
            url: `https://media.example.com/private/${hash}.png?token=download-token`,
        })
    })

    test('reports a failed upload response', async () => {
        const directory = await mkdtemp(path.join(os.tmpdir(), 'dufs-media-storage-'))
        temporaryDirectories.push(directory)
        const filePath = path.join(directory, 'rendered.png')
        await writeFile(filePath, 'image-data')

        const server = Bun.serve({
            port: 0,
            fetch: () => new Response('denied', { status: 403, statusText: 'Forbidden' }),
        })
        servers.push(server)

        const storage = new DufsMediaStorage({
            type: MediaStorageTypeEnum.DUFS,
            upload_url: `http://127.0.0.1:${server.port}/media`,
            username: 'sender',
            password: 'wrong',
        })

        expect(storage.upload(filePath)).rejects.toThrow('Dufs upload failed with 403 Forbidden: denied')
    })

    test('reports a failed token generation response', async () => {
        const directory = await mkdtemp(path.join(os.tmpdir(), 'dufs-media-storage-'))
        temporaryDirectories.push(directory)
        const filePath = path.join(directory, 'rendered.png')
        await writeFile(filePath, 'image-data')

        const server = Bun.serve({
            port: 0,
            fetch(request) {
                if (request.method === 'PUT') {
                    return new Response(null, { status: 201 })
                }
                return new Response('denied', { status: 401, statusText: 'Unauthorized' })
            },
        })
        servers.push(server)

        const storage = new DufsMediaStorage({
            type: MediaStorageTypeEnum.DUFS,
            upload_url: `http://127.0.0.1:${server.port}/media`,
            username: 'sender',
            password: 'wrong',
        })

        expect(storage.upload(filePath)).rejects.toThrow('Dufs token generation failed with 401 Unauthorized: denied')
    })
})
