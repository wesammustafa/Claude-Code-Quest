// Binary glTF (.glb) packing, with no Node or 3D code: the model script
// (pip-model.ts) writes Pip with it, and the model test unpacks a model,
// edits its JSON (a clip removed) and packs it again.

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const BIN_CHUNK = 0x004e4942; // "BIN\0"

const padded = (length: number) => length + ((4 - (length % 4)) % 4);

/** A glTF's JSON and binary buffer, packed as one .glb. */
export function packGlb(json: unknown, bin: Uint8Array): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = padded(text.length);
  const binLength = padded(bin.length);
  const out = new Uint8Array(12 + 8 + jsonLength + 8 + binLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  out.set(text, 20);
  // The JSON chunk is padded with spaces, the binary one with zeros.
  out.fill(0x20, 20 + text.length, 20 + jsonLength);
  const binAt = 20 + jsonLength;
  view.setUint32(binAt, binLength, true);
  view.setUint32(binAt + 4, BIN_CHUNK, true);
  out.set(bin, binAt + 8);
  return out;
}

/** A .glb's JSON and binary chunk. */
export function unpackGlb(file: Uint8Array): {
  json: unknown;
  bin: Uint8Array;
} {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (view.getUint32(0, true) !== MAGIC) throw new Error("not a .glb");
  const jsonLength = view.getUint32(12, true);
  const json: unknown = JSON.parse(
    new TextDecoder().decode(file.subarray(20, 20 + jsonLength)),
  );
  const binAt = 20 + jsonLength;
  const binLength = view.getUint32(binAt, true);
  return { json, bin: file.slice(binAt + 8, binAt + 8 + binLength) };
}
