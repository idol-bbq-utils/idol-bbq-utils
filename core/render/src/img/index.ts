import type { Article } from '@/types'
import { getIconCode, loadEmoji, type apis } from './utils/twemoji'
import { FontDetector, languageFontMap } from './utils/font'
import { articleParser, CARD_WIDTH } from '@/template/img/DefaultCard'
import satori from 'satori'
import tailwindConfig from '@/template/img/DefaultTailwindConfig'
import { Resvg } from '@resvg/resvg-js'
import fs from 'fs'

function withCache(fn: Function) {
    const cache = new Map()
    return async (...args: string[]) => {
        const key = args.join(':')
        if (cache.has(key)) return cache.get(key)
        const result = await fn(...args)
        cache.set(key, result)
        return result
    }
}

const detector = new FontDetector()

// Our own encoding of multiple fonts and their code, so we can fetch them in one request. The structure is:
// [1 byte = X, length of language code][X bytes of language code string][4 bytes = Y, length of font][Y bytes of font data]
// Note that:
// - The language code can't be longer than 255 characters.
// - The language code can't contain non-ASCII characters.
// - The font data can't be longer than 4GB.
// When there are multiple fonts, they are concatenated together.
function encodeFontInfoAsArrayBuffer(code: string, fontData: ArrayBuffer) {
    // 1 byte per char
    const buffer = new ArrayBuffer(1 + code.length + 4 + fontData.byteLength)
    const bufferView = new Uint8Array(buffer)
    // 1 byte for the length of the language code
    bufferView[0] = code.length
    // X bytes for the language code
    for (let i = 0; i < code.length; i++) {
        bufferView[i + 1] = code.charCodeAt(i)
    }

    // 4 bytes for the length of the font data
    new DataView(buffer).setUint32(1 + code.length, fontData.byteLength, false)

    // Y bytes for the font data
    bufferView.set(new Uint8Array(fontData), 1 + code.length + 4)

    return buffer
}

async function fetchFont(text: string, font: string, weight: number = 400): Promise<ArrayBuffer | null> {
    const API = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&text=${encodeURIComponent(text)}`
    const css = await (
        await fetch(API, {
            headers: {
                // Make sure it returns TTF.
                'User-Agent':
                    'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
            },
        })
    ).text()

    const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)

    if (!resource || !resource[1]) return null

    const res = await fetch(resource[1])

    return res.arrayBuffer()
}

async function loadGoogleFont(fonts: string[], text: string) {
    const textByFont = await detector.detect(text, fonts)
    const _fonts = Object.keys(textByFont)

    async function getFontResponseBuffer(weight: number) {
        const encodedFontBuffers: ArrayBuffer[] = []
        let fontBufferByteLength = 0
        ;(
            await Promise.all(
                _fonts.map((font) => {
                    if (!textByFont[font]) return
                    return fetchFont(textByFont[font], font, weight)
                }),
            )
        )
            .filter(Boolean)
            .forEach((fontData, i) => {
                if (fontData) {
                    // TODO: We should be able to directly get the language code here :)
                    const langCode = Object.entries(languageFontMap).find(([, v]) => v.includes(_fonts[i] || ''))?.[0]
                    if (langCode) {
                        const buffer = encodeFontInfoAsArrayBuffer(langCode, fontData)
                        encodedFontBuffers.push(buffer)
                        fontBufferByteLength += buffer.byteLength
                    }
                }
            })
        const responseBuffer = new ArrayBuffer(fontBufferByteLength)
        const responseBufferView = new Uint8Array(responseBuffer)
        let offset = 0
        encodedFontBuffers.forEach((buffer) => {
            responseBufferView.set(new Uint8Array(buffer), offset)
            offset += buffer.byteLength
        })
        return responseBuffer
    }
    return await Promise.all([getFontResponseBuffer(400), getFontResponseBuffer(700)])
}

// ref: https://github.com/vercel/satori/blob/78182f836b67fff48f9b6e77b7251382c2779559/playground/pages/index.tsx#L97
const loadDynamicAsset = withCache(async (emojiType: keyof typeof apis, _code: string, text: string) => {
    if (_code === 'emoji') {
        // It's an emoji, load the image.
        return `data:image/svg+xml;base64,` + btoa(await loadEmoji(emojiType, getIconCode(text)))
    }

    const codes = _code.split('|')
    // Some magic symbol
    if (codes.includes('symbol') && !codes.includes('ja-JP') && text.includes('┈')) {
        codes.push('ja-JP')
    }

    // Try to load from Google Fonts.
    const fonts = codes
        .map((code) => languageFontMap[code as keyof typeof languageFontMap])
        .filter(Boolean)
        .flat()

    if (fonts.length === 0) return []

    try {
        const [normalBuffer, boldBuffer] = await loadGoogleFont(fonts, text)

        const res_fonts: any[] = []

        // Decode the encoded font format.
        const decodeFontInfoFromArrayBuffer = (buffer: ArrayBuffer, weight: number) => {
            let offset = 0
            const bufferView = new Uint8Array(buffer)

            while (offset < bufferView.length) {
                // 1 byte for font name length.
                const languageCodeLength = bufferView[offset]
                offset += 1
                let languageCode = ''
                //@ts-ignore
                for (let i = 0; i < languageCodeLength; i++) {
                    //@ts-ignore
                    languageCode += String.fromCharCode(bufferView[offset + i])
                }
                //@ts-ignore
                offset += languageCodeLength

                // 4 bytes for font data length.
                const fontDataLength = new DataView(buffer).getUint32(offset, false)
                offset += 4
                const fontData = buffer.slice(offset, offset + fontDataLength)
                offset += fontDataLength

                res_fonts.push({
                    name: `satori_${languageCode}_fallback_${text}`,
                    data: fontData,
                    weight: weight,
                    style: 'normal',
                    lang: languageCode === 'unknown' ? undefined : languageCode,
                })
            }
        }

        decodeFontInfoFromArrayBuffer(normalBuffer, 400)
        decodeFontInfoFromArrayBuffer(boldBuffer, 700)

        return res_fonts
    } catch (e) {
        console.error('Failed to load dynamic font for', text, '. Error:', e)
    }
})

class ImgConverter {
    constructor() {}
    public async articleToImg(article: Article, fontsDir: string = './assets/fonts') {
        const { height, component: Card } = articleParser(article)
        const svg = await satori(Card, {
            width: CARD_WIDTH,
            height: height,
            fonts: [
                {
                    name: 'Noto Sans',
                    data: fs.readFileSync(`${fontsDir}/NotoSans-Regular.ttf`),
                    style: 'normal',
                    weight: 400,
                },
                {
                    name: 'Noto Sans',
                    data: fs.readFileSync(`${fontsDir}/NotoSans-Bold.ttf`),
                    style: 'normal',
                    weight: 700,
                },
            ],
            loadAdditionalAsset: (code: string, text: string) => {
                return loadDynamicAsset('twemoji', code, text)
            },
            tailwindConfig,
        })
        const resvg = new Resvg(svg, {
            fitTo: {
                mode: 'width',
                value: CARD_WIDTH * 1.5,
            },
        })
        const data = resvg.render()
        const buffer = data.asPng()
        return buffer
    }
}

export { loadDynamicAsset, ImgConverter }
