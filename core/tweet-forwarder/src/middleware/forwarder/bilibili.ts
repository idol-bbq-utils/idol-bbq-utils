import axios from 'axios'
import { BaseForwarder } from './base'
class BiliForwarder extends BaseForwarder {
    constructor(token: string) {
        super(token)
    }
    public async send(text: string) {
        await axios.post(
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
        )
        return
    }
}

export { BiliForwarder }
