import fs from 'fs'
import path from 'path'
import test from 'brittle'
import tmp from 'like-tmp'
import { unstable_dev as unstableDev } from 'wrangler'
import DurableObjects from './index.js'

test('basic', async function (t) {
  const worker = await createWorker(t)
  const objects = new DurableObjects({ url: worker.$url })

  const id = await objects.create()
  const db = objects.from(id)

  await db.put('/users/1', 1337)

  t.is(await db.get('/users/1'), 1337)

  t.alike(await db.list(), [{ key: '/users/1', value: 1337 }])

  await db.del('/users/1')

  t.is(await db.get('/users/1'), null)

  await db.del('/users/does-not-exists')
})

test('create by name', async function (t) {
  const worker = await createWorker(t)
  const objects = new DurableObjects({ url: worker.$url })

  const id = await objects.create('project/user:123')
  const db = objects.from(id)

  await db.put('key1', 1337)

  const id2 = await objects.create('project/user:123')
  const db2 = objects.from(id2)

  t.is(await db2.get('key1'), 1337)

  t.is(id, id2)
})

test('list', async function (t) {
  const worker = await createWorker(t)
  const objects = new DurableObjects({ url: worker.$url })

  const id = await objects.create()
  const db = objects.from(id)

  const data = []

  for (let i = 0; i < 15; i++) {
    data.push({ key: '/texts/' + Date.now() + '-' + i, value: 'Hello World!' })
  }

  await db.put(data)

  const out = await db.list({ limit: 10 })

  t.is(out.length, 10)

  const out2 = await db.list({ limit: 10, startAfter: out[out.length - 1].key })

  t.is(out2.length, 5)
})

test('list prefix', async function (t) {
  const worker = await createWorker(t)
  const objects = new DurableObjects({ url: worker.$url })

  const id = await objects.create()
  const db = objects.from(id)

  await db.put('/users/1', { name: '' })
  await db.put('/users/2', { name: '' })
  await db.put('/texts/a', 'Hello World!')

  const out = await db.list({ prefix: '/users/' })

  t.is(out.length, 2)

  const out2 = await db.list({ prefix: '/texts/' })

  t.is(out2.length, 1)
})

test('purge', async function (t) {
  const worker = await createWorker(t)
  const objects = new DurableObjects({ url: worker.$url })

  const id = await objects.create()
  const db = objects.from(id)

  await db.put('/users/1', 1337)
  await db.put('/users/2', 1337)
  await db.put('/users/3', 1337)

  await db.purge()

  try {
    await db.list()
    t.fail()
  } catch (err) {
    t.is(err.code, 'OBJECT_NOT_FOUND')
  }
})

test('main and access tokens', async function (t) {
  t.plan(3)

  const DURABLE_OBJECTS_TOKEN = 'secret'

  const worker = await createWorker(t, {
    vars: {
      DURABLE_OBJECTS_TOKEN
    }
  })

  // Can create objects and read/write also
  const objects = new DurableObjects({
    url: worker.$url,
    token: DURABLE_OBJECTS_TOKEN
  })

  const id = await objects.create()
  const db = objects.from(id)

  await db.put('/users/1', 1337)

  t.is(await db.get('/users/1'), 1337)

  // Can't create but can write/read
  const objects2 = new DurableObjects({ url: worker.$url })

  try {
    await objects2.create()
    t.fail()
  } catch (err) {
    t.is(err.code, 'INVALID_TOKEN')
  }

  const db2 = objects2.from(id)

  await db2.put('/users/1', 1337)

  t.is(await db2.get('/users/1'), 1337)
})

async function createWorker (t, opts = {}) {
  // Avoids the cwd of .dev.vars
  const dir = await tmp(t)
  const config = path.join(dir, 'wrangler.toml')
  await fs.promises.copyFile('./wrangler.toml', config)

  const worker = await unstableDev('./worker.mjs', {
    config,
    env: opts.env, // E.g. 'test' section in wrangler.toml
    vars: opts.vars, // Environment variables
    logLevel: opts.logLevel, // E.g. 'info'
    experimental: { disableExperimentalWarning: true }
  })

  t.teardown(() => worker.stop())

  worker.$url = 'http://' + worker.address + ':' + worker.port

  return worker
}
