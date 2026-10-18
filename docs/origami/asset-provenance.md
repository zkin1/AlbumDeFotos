# Papel de origami

Los nueve estados proceden de la referencia del proyecto. Se recortaron individualmente, se eliminó únicamente el fondo negro conectado al exterior y se alineó la punta inferior en (360, 510), canvas 720 × 560, escala 1,35. Se conserva la tinta de recibo.

El centro del estado nueve se limpió usando una pequeña muestra del papel preparado con la herramienta integrada imagegen. No hay mensaje fijo en los assets finales. El original generado se conserva en open-paper-source.png.

Prompt de edición: extraer únicamente el noveno corazón abierto, mantener silueta, textura, tinta, pliegues y bordes; eliminar «siempre acá.» y continuar el papel; fondo transparente real, sin números, sin texto añadido y sin rediseñar el objeto.

Regenerar: node scripts/prepare-origami.mjs

## Edición asistida del centro del papel

Se utilizó la herramienta integrada `imagegen` (no la API ni la CLI) para preparar `docs/origami/open-paper-source.png`. Solo se toma una muestra de su centro en el asset final nueve; las siluetas, los pliegues y los otros ocho estados proceden de la referencia original. Los assets que consume el componente están en `public/origami/heart-1.webp` hasta `heart-9.webp`.

Prompt exacto:

> Use case: background-extraction / precise-object-edit. Edit target: supplied origami heart reference sheet. Produce ONE isolated cutout of ONLY the ninth (bottom-right, fully unfolded) receipt-paper heart, at high resolution on a real transparent background. Closely preserve its exact silhouette, scale proportions, off-white aged receipt texture, crinkles, printed fragments on upper and side flaps, irregular torn edges, fold locations, natural crease shadows, top heart lobes and lower triangular tip. Remove the words 'siempre acá.' from the central recessed paper panel, seamlessly continuing the exact same paper texture there. Leave this central panel blank so real HTML text can later be placed there. No digits or captions outside the paper, no black background, no checkerboard baked into pixels, no new text, no ornament or redesign, no vector or cartoon finish. Top-down, same angle as frame nine; center full object with a little transparent padding.
