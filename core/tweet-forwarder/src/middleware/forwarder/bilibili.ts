import axios from 'axios'
import { BaseForwarder } from './base'
import { pRetry } from '@idol-bbq-utils/utils'
import { log } from '@/config'
class BiliForwarder extends BaseForwarder {
    constructor(token: string) {
        super(token)
    }
    public async send(text: string) {
        await pRetry(
            () =>
                axios.post(
                    'https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/create',
                    {
                        dynamic_id: 0,
                        type: 4,
                        rid: 0,
                        content: text,
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            Cookie: `SESSDATA=${this.token}`,
                        },
                    },
                ),
            {
                retries: 2,
                onFailedAttempt(error) {
                    log.error(
                        `Send text to bilibili failed. There are ${error.retriesLeft} retries left. ${error.message}`,
                    )
                },
            },
        )
        return
    }
}

export { BiliForwarder }
