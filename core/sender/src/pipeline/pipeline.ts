import type { ForwarderContext, ForwarderMiddleware } from './types'

class AbortError extends Error {
    constructor(reason: string) {
        super(reason)
        this.name = 'AbortError'
    }
}

export class MiddlewarePipeline {
    private middlewares: ForwarderMiddleware[] = []

    use(middleware: ForwarderMiddleware): this {
        this.middlewares.push(middleware)
        return this
    }

    async execute(context: ForwarderContext): Promise<boolean> {
        let index = 0

        const next = async (): Promise<void> => {
            if (index >= this.middlewares.length) return

            const middleware = this.middlewares[index++]
            if (!middleware) return

            const shouldContinue = await middleware.process(context, next)

            if (!shouldContinue) {
                context.aborted = true
                context.abortReason = context.abortReason || `Blocked by ${middleware.name}`
                throw new AbortError(context.abortReason)
            }
        }

        try {
            await next()
            return true
        } catch (e) {
            if (e instanceof AbortError) {
                return false
            }
            throw e
        }
    }

    getMiddlewares(): readonly ForwarderMiddleware[] {
        return this.middlewares
    }
}
