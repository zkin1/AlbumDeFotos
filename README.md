# Nuestro álbum

Web pública: https://teamofer.vercel.app/

Álbum de 61 fotografías únicas en una esfera interactiva. Se muestran 14 fotos y 4 corazones de papel y se cambian y barajan automáticamente cada 40 segundos. Los corazones y sus frases también cambian de posición, en el mismo orden que usan los controles y la esfera. No hay botón «Mostrar más».

El ciclo recorre todas las fotos antes de repetir recuerdos y evita repetir una fotografía en tandas consecutivas. El temporizador se pausa al ampliar una foto o abrir un corazón, o al ocultar la pestaña; al volver a la esfera empieza un intervalo completo de 40 segundos. Las cargas lentas no generan cambios superpuestos.

Arrastra o usa la rueda para girar. Selecciona una foto para verla completa, conservando su proporción; haz clic otra vez, fuera de la imagen o pulsa Escape para cerrar. Los controles de teclado aparecen al enfocarlos con Tab.

## Desarrollo

```powershell
cd 'C:\Users\zkn\Desktop\proyecto secreto'
npm ci
npm run dev
```

Dirección local: http://127.0.0.1:3001.

## Fotografías

- `photos-originals/`: los 67 archivos originales, conservados y excluidos de Git.
- `public/photos/`: versiones WebP para la web; miniaturas de hasta 480 px y fotos ampliadas de hasta 1600 px.
- `src/config/photos.json`: manifiesto generado con dimensiones y rutas.
- `src/config/images.ts`: configuración de 14 fotos por tanda y cambio cada 40 segundos.
- `scripts/prepare_photos.py`: conversor local, requiere Python con Pillow y `heif-convert`.

Se omitieron 6 copias idénticas del álbum. Las versiones web no contienen EXIF ni XMP. Solo se cargan miniaturas en la esfera; la versión grande se carga al ampliar y se libera al cerrar.

Para volver a preparar los archivos originales:

```powershell
python scripts/prepare_photos.py --converter 'ruta/a/heif-convert.exe'
```

## Comprobaciones y producción

```powershell
npm test
npm run typecheck
npm run build
npm start
```

Las pruebas de código cubren tandas, barajado sin pérdidas, ciclos completos, álbumes pequeños, temporización de 40 segundos, pausa, cancelación, cargas lentas, errores, archivos de fotos y proporciones. La galería se comprobó en navegador en escritorio y en resoluciones móviles, incluyendo el cambio automático y la pausa al ampliar. Se corrigió el recorte en pantallas horizontales bajas. Detalles y límites en `docs/verificacion-navegador.md`.

Para Vercel, selecciona esta carpeta como raíz y el preset Next.js con `npm run build`. No requiere backend ni variables de entorno. Se usa Webpack por el fallo de Turbopack observado en este Windows.

## Corazones de origami

Cuatro corazones sustituyen cuatro tarjetas de la esfera. Comparten la rotación, el arrastre, la rueda y la perspectiva de las fotografías. Al seleccionarlos, las otras tarjetas se apartan y se abre un mensaje; al cerrar vuelven a su lugar. El barajado automático espera mientras se lee.

Las cuatro frases se editan en `src/config/heart-messages.ts`. La composición de dieciocho tarjetas se define en `src/lib/album-content.ts`.

`src/components/OrigamiHeart.tsx` también se puede reutilizar de forma independiente:

```tsx
<OrigamiHeart
  message={`Hay cosas que no necesitan\nexplicarse para sentirse.\n\nY tú eres una de ellas.`}
  size={200}
  openDuration={1.4}
  fontSize={22}
  textAlign="center"
/>
```

Admite `floating`, `floatIntensity`, `fontFamily`, `textColor`, `className`, `defaultOpen`, `onOpen` y `onClose`. Para controlarlo desde otro componente están `open` y `onOpenChange`. Su CSS está en `src/components/OrigamiHeart.css`, ya importado en el estilo global. El mensaje se dibuja en HTML al tamaño final de pantalla, fuera de la capa ampliada y filtrada del papel, para conservar letras nítidas en móvil. Conserva saltos de línea y ajusta su letra hasta un mínimo legible de 14 px; si es más largo, se lee con desplazamiento dentro del papel.

Los nueve estados transparentes están en `public/origami/`. GSAP interpola una malla con pliegues correspondientes entre las posturas y reproduce la misma secuencia en sentido inverso al cerrar. No se cambian imágenes con intervalos. Los archivos comparten canvas y punta de anclaje; se precargan una sola vez. Preparación y procedencia en `docs/origami/asset-provenance.md` y `scripts/prepare-origami.mjs`.

## Sonidos

Howler.js reproduce un crujido breve al abrir un corazón, con volumen de 0,14 y entrada y salida suaves. Arrastrar o desplazar la esfera es silencioso. El sonido se crea y carga después de un clic, toque o tecla reales; no hay reproducción automática al cargar la página ni al barajar.

Al ocultar la pestaña se detiene y necesita otra interacción para volver a habilitarse. El efecto es síntesis original local en `public/audio`; se regenera con `python scripts/prepare_audio.py`. No se utilizan grabaciones de terceros.

El icono de pestaña y el indicador de carga usan el corazón de papel original. El favicon incorpora la imagen dentro del SVG para funcionar sin recursos externos y conserva su resolución.
