# Verificación del origami integrado

Fecha: 18 de octubre de 2026. Compilación de producción local (`next build --webpack`, `next start`), en el navegador integrado.

- Composición: 14 fotografías y exactamente 4 corazones, intercalados en las posiciones 2, 6, 11 y 16. Los corazones son tarjetas de la misma escena WebGL, con la misma esfera, cuaternión, perspectiva, arrastre y rueda. No son objetos independientes superpuestos mientras están cerrados.
- Apertura real desde una tarjeta con el mouse, apertura con Enter desde los controles del álbum, mensajes diferentes, cierre con segundo clic, Escape y clic fuera. El papel retorna al lugar de la tarjeta. También se invirtió la secuencia antes de completarse.
- Encuadres comprobados: 1440 × 900, 390 × 844 y 844 × 390. Cambio de orientación con un corazón abierto: el papel mantiene su estado, se centra y permanece dentro del viewport.
- Se comprobó que las fotografías siguen abriéndose con su proporción natural.
- Texto de 1349 caracteres probado en una ruta temporal, posteriormente retirada de la compilación. Conserva saltos de línea, mantiene un tamaño visual mínimo de 14 px y permite desplazarse dentro de la zona de papel. El texto corto no impide cerrar haciendo clic sobre el mensaje.
- Referencia: los nueve estados originales se recortaron y normalizaron con transparencia y una punta inferior compartida. Se revisaron el cerrado y el abierto junto a la referencia. La malla interpola los pliegues entre posturas; el texto solo aparece al final. No hay mensaje incrustado en el estado abierto.
- 27 pruebas de código correctas: composición y límite de corazones, áreas transparentes sin interceptar clics, SSR y texto HTML escapado, continuidad y validez de la malla, encuadre, ajuste de texto, transparencia, álbum, fotos y temporizador. Compilación y TypeScript correctos.
- Consola de la pestaña nueva de producción sin errores ni advertencias después de abrir, cerrar, girar, cambiar de resolución y ampliar una fotografía.

Límites: las resoluciones móviles se emularon en escritorio; no se probó un teléfono físico. La preferencia de movimiento reducido está implementada y revisada en código, pero no se cambió la preferencia del sistema operativo durante la prueba. No se hizo un benchmark de FPS ni de consumo energético.

También se comprobó un ciclo automático completo en producción: a los 68 segundos de volver a la esfera, las fotografías habían cambiado y seguían presentes los mismos cuatro corazones, con 18 controles en total. No se crearon corazones adicionales al barajar.


Capturas finales: `docs/screenshots/origami-sphere-desktop.jpg` y `docs/screenshots/origami-mobile-open.jpg`.

## Corrección del toque de apertura

El botón del papel solo acepta un clic de puntero si la pulsación empezó sobre ese mismo botón. Así se ignora el clic tardío que algunos navegadores envían después del toque que montó el papel desde la esfera. La siguiente pulsación permite cerrar; teclado y tecnología de asistencia siguen funcionando sin un evento de puntero.

Se añadieron tres pruebas de regresión: clic tardío y consumo único, gesto cancelado o botón secundario, y activación por teclado o asistencia. Las 30 pruebas y TypeScript pasan. En el navegador local a 390 × 844 se abrió un corazón directamente desde la esfera y se cerró con un nuevo clic; también se abrieron los cuatro mensajes con Enter y se cerraron con clic sobre el papel. Las cuatro frases quedaron completas sin desplazamiento y la consola no registró errores ni advertencias. Esta comprobación usa resolución móvil en escritorio; queda pendiente un teléfono físico.

## Nitidez de las letras en móvil

El texto y su aviso de desplazamiento se renderizan fuera de la capa del papel que recibe escala y filtro de sombra. El ajuste de tipografía trabaja directamente en píxeles CSS de pantalla, entre 14 y 22 px, evitando ampliar una letra calculada a unos pocos píxeles locales.

Se comprobaron los cuatro mensajes a 390 × 844: todos caben completos, con tamaños nativos entre 16,25 y 18,75 px y sin ancestros con escala o filtros. La cuarta frase conserva el encuadre al cambiar a 844 × 390 y 1440 × 900. A 320 × 568 se conserva el mínimo de 14 px y aparece la zona de desplazamiento; se verificó que permite llegar al final. La apertura, el cierre con un nuevo clic y el teclado siguen funcionando. Consola sin errores ni advertencias. La captura móvil documentada se actualizó con esta versión.

La compilación final de producción (`npm run build`) y TypeScript finalizaron correctamente después del ajuste de nitidez.

## Calidad de la imagen al abrir el papel

Se eliminó la ampliación CSS de una capa pequeña: el papel ahora cambia sus dimensiones reales durante la animación. En la comprobación a 390 × 844, antes tenía 111 px de ancho de layout ampliados a 358 px con una escala de 3,2278. Ahora tiene 358 px tanto de layout como de pantalla, con transformación de escala 1. El canvas se ajusta al tamaño abierto con entre 2 y 3 píxeles de imagen por píxel CSS, incluyendo pantallas de densidad 3. Se conservan los nueve assets originales y los mensajes.

Se comprobaron los cuatro corazones a 390 × 844, con canvas de 716 px de ancho, texto completo y cierre con un nuevo clic. El cambio a 844 × 390 recalculó el canvas y mantuvo el papel centrado. Consola sin errores ni advertencias. La prueba añadida verifica cobertura de píxeles para distintos tamaños y densidades, redondeo hacia arriba y límite de memoria. Pendiente la comprobación visual en un teléfono físico.

Las 31 pruebas de código y la compilación final de producción, incluida la comprobación TypeScript, finalizaron correctamente con este cambio.
