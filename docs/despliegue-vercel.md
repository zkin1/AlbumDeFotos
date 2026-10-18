# Publicación en Vercel

- Proyecto: `teamo` (mismo proyecto, renombrado en Vercel).
- Equipo: `zkin1s-projects`.
- Proyecto ID: `prj_JNv7NE38Ms2UkscI9xkk91acsUFD`.
- URL pública: https://teamofer.vercel.app/
- Framework: Next.js, configurado en `vercel.json`.
- La carpeta local está enlazada mediante `.vercel/project.json`, excluida de Git.
- `.vercelignore` excluye originales, documentación, herramientas, cachés y archivos de entorno. Se publican las fotografías web de `public/photos` y el papel de `public/origami`.

Para actualizar la misma web desde esta carpeta:

```powershell
npx --yes vercel@64.5.0 project inspect --scope zkin1s-projects --non-interactive
npx --yes vercel@64.5.0 deploy --prod --scope zkin1s-projects --project prj_JNv7NE38Ms2UkscI9xkk91acsUFD --non-interactive
```

Las frases se editan en `src/config/heart-messages.ts`. No hace falta crear otro proyecto al cambiarlas.

Las cuatro frases personalizadas se comprobaron en la web pública y se corrigió la medición del ancho para evitar desplazamiento innecesario en móvil. La cuarta frase queda completa en tres líneas a 390 × 844. Las 30 pruebas de código pasan, incluyendo los gestos cancelados y el clic tardío de apertura en móvil.

Despliegue anterior al arreglo del toque, con las cuatro frases nuevas y lectura móvil corregida: `dpl_EjD3p8vnRn2Xrb8PH6ZNGPBNaR1w`, estado `READY`. URL pública actual: https://teamofer.vercel.app/.

La versión actual añade el bloqueo del clic tardío y el texto nítido renderizado al tamaño final de pantalla, fuera del filtro y la escala del papel. Los cambios y sus comprobaciones están descritos en `docs/verificacion-origami.md`.
