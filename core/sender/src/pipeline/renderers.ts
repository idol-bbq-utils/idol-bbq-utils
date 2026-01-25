import type { ArticleLike } from '../article'
import type { MessageRenderer } from './types'

export class PlainTextRenderer implements MessageRenderer {
    render(_article: ArticleLike | undefined, text: string): string {
        return text
    }
}
