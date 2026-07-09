export function sanitizeHtmlForLLM(html: string): string {
  if (!html) return "";

  // 1. Strip styling, script, and link elements
  let clean = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  clean = clean.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  clean = clean.replace(/<link[^>]*>[\s\S]*?<\/link>/gi, "");
  clean = clean.replace(/<!--[\s\S]*?-->/g, ""); // strip comments

  // 2. Strip standard footer and legal disclaimer keywords common in Chilean banking
  const legalBlocks = [
    /infórmese sobre la garantía estatal de los depósitos en su banco/gi,
    /este mensaje es confidencial y para uso exclusivo del destinatario/gi,
    /políticas de privacidad/gi,
    /no responda a este correo/gi,
    /si no desea recibir más información/gi,
    /todos los derechos reservados/gi,
    /transacciones realizadas por internet/gi,
    /este correo electrónico ha sido enviado de manera automática/gi
  ];

  for (const regex of legalBlocks) {
    clean = clean.replace(regex, "");
  }

  // 3. Remove attributes except essential structural properties (colspan, rowspan)
  clean = clean.replace(/<(\w+)(?:\s+[^>]*?)?(\s*(?:colspan|rowspan)="[^"]*")?[^>]*>/gi, (match, tag, span) => {
    const lowercaseTag = tag.toLowerCase();
    const allowedTags = [
      "html", "body", "table", "tr", "td", "th", "div", "p", 
      "span", "b", "strong", "i", "em", "h1", "h2", "h3", 
      "h4", "h5", "h6", "ul", "ol", "li"
    ];
    if (!allowedTags.includes(lowercaseTag)) {
      return ""; // strip tag entirely
    }
    return span ? `<${lowercaseTag} ${span.trim()}>` : `<${lowercaseTag}>`;
  });

  // Replace corresponding closing tags of unallowed tags
  clean = clean.replace(/<\/(\w+)[^>]*>/gi, (match, tag) => {
    const lowercaseTag = tag.toLowerCase();
    const allowedTags = [
      "html", "body", "table", "tr", "td", "th", "div", "p", 
      "span", "b", "strong", "i", "em", "h1", "h2", "h3", 
      "h4", "h5", "h6", "ul", "ol", "li"
    ];
    if (!allowedTags.includes(lowercaseTag)) {
      return "";
    }
    return `</${lowercaseTag}>`;
  });

  // 4. Compress spacing
  clean = clean.replace(/\s+/g, " ");
  clean = clean.replace(/>\s+</g, "><"); 

  return clean.trim();
}
