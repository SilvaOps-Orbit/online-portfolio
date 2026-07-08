import { cleanText, stripPriceText } from "./text-sanitizer.mjs";

const cases = [
  {
    name: "removes nested tag-like markup",
    actual: cleanText("<scr<script>ipt>alert(1)</scr<script>ipt>Public playlist"),
    expected: "alert(1) Public playlist"
  },
  {
    name: "decodes known entities without second-pass unescaping",
    actual: cleanText("Dungeons &amp; Dragons &amp;quot;Deluxe&amp;quot;"),
    expected: "Dungeons & Dragons &quot;Deluxe&quot;"
  },
  {
    name: "strips formatted Steam prices from labels",
    actual: stripPriceText("Buy Premium Edition - A$ 2,109.00"),
    expected: "Buy Premium Edition"
  },
  {
    name: "strips HTML and price together",
    actual: stripPriceText("<b>Deluxe</b>: US$ 109.95"),
    expected: "Deluxe"
  }
];

const failures = cases.filter((item) => item.actual !== item.expected);
const unsafeOutput = cases.filter((item) => /[<>]/.test(item.actual));

if (failures.length || unsafeOutput.length) {
  failures.forEach((failure) => {
    console.error(`${failure.name}: expected ${JSON.stringify(failure.expected)}, got ${JSON.stringify(failure.actual)}`);
  });
  unsafeOutput.forEach((failure) => {
    console.error(`${failure.name}: output still contains tag delimiters: ${JSON.stringify(failure.actual)}`);
  });
  process.exit(1);
}

console.log(`Validated ${cases.length} text sanitizer cases.`);
