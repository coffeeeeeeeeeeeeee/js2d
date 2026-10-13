# js2d

Motor de canvas 2D genérico, en JavaScript sin dependencias. Este es el código fuente de referencia: los juegos
llevan una copia de `js2d.js` (se mantienen sincronizadas con `sync.sh`).

- `js2d.js`: el motor. Versión y novedades en `CHANGELOG.md`.
- `sync.sh`: copia `js2d.js` a los juegos que lo usan (`./sync.sh --check` sólo informa cuáles están desactualizados).
- `test.html`: prueba visual, una sección por función. Abrirla en el navegador (`test.html#4` abre la cuarta sección).
- `test/`: pruebas en Node, sin navegador (un DOM de mentira en `test/harness.js`).

## Probar

```
for t in tween scenes particles ui uinav dropdown input fixed collision page; do node test/$t.test.js | tail -1; done
```

## Reglas

- Los nombres de funciones y clases son genéricos, sin el nombre del motor (`Tween`, `SceneManager`, `ParticleSystem`, `Collision`, `SpatialGrid`...).
  Esos nombres globales quedan reservados: ningún juego puede declararlos (si choca, se renombra la clase del juego).
- Se edita acá y después se corre `./sync.sh`; los `js2d.js` de los juegos no se tocan a mano.
