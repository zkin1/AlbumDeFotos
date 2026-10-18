# Verificación en navegador — 18 de octubre de 2026

Verificado en el navegador integrado con el servidor de producción local (`npm start`).

| Comprobación | Resultado |
| --- | --- |
| Carga y visualización de las 18 fotos | Correcto |
| Giro con arrastre y rueda | Correcto; la rueda cambió la vista manteniendo la misma tanda |
| Ampliación de fotos horizontales y verticales | Correcto, con su proporción completa |
| Cierre al pulsar fuera y con Escape | Correcto |
| Acceso con Tab y apertura con Enter | Correcto |
| Cambio automático de tanda | Observado durante la sesión; intervalo de 40 segundos cubierto también por pruebas de código |
| Pausa al ampliar | La misma foto y tanda permanecieron tras 41 segundos |
| Reanudación al cerrar | La tanda seguía igual a los 28 segundos y había cambiado a los 47 segundos |
| Escritorio, 1440 × 900 | Correcto |
| Vista móvil, 390 × 844 | Correcto, sin desbordamiento horizontal |
| Vista horizontal, 844 × 390 | Correcto después del ajuste del radio |
| Navegación y botón «Mostrar más» | Ausentes |
| Errores y advertencias de consola | Ninguno observado |

Se detectó un recorte de algunas fotos en pantallas bajas. Se corrigió el radio de la esfera para reservar espacio para las esquinas de las tarjetas, incluyendo la ampliación producida por la perspectiva. La prueba nueva reproduce el fallo anterior y verifica que las tarjetas permanecen dentro de los márgenes en siete tamaños de pantalla.

Pasaron las 19 pruebas, TypeScript y la compilación de producción. Capturas en `docs/screenshots/`.

Las vistas móviles se comprobaron cambiando el tamaño del navegador; queda pendiente la prueba en un teléfono físico y de sus gestos táctiles. No se comprobó el sitio desplegado ni se subieron estos cambios a GitHub.
