import os from 'os'
import { execSync } from 'child_process'

function downloadMediaFiles(
    url: string,
    gallery_dl: {
        path: string
        cookie_file?: string
    },
) {
    let args = []
    if (gallery_dl.cookie_file) {
        args.push(`--cookies ${gallery_dl.cookie_file}`)
    }
    args.push(`--directory ${os.tmpdir()}/gallery-dl`)
    args.push(url)
    const res = execSync(`${gallery_dl.path} ${args.join(' ')}`, { encoding: 'utf-8' })
        .split('\n')
        .filter((path) => path !== '')
        .map((path) => {
            if (path.startsWith('# ')) {
                return path.slice(2)
            }
            return path
        })
    return res
}
