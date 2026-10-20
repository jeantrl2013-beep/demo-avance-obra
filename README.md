# Demo de avance de obra — Centro Poblado Demo

Demostración de un sistema de control de avance para obras de saneamiento rural, con una
**obra 100% inventada**. Ningún nombre, coordenada ni dato viene de una obra real.

- 40 UBS (unidades básicas de saneamiento: baño con biodigestor) en 2 sistemas, en un
  lugar ficticio de la sierra de Áncash.
- Una red de agua ramificada de unos 6 km: 1 reservorio, 4 cámaras rompe-presión (CRP),
  5 zonas y 17 ejes, con un tramo de HDPE superficial en ladera.
- Los usuarios son cargos (MAESTRO, ING1, ING2), no personas.

En la obra real, el campo reporta desde una app, los datos quedan en una hoja de cálculo y
una API calcula el avance. Este demo usa **el mismo cálculo**, con datos generados.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página. Lee `window.DATOS_DEMO`; se abre con doble clic, sin servidor. |
| `datos_demo.js` | Los datos ya calculados. Lo escribe el generador; no se edita a mano. |
| `generar_demo.js` | Inventa la obra (catálogo de fases, padrón, registros y la red) y la pasa por el cálculo. |
| `calculo_avance.js` | El cálculo de avance de las UBS. |
| `calculo_redes.js` | El cálculo de la red: zanja base, avance por etapa y eje, ejes "para revisar", totales por zona. |

## Regenerar los datos

```
node generar_demo.js
```

No necesita dependencias. Usa una semilla fija, así que cada corrida da el mismo archivo.

## Cómo se pinta la red

- Cada eje es un ramal seguido, con su progresiva desde la 0+000 aguas arriba. Cada etapa
  (excavación, cama de apoyo, tubería, tapado y prueba) se guarda como "hasta qué metro
  llegó".
- Zanja base del eje = largo en planta − metros de HDPE. El pintado es proporcional sobre
  la zanja:
  - gris = sin empezar;
  - ámbar = zanja excavada;
  - azul = tubería instalada;
  - verde = tapada y probada.

  El HDPE va punteado en blanco y no entra al avance de zanja.
- Si la wincha da más que la base, el pintado llega al 100% y no se pasa. Si supera la
  base en más de 10%, el eje sale "para revisar".
