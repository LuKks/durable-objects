// TODO: Using CJS throws: Dynamic require of "cloudflare:workers" is not supported
import { DurableObject } from 'cloudflare:workers'

export default class Storage extends DurableObject {
  constructor (ctx, env) {
    super(ctx, env)

    this.ctx = ctx
    this.env = env
  }

  async write (key, value) {
    // Max key size: 2048 bytes
    // Max value size: 131072 bytes
    await this.ctx.storage.put(key, value)
  }

  async writeMany (entries) {
    for (const entry of entries) {
      await this.ctx.storage.put(entry.key, entry.value)
    }
  }

  async read (key) {
    // It returns undefined if entry doesn't exists
    return await this.ctx.storage.get(key)
  }

  async list (opts) {
    const out = await this.ctx.storage.list(opts)

    return [...out]
  }

  async delete (key) {
    await this.ctx.storage.delete(key)
  }

  async deleteMany (keys) {
    for (const key of keys) {
      await this.ctx.storage.delete(key)
    }
  }

  async deleteAll () {
    await this.ctx.storage.deleteAll()
  }

  async rename (key1, key2, value) {
    if (key1 === key2) {
      throw new Error('Renaming to same key is invalid')
    }

    const current = value || (await this.ctx.storage.get(key1))

    if (current === undefined) {
      throw new Error('Key does not exists')
    }

    await this.ctx.storage.put(key2, value)
    await this.ctx.storage.delete(key1)
  }

  async isEmpty () {
    const out = await this.ctx.storage.list({ limit: 1 })

    return [...out].length === 0
  }
}
