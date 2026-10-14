export function parseRosterUrl(value: string): URL {
  if (typeof value !== 'string') throw new Error('url')
  const source = new URL(value.trim())
  if (source.protocol !== 'https:' || source.hostname !== 'lostark.bible' || source.port || source.username || source.password || !/^\/character\/[a-zA-Z]{2,5}\/[^/]+(?:\/roster)?\/?$/.test(source.pathname)) throw new Error('url')
  if (!/^[\p{L}\p{N}_-]{1,40}$/u.test(decodeURIComponent(source.pathname.split('/')[3]))) throw new Error('name')
  source.search = ''
  source.hash = ''
  source.pathname = source.pathname.replace(/\/$/, '').replace(/\/roster$/, '') + '/roster'
  return source
}
