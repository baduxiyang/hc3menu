const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

const utf8Encode = (s: string): number[] => {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) {
      out.push(0xc0 | (c >> 6));
      out.push(0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        const cp = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
        out.push(0xf0 | (cp >> 18));
        out.push(0x80 | ((cp >> 12) & 0x3f));
        out.push(0x80 | ((cp >> 6) & 0x3f));
        out.push(0x80 | (cp & 0x3f));
        i += 1;
      } else {
        out.push(0xef, 0xbf, 0xbd);
      }
    } else {
      out.push(0xe0 | (c >> 12));
      out.push(0x80 | ((c >> 6) & 0x3f));
      out.push(0x80 | (c & 0x3f));
    }
  }
  return out;
};

export const base64Encode = (input: string): string => {
  const g = globalThis as any;
  if (typeof g.btoa === "function") {
    try {
      return g.btoa(unescape(encodeURIComponent(input)));
    } catch {
      return g.btoa(input);
    }
  }

  const bytes = utf8Encode(input);
  let output = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = bytes[i + 1] ?? 0;
    const b3 = bytes[i + 2] ?? 0;

    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 3) << 4) | (b2 >> 4);
    const enc3 = ((b2 & 15) << 2) | (b3 >> 6);
    const enc4 = b3 & 63;

    const pad2 = i + 1 >= bytes.length;
    const pad3 = i + 2 >= bytes.length;

    output += chars.charAt(enc1);
    output += chars.charAt(enc2);
    output += chars.charAt(pad2 ? 64 : enc3);
    output += chars.charAt(pad3 ? 64 : enc4);
  }

  return output;
};

