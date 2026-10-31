// Prints the value for comingSoonPinHash in data/site-config.js.
// Usage: node tools/hash-pin.mjs 1234
// Must stay in step with hashPin() in assets/js/arcade.js.
const pin = process.argv[2];
if (!pin) {
  console.error("Usage: node tools/hash-pin.mjs <pin>");
  process.exit(1);
}

let hash = 0x811c9dc5;
for (const char of `gabys-arcade:${pin}`) {
  hash ^= char.charCodeAt(0);
  hash = Math.imul(hash, 0x01000193) >>> 0;
}
console.log(hash.toString(16).padStart(8, "0"));
