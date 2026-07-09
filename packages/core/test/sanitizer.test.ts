import { describe, it, expect } from "vitest";
import { sanitizeHtmlForLLM } from "../src/sanitizer";

describe("HTML Sanitizer", () => {
  it("should strip style and script blocks", () => {
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
    const clean = sanitizeHtmlForLLM(rawHtml);
    expect(clean).not.toContain("body { color: red; }");
    expect(clean).not.toContain('console.log("hello")');
    expect(clean).toContain("<table><tr><td>Content</td></tr></table>");
  });

  it("should strip legal disclaimers", () => {
    const rawHtml = `
      <div>
        <p>Transfer: $10.000</p>
        <p>Infórmese sobre la garantía estatal de los depósitos en su banco</p>
      </div>
    `;
    const clean = sanitizeHtmlForLLM(rawHtml);
    expect(clean).not.toContain("garantía estatal");
    expect(clean).toContain("Transfer: $10.000");
  });

  it("should clean tag attributes except structural ones", () => {
    const rawHtml = `
      <table border="1" class="my-table" style="color: blue;">
        <tr id="row-1">
          <td colspan="2" class="cell">Value</td>
        </tr>
      </table>
    `;
    const clean = sanitizeHtmlForLLM(rawHtml);
    expect(clean).toContain('<table>'); // tag attributes stripped
    expect(clean).toContain('<td colspan="2">'); // colspan preserved
    expect(clean).not.toContain("my-table");
    expect(clean).not.toContain("row-1");
  });
});
