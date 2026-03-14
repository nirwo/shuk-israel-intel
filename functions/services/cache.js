const cache = new Map();

/**
 * Gets a value from cache if it exists and hasn't expired
 * @param {string} key Cache key
 * @returns {any|null} The cached value or null if not found/expired
 */
function get(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

/**
 * Sets a value in the cache with a TTL
 * @param {string} key Cache key
 * @param {any} value Value to cache
 * @param {number} ttlSeconds Time to live in seconds (default: 1 hour)
 */
function set(key, value, ttlSeconds = 3600) {
  const expiry = Date.now() + (ttlSeconds * 1000);
  cache.set(key, { value, expiry });
}

module.exports = {
  get,
  set
};
