import type { Article } from '@/db'
import type { MessageRenderer } from './types'

export class PlainTextRenderer implements MessageRenderer {
    render(_article: Article | undefined, text: string): string {
        return text
    }
}
