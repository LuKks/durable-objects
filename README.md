# durable-objects

Strong-consistent key-value data storage based on Durable Objects

```
npm i durable-objects
```

"A globally distributed coordination API with strongly consistent storage, enabling powerful coordination among multiple clients or users with private, transactional, and consistent storage."

https://developers.cloudflare.com/durable-objects/

## Usage

Deploy the `worker.mjs` script by running:

```sh
# Configure a secret token
wrangler secret put DURABLE_OBJECTS_TOKEN

# Deploy the Worker
wrangler deploy
```

Then you can use it:

```js
const DurableObjects = require('durable-objects')

const objects = new DurableObjects({ token, url: 'https://username.workers.dev' })

// Generate a Durable Object ID
const id = await objects.create()

// Instantiate the Durable Object
const db = objects.from(id)

// Write an entry
await db.put('/users/123', { name: '' })

// Read an entry
const user = await db.get('/users/123')

// List key-value pairs (there is a prefix filter, and paging options)
const list = await db.list()

// Delete a key-value pair
await db.del('/users/123')

// Clear all data
await db.purge()
```

Normally, you would not store multiple databases in a single DO due its limits.

You can distribute your database into multiple DOs based on id by name:

```js
const id = await objects.create('project/user/123')
const db = objects.from(id)
```

## API

#### `objects = new DurableObjects([options])`

Create a Durable Objects API instance.

Options:

```js
{
  url, // Defaults to env.DURABLE_OBJECTS_URL
  token // Defaults to env.DURABLE_OBJECTS_TOKEN
}
```

#### `id = await objects.create([name])`

Generate a new Durable Object ID.

If you set a name then it always gives the same ID.

You can share the ID so others can read and write it without the secret token.

#### `db = objects.from(id)`

Returns a new Durable Object instance, configured with the id.

#### `await db.put(key, value)`

Write a key-value pair. Value will be stringified as JSON.

- Max key size: 2048 bytes.
- Max value size: 131072 bytes.

#### `value = await db.get(key)`

Read a key-value pair. Value will be parsed as JSON.

Returns `null` if not found.

#### `await db.del(key)`

Delete a key-value pair.

#### `list = await db.list([options])`

Returns an array of key-value pairs.

The Worker is RAM limited to ~128MB, mind the limit option based on the values.

Options:

```js
{
  start: String, // Start from this key (inclusive)
  startAfter: String, // Start after this key (exclusive)
  end: String, // End before this key (exclusive)
  prefix: String, // Filter results based on the prefix
  reverse: Boolean, // Default is false (ascending order).
  limit: Number // Default is 100
}
```

## License

MIT
