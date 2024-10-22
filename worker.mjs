import Storage from './storage.mjs'

const cache = new Map()

export { Storage }

// TODO: It's a quick draft (Missing error handling, better access tokens, objects.list(), etcetera)
export default {
  async fetch (req, env) {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const MAIN_KEY = env.DURABLE_OBJECTS_MAIN_KEY || null
    const ACCESS_KEY = env.DURABLE_OBJECTS_ACCESS_KEY || null

    const headerMainKey = req.headers.get('x-durable-objects-main-key') || null
    const headerAccessKey = req.headers.get('x-durable-objects-access-key') || null

    const objects = env.NAMESPACE.get(env.NAMESPACE.idFromName('objects'))
    const body = await req.json()

    if (body.method === 'create') {
      if (MAIN_KEY && MAIN_KEY !== headerMainKey) {
        return Response.json({ error: 'INVALID_MAIN_KEY' }, { status: 401 })
      }

      let id = null

      if (body.name) {
        id = env.STORAGE.idFromName(body.name).toString()
      } else {
        id = env.STORAGE.newUniqueId().toString()
      }

      await objects.write(id, {
        name: body.name || null,
        purged: false,
        time: Date.now(),
        created: Date.now()
      })

      return Response.json({ id }, { status: 200 })
    }

    if ((MAIN_KEY && MAIN_KEY !== headerMainKey) && (ACCESS_KEY && ACCESS_KEY !== headerAccessKey)) {
      return Response.json({ error: 'INVALID_ACCESS_KEY' }, { status: 401 })
    }

    if (!body.id) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    let id = null

    if (body.name) {
      id = env.STORAGE.idFromName(body.name)
    } else if (body.id) {
      id = env.STORAGE.idFromString(body.id)
    } else {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    // No one can use a random ID and start writing data
    if (!cache.has(id.toString())) {
      const value = await objects.read(id.toString())

      if (!value) {
        return Response.json({ error: 'OBJECT_NOT_FOUND' }, { status: 400 })
      }

      cache.set(id.toString(), value)
    }

    const cached = cache.get(id.toString())

    if (!cached.purged && Date.now() - cached.time >= 24 * 60 * 60 * 1000) {
      cached.time = Date.now()

      await objects.write(id.toString(), cached)
    }

    const stub = env.STORAGE.get(id)

    if (body.method === 'write') {
      if (body.entries) {
        await stub.writeMany(body.entries)
      } else {
        await stub.write(body.key, body.value)
      }

      return Response.json(null, { status: 200 })
    }

    if (body.method === 'read') {
      const value = await stub.read(body.key)

      return Response.json({ value }, { status: 200 })
    }

    if (body.method === 'list') {
      const opts = {
        start: body.options.start,
        startAfter: body.options.startAfter,
        end: body.options.end,
        prefix: body.options.prefix,
        reverse: body.options.reverse,
        limit: body.options.limit ? parseInt(body.options.limit, 10) : 100
      }

      const entries = await stub.list(opts)

      return Response.json(entries, { status: 200 })
    }

    if (body.method === 'delete') {
      if (body.keys) {
        await stub.deleteMany(body.keys)
      } else {
        await stub.delete(body.key)
      }

      return Response.json(null, { status: 200 })
    }

    if (body.method === 'purge') {
      cached.purged = true

      await stub.deleteAll()

      await objects.delete(id.toString())

      cache.delete(id.toString())

      return Response.json(null, { status: 200 })
    }

    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
}
