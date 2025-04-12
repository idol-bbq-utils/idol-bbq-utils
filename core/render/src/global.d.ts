import 'react'

declare module 'react' {
    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
        // 为所有 HTML 元素添加 tw 属性
        tw?: string
    }
}
