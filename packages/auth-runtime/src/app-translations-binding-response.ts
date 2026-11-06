export const readBoundedJson = async (response: Response, maxBytes = 8192): Promise<unknown> => {
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error('mainserver_identity_unavailable');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('mainserver_identity_invalid');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)));
};
