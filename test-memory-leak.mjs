const origin = process.env.NEXT_ORIGIN || 'http://127.0.0.1:3000'
const total = Number(process.env.NEXT_LRU_REPRO_REQUESTS || 1_200_000)
const slugBytes = Number(process.env.NEXT_LRU_REPRO_SLUG_BYTES || 200)
const concurrency = Number(process.env.NEXT_LRU_REPRO_CONCURRENCY || 24)
const reportEvery = Number(process.env.NEXT_LRU_REPRO_REPORT_EVERY || 5_000)

let completed = 0
let failed = 0
const startedAt = Date.now()

function formatMb(bytes) {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`
}

function report(force = false) {
  if (!force && completed % reportEvery !== 0) return

  const memory = process.memoryUsage()
  const elapsed = Math.round((Date.now() - startedAt) / 1000)

  console.log(
    [
      `completed=${completed}/${total}`,
      `failed=${failed}`,
      `elapsed=${elapsed}s`,
      `driver_heap=${formatMb(memory.heapUsed)}`,
      `driver_rss=${formatMb(memory.rss)}`,
    ].join(' ')
  )
}

async function requestOne(index) {
  const longSlug = `${index}-${'x'.repeat(slugBytes)}`
  const response = await fetch(`${origin}/api/logs/${longSlug}`)

  if (!response.ok) {
    throw new Error(`Unexpected ${response.status} for request ${index}`)
  }

  await response.arrayBuffer()
}

async function worker(offset) {
  for (let index = offset; index < total; index += concurrency) {
    try {
      await requestOne(index)
    } catch (error) {
      failed += 1
      if (failed <= 10) {
        console.error(error)
      }
    } finally {
      completed += 1
      report()
    }
  }
}

console.log(
  `Sending ${total} unique requests to ${origin} with slugBytes=${slugBytes}, concurrency=${concurrency}`
)

await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index)))
report(true)
