/**
 * 内存 BM25(§5.1):k1=1.5, b=0.75,IDF = ln(1 + (N - n + 0.5)/(n + 0.5))。
 * 倒排索引:词 → 文档 postings;全文索引不分段;天花板数万条,超出再引专用索引(§5)。
 */
export class Bm25Index {
  /** @param options { k1: number, b: number } */
  constructor(options) {
    this.k1 = options.k1
    this.b = options.b
    /** @type Map<string, Map<string, number>> id → 词频表 */
    this.docs = new Map()
    /** @type Map<string, Map<string, number>> 词 → (id → 词频) */
    this.postings = new Map()
    /** @type Map<string, number> id → 文档长度(词数) */
    this.docLen = new Map()
    this.totalLen = 0
  }

  get size() {
    return this.docs.size
  }

  get avgLen() {
    return this.docs.size === 0 ? 0 : this.totalLen / this.docs.size
  }

  has(id) {
    return this.docs.has(id)
  }

  clear() {
    this.docs.clear()
    this.postings.clear()
    this.docLen.clear()
    this.totalLen = 0
  }

  add(id, tokens) {
    if (this.docs.has(id)) this.remove(id)
    const tf = new Map()
    for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1)
    this.docs.set(id, tf)
    this.docLen.set(id, tokens.length)
    this.totalLen += tokens.length
    for (const [term, freq] of tf) {
      let posting = this.postings.get(term)
      if (posting === undefined) {
        posting = new Map()
        this.postings.set(term, posting)
      }
      posting.set(id, freq)
    }
  }

  remove(id) {
    const tf = this.docs.get(id)
    if (tf === undefined) return
    for (const term of tf.keys()) {
      const posting = this.postings.get(term)
      if (posting !== undefined) {
        posting.delete(id)
        if (posting.size === 0) this.postings.delete(term)
      }
    }
    this.docs.delete(id)
    this.totalLen -= this.docLen.get(id) ?? 0
    this.docLen.delete(id)
  }

  idf(term) {
    const posting = this.postings.get(term)
    const n = posting === undefined ? 0 : posting.size
    return Math.log(1 + (this.docs.size - n + 0.5) / (n + 0.5))
  }

  /**
   * @returns [{ id, score }] 按分数降序;无命中返回 []。
   */
  search(queryTokens, limit = 50) {
    if (this.docs.size === 0 || queryTokens.length === 0) return []
    const terms = [...new Set(queryTokens)]
    const scores = new Map()
    const avg = this.avgLen || 1
    for (const term of terms) {
      const posting = this.postings.get(term)
      if (posting === undefined) continue
      const idf = this.idf(term)
      for (const [id, f] of posting) {
        const norm = 1 - this.b + (this.b * (this.docLen.get(id) ?? 0)) / avg
        const tfScore = (f * (this.k1 + 1)) / (f + this.k1 * norm)
        scores.set(id, (scores.get(id) ?? 0) + idf * tfScore)
      }
    }
    return [...scores.entries()]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}
