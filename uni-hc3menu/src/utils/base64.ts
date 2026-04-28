const _chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

export function base64Encode(input: string): string {
  const bytes = unescape(encodeURIComponent(input))
  let out = ""
  let i = 0
  while (i < bytes.length) {
    const c1 = bytes.charCodeAt(i++) & 0xff
    const c2 = bytes.charCodeAt(i++) & 0xff
    const c3 = bytes.charCodeAt(i++) & 0xff
    const e1 = c1 >> 2
    const e2 = ((c1 & 3) << 4) | (c2 >> 4)
    let e3 = ((c2 & 15) << 2) | (c3 >> 6)
    let e4 = c3 & 63
    if (isNaN(c2)) {
      e3 = 64
      e4 = 64
    } else if (isNaN(c3)) {
      e4 = 64
    }
    out += _chars.charAt(e1) + _chars.charAt(e2) + _chars.charAt(e3) + _chars.charAt(e4)
  }
  return out
}

