const fetch = require('like-fetch')

module.exports = class DurableObjects {
  constructor (opts = {}) {
    this.url = opts.url || process.env.DURABLE_OBJECTS_URL
    this.token = opts.token || process.env.DURABLE_OBJECTS_TOKEN || null
  }

  from (id) {
    return new DurableObject(this, id)
  }

  async create (name) {
    const out = await this.api('create', { name })

    return out.id
  }

  async api (method, params) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'x-durable-objects-token': this.token
      },
      requestType: 'json',
      body: {
        ...params,
        method
      }
    })

    const data = await response.json()

    if (!response.ok) {
      if (!data.error) {
        throw new Error('Invalid error response: ' + JSON.stringify(data))
      }

      const err = new Error(data.message || 'Request failed')
      err.code = data.code || data.error
      throw err
    }

    return data
  }
}

class DurableObject {
  constructor (objects, id) {
    this.objects = objects
    this.id = id
  }

  async put (key, value) {
    if (Array.isArray(key)) {
      await this.api('write', { entries: key })
    } else {
      await this.api('write', { key, value })
    }
  }

  async get (key) {
    const out = await this.api('read', { key })

    return out.value || null
  }

  async list (options = {}) {
    // TODO: The worker needs improvements to avoid undefineds here
    // For now, I'm delaying updating the worker and just fixing the lib
    const entries = await this.api('list', {
      options: {
        start: options.start ? options.start : undefined,
        startAfter: options.startAfter ? options.startAfter : undefined,
        end: options.end ? options.end : undefined,
        prefix: options.prefix ? options.prefix : undefined,
        reverse: options.reverse || false,
        limit: options.limit || 100
      }
    })

    const pairs = []

    for (const [key, value] of entries) {
      pairs.push({ key, value })
    }

    return pairs
  }

  async del (key) {
    if (Array.isArray(key)) {
      await this.api('delete', { keys: key })
    } else {
      await this.api('delete', { key })
    }
  }

  async purge () {
    await this.api('purge')
  }

  async api (method, params) {
    return this.objects.api(method, { ...params, id: this.id })
  }
}
