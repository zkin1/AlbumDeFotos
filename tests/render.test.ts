import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CreativeSpace } from "../src/components/CreativeSpace";

test("server rendering provides fourteen accessible photos and four paper hearts and no load-more option", () => {
  const html = renderToStaticMarkup(createElement(CreativeSpace));
  assert.match(html, /Nuestro álbum de fotos/);
  assert.match(html, /cada 40 segundos/);
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 18);
  assert.doesNotMatch(html, /Mostrar más|Mostrar mas|Show more|Projects|About/);
  assert.doesNotMatch(html, /<nav|https?:\/\/www\.gionatannese/);
});
