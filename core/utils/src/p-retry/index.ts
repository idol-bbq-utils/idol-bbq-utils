import retry from 'retry'
import { type OperationOptions } from 'retry'
import { isNetworkError } from '../is-network-error'

export class FailedAttemptError extends Error {
    attemptNumber: number
    retriesLeft: number
    readonly name: 'FailedAttemptError'
    readonly originalError: Error
    constructor(message: string | Error, attemptNumber: number, retriesLeft: number) {
        super()
        if (message instanceof Error) {
            this.originalError = message
            ;({ message } = message)
        } else {
            this.originalError = new Error(message)
            this.originalError.stack = this.stack
        }
        this.name = 'FailedAttemptError'
        this.attemptNumber = attemptNumber
        this.retriesLeft = retriesLeft
    }
}

export class AbortError extends Error {
    readonly name: 'AbortError'
    readonly originalError: Error
    constructor(message: string | Error) {
        super()

        if (message instanceof Error) {
            this.originalError = message
            ;({ message } = message)
        } else {
            this.originalError = new Error(message)
            this.originalError.stack = this.stack
        }

        this.name = 'AbortError'
        this.message = message
    }
}

export type Options = {
    /**
	Callback invoked on each retry. Receives the error thrown by `input` as the first argument with properties `attemptNumber` and `retriesLeft` which indicate the current attempt number and the number of attempts left, respectively.

	The `onFailedAttempt` function can return a promise. For example, to add a [delay](https://github.com/sindresorhus/delay):

	```
	import pRetry from 'p-retry';
	import delay from 'delay';

	const run = async () => { ... };

	const result = await pRetry(run, {
		onFailedAttempt: async error => {
			console.log('Waiting for 1 second before retrying');
			await delay(1000);
		}
	});
	```

	If the `onFailedAttempt` function throws, all retries will be aborted and the original promise will reject with the thrown error.
	*/
    readonly onFailedAttempt?: (error: FailedAttemptError) => void | Promise<void>

    /**
	Decide if a retry should occur based on the error. Returning true triggers a retry, false aborts with the error.

	It is not called for `TypeError` (except network errors) and `AbortError`.

	@param error - The error thrown by the input function.

	@example
	```
	import pRetry from 'p-retry';

	const run = async () => { … };

	const result = await pRetry(run, {
		shouldRetry: error => !(error instanceof CustomError);
	});
	```

	In the example above, the operation will be retried unless the error is an instance of `CustomError`.
	*/
    readonly shouldRetry?: (error: FailedAttemptError) => boolean | Promise<boolean>

    /**
	You can abort retrying using [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).

	```
	import pRetry from 'p-retry';

	const run = async () => { … };
	const controller = new AbortController();

	cancelButton.addEventListener('click', () => {
		controller.abort(new Error('User clicked cancel button'));
	});

	try {
		await pRetry(run, {signal: controller.signal});
	} catch (error) {
		console.log(error.message);
		//=> 'User clicked cancel button'
	}
	```
	*/
    readonly signal?: AbortSignal
    retries: number
} & OperationOptions

const decorateErrorWithCounts = (error: Error, attemptNumber: number, options: Options) => {
    // Minus 1 from attemptNumber because the first attempt does not count as a retry
    const retriesLeft = options.retries - (attemptNumber - 1)
    return new FailedAttemptError(error, attemptNumber, retriesLeft)
}

export async function pRetry<T>(input: (attemptCount: number) => PromiseLike<T> | T, _options?: Options): Promise<T> {
    return new Promise((resolve, reject) => {
        let options = Object.assign(
            {
                onFailedAttempt() {},
                retries: 10,
                shouldRetry: (error: FailedAttemptError) => true,
            },
            _options,
        )

        const operation = retry.operation(options)

        const abortHandler = () => {
            operation.stop()
            reject(options?.signal?.reason)
        }

        if (options.signal && !options.signal.aborted) {
            options.signal.addEventListener('abort', abortHandler, { once: true })
        }

        const cleanUp = () => {
            options?.signal?.removeEventListener('abort', abortHandler)
            operation.stop()
        }

        operation.attempt(async (attemptNumber) => {
            try {
                const result = await input(attemptNumber)
                cleanUp()
                resolve(result)
            } catch (error) {
                try {
                    if (!(error instanceof Error)) {
                        throw new TypeError(`Non-error was thrown: "${error}". You should only throw errors.`)
                    }

                    if (error instanceof AbortError) {
                        throw error.originalError
                    }

                    if (error instanceof TypeError && !isNetworkError(error)) {
                        throw error
                    }

                    const failedAttemptError = decorateErrorWithCounts(error, attemptNumber, options)

                    if (!(await options.shouldRetry(failedAttemptError))) {
                        operation.stop()
                        reject(error)
                    }

                    await options.onFailedAttempt(failedAttemptError)

                    if (!operation.retry(error)) {
                        throw operation.mainError()
                    }
                } catch (_finalError) {
                    cleanUp()
                    reject(_finalError)
                }
            }
        })
    })
}
