import type { ChunkStrategy } from './types'

export class SimpleChunkStrategy implements ChunkStrategy {
    private readonly SEPARATOR_NEXT = '\n\n----⬇️----'
    private readonly SEPARATOR_PREV = '----⬆️----\n\n'
    private readonly PADDING_LENGTH = 24

    chunk(text: string, limit: number): string[] {
        if (text.length <= limit) {
            return [text]
        }

        const textLimit = limit - this.SEPARATOR_NEXT.length - this.SEPARATOR_PREV.length - this.PADDING_LENGTH
        const chunks: string[] = []
        let remaining = text
        let i = 0

        while (remaining.length > limit) {
            const current = remaining.slice(0, textLimit)
            chunks.push(`${i > 0 ? this.SEPARATOR_PREV : ''}${current}${this.SEPARATOR_NEXT}`)
            remaining = remaining.slice(textLimit)
            i++
        }

        chunks.push(`${i > 0 ? this.SEPARATOR_PREV : ''}${remaining}`)
        return chunks
    }
}
