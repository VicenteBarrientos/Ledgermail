"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const sanitizer_1 = require("../src/sanitizer");
(0, vitest_1.describe)("HTML Sanitizer", () => {
    (0, vitest_1.it)("should strip style and script blocks", () => {
        const rawHtml = `
      <html>
        <head>
          <style>body { color: red; }</style>
          <script>console.log("hello");</script>
        </head>
        <body>
          <div>
            <table>
              <tr><td>Content</td></tr>
            </table>
          </div>
        </body>
      </html>
    `;
        const clean = (0, sanitizer_1.sanitizeHtmlForLLM)(rawHtml);
        (0, vitest_1.expect)(clean).not.toContain("body { color: red; }");
        (0, vitest_1.expect)(clean).not.toContain('console.log("hello")');
        (0, vitest_1.expect)(clean).toContain("<table><tr><td>Content</td></tr></table>");
    });
    (0, vitest_1.it)("should strip legal disclaimers", () => {
        const rawHtml = `
      <div>
        <p>Transfer: $10.000</p>
        <p>Infórmese sobre la garantía estatal de los depósitos en su banco</p>
      </div>
    `;
        const clean = (0, sanitizer_1.sanitizeHtmlForLLM)(rawHtml);
        (0, vitest_1.expect)(clean).not.toContain("garantía estatal");
        (0, vitest_1.expect)(clean).toContain("Transfer: $10.000");
    });
    (0, vitest_1.it)("should clean tag attributes except structural ones", () => {
        const rawHtml = `
      <table border="1" class="my-table" style="color: blue;">
        <tr id="row-1">
          <td colspan="2" class="cell">Value</td>
        </tr>
      </table>
    `;
        const clean = (0, sanitizer_1.sanitizeHtmlForLLM)(rawHtml);
        (0, vitest_1.expect)(clean).toContain('<table>'); // tag attributes stripped
        (0, vitest_1.expect)(clean).toContain('<td colspan="2">'); // colspan preserved
        (0, vitest_1.expect)(clean).not.toContain("my-table");
        (0, vitest_1.expect)(clean).not.toContain("row-1");
    });
});
//# sourceMappingURL=sanitizer.test.js.map