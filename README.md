# Galería de imágenes

Solo la esfera de 18 imágenes sobre fondo blanco: entrada en círculo, giro automático, arrastre con inercia, rueda, gestos táctiles y ampliación al seleccionar. Haz clic de nuevo, fuera de la imagen o pulsa Escape para cerrar. No incluye menús, fichas ni enlaces de proyectos.

## Abrir en local

```powershell
cd 'C:\Users\zkn\Desktop\proyecto secreto'
npm ci
npm run dev
```

Abrir http://127.0.0.1:3001.

## Reemplazar los placeholders

1. Guarda las fotografías en `public/images/`.
2. Cambia la propiedad `src` de cada entrada en `src/config/images.ts`, por ejemplo `/images/foto-01.jpg`.
3. Ajusta `alt` con la descripción de cada imagen.

Los 18 placeholders actuales son SVG neutros. Las fotografías se recortan a marcos 3:4 automáticamente, sin cambiar componentes ni animaciones. No se han incluido fotografías.

## Producción

```powershell
npm test
npm run typecheck
npm run build
npm start
```

Para Vercel, selecciona esta carpeta como raíz del proyecto y el preset Next.js. Usa `npm run build` como comando de compilación. No requiere variables de entorno ni backend.

Se utiliza Webpack porque Turbopack presentó un fallo interno al iniciar sus procesos en este equipo Windows.

## Archivos principales

- `src/config/images.ts`: todas las referencias de imágenes.
- `src/lib/space-scene.ts`: escena Three.js, GSAP, entrada e interacciones.
- `src/lib/geometry.ts`: proporciones, esfera y tamaños responsive.
- `src/components/CreativeSpace.tsx`: montaje de la galería y acceso por teclado.
- `src/app/globals.css`: estilos.

Se inspeccionó la referencia y se probaron rotación, expansión y gestos táctiles antes de la simplificación solicitada. Después se retiraron navegación, fichas y herramientas de comparación. No se hicieron más pruebas de navegador después de la instrucción de detenerlas. No se afirma una coincidencia pixel-perfect.
