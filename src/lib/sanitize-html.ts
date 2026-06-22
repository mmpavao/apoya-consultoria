import DOMPurify from "dompurify";

/**
 * Sanitiza HTML de contrato antes de renderizar com dangerouslySetInnerHTML.
 * Remove scripts, handlers de evento e URLs perigosas (XSS armazenado).
 * O conteúdo é HTML simples de template (h1/h2/p/strong/listas/tabela).
 */
const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr", "span", "div",
  "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "td", "th",
  "a", "blockquote",
];
const ALLOWED_ATTR = ["href", "target", "rel", "class"];

export function sanitizeContratoHtml(html: string): string {
  if (!html) return "";
  // SSR fallback: sem DOM disponível, remove todas as tags e mantém texto.
  if (typeof window === "undefined") {
    return html.replace(/<[^>]*>/g, "");
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "style"],
  });
}
