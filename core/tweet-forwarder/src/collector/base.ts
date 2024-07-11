abstract class BaseCollector<T> {
  constructor() {}
  public abstract collect(items: Array<T>, type: string): Promise<this>
  protected abstract convert(items: Array<T>, type: string): Promise<Array<T>>
}

export { BaseCollector }
