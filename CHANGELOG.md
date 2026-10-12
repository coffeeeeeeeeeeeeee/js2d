# js2d

Fuente canónica del motor. Se edita acá y se copia a los juegos con `./sync.sh` (`--check` sólo informa).
Pruebas: `node test/tween.test.js`, `node test/scenes.test.js`, `node test/particles.test.js`, `node test/ui.test.js`, `node test/input.test.js`, `node test/fixed.test.js`, `node test/collision.test.js`, `node test/uinav.test.js` y `node test/page.test.js` (sin navegador, con un DOM de mentira en `test/harness.js`).

## 1.11
- Colisiones, `Collision` (funciones puras, no tocan el canvas). Formas: rect `{x, y, width, height}`, círculo `{x, y, radius}`, segmento `{x1, y1, x2, y2}` y polígono (array de `{x, y}`, convexo para las de solape). Se suman a los `checkCollision*` de siempre, que siguen igual. Tocarse nada más no es chocar.
- Segmentos y rayos: `segmentRect`, `segmentCircle`, `segmentSegment`, `segmentPolygon` y `segment(s, forma)` devuelven `{ t, x, y, nx, ny }` (t de 0 a 1 a lo largo del segmento, punto de impacto y normal; si el segmento empieza adentro, `t = 0`, `inside` y normal nula). `raycast(origen, dirección, formas, maxDistance, filter)` devuelve el impacto más cercano con `shape` y `distance`.
- Solapes: `rects`, `circles`, `circleRect`, `polygons` (SAT), `polygonCircle` y `overlap(a, b)` (despacha por tipo) devuelven `null` o `{ nx, ny, depth }`: hacia dónde y cuánto mover el primero para que deje de tocar al segundo (para mover el segundo se invierte el signo).
- Movimiento: `sweepRect(rect, dx, dy, otro)` / `sweepRects(rect, dx, dy, lista)` dicen cuánto se puede avanzar antes de chocar (nada atraviesa nada, por rápido que vaya, y apoyarse en una superficie no engancha), y `moveAndCollide(rect, dx, dy, solids)` mueve primero en X y después en Y frenándose contra los rects: `{ x, y, left, right, top, bottom, solids }`. Pensado para plataformeros.
- `SpatialGrid(cellSize)`: rejilla para no comparar todo contra todo. `insert/update/remove/has/clear/size`, `query(área)`, `queryPoint(x, y)`, `querySegment(segmento)` (ordenado de cerca a lejos) y `pairs()` (cada par que se solapa, una sola vez). La caja se toma del objeto o se pasa aparte.
- Nombres globales nuevos reservados: `Collision`, `SpatialGrid`. Solo se agregan: ningún juego cambia. No se probó en un juego real; las pruebas son numéricas (`test/collision.test.js`, 38) e incluyen la rejilla contra la comparación de todos contra todos.

## 1.10
- Teclado y gamepad en la interfaz: `js.ui.navigation = true` (apagado por defecto, para no tocar a los juegos que usan flechas, Espacio o Enter). Tab / Shift+Tab (RB / LB) recorren los widgets en el orden en que se declararon; las flechas (cruceta, palanca izquierda) saltan al widget más cercano en esa dirección; Enter, Espacio o A activan; Escape o B sueltan el foco. En un `slider`, izquierda y derecha cambian el valor (de a `step`, o 1/20 del rango); en una `list`, arriba y abajo mueven la fila (salteando las deshabilitadas, con el desplazamiento acompañando) y Enter devuelve el índice; al llegar al borde de la lista el foco sigue hacia el widget de ese lado. Las flechas mantenidas repiten (a los 0,4 s, y después cada 0,06 s).
- Foco: anillo de foco (`theme.focus`) y fila resaltada en las listas (`theme.focusRow`). El anillo aparece con la primera tecla y se va con el primer clic (que igual deja el foco en el widget apretado). Estado: `js.ui.focused`, `js.ui.focusVisible`, `js.ui.wantsKeyboard` (true cuando hay un foco a la vista: esas teclas son de la interfaz y el juego no debería usarlas), y `js.ui.focus(id)` / `js.ui.blur()` para manejarlo desde el juego (por ejemplo, al abrir un menú).
- Los controles son las acciones `ui:next`, `ui:prev`, `ui:left`, `ui:right`, `ui:up`, `ui:down`, `ui:accept` y `ui:cancel`; si el juego ya las asignó con `js.input.bind`, se respetan. Las zonas (`js.ui.zones`) ahora informan su `kind` (`button`, `toggle`, `slider`, `list`).
- Uso previsto: activar la navegación en las pantallas de menú y apagarla mientras se juega (las mismas flechas y Espacio son controles de juego). `test.html` lo hace así, y `test.html#5:sl1` abre la sección 5 con el foco en el widget `sl1`.

## 1.9
- `js.ui.list` acepta `size` (tamaño de la letra).
- `test.html`: prueba visual con una sección por función (curvas y tweens, shake, escenas, partículas, interfaz, entrada con gamepad y paso fijo). Se abre directo en el navegador (`test.html#4` salta a la sección 4) y usa el propio motor para su interfaz. `test/page.test.js` la carga con un DOM de mentira, usa los controles de las siete secciones y revisa que el dibujo no reciba NaN.

## 1.8
- Widgets más configurables (para poder reproducir el estilo de un juego): `button` acepta `color` (un relleno que se oscurece al apretar y se aclara al pasar el puntero, o `{ base, hover, active }`), `textColor`, `border`, `radius`, `weight`, `shadow`, `gloss` y `fit` (achica la letra para que el texto entre en vez de recortarlo). `panel` acepta `border` y `shadow`. `theme.shadow`.
- Zonas consultables: `js.ui.hitTest(x, y)` (qué hay bajo un punto en el último cuadro dibujado, para decidir si un toque era de la interfaz o del juego), `js.ui.zones` y `js.ui.block(rect)` (una zona que tapa el puntero sin dibujar nada).
- `js.ui.clicked` se puede leer desde el update (`if (js.ui.clicked === 'jugar')`): no hace falta actuar con el valor que devuelve el widget mientras se dibuja.
- Con el dedo ya no queda resaltado el último botón tocado: `js.pointerType` ('mouse' | 'touch') y la interfaz no marca "hover" cuando el último puntero fue un toque.
- Capital Rush pasó todos sus botones y tarjetas a `js.ui`.

## 1.7
- Paso fijo de simulación, `js.fixed` (clase `FixedTimestep`): la lógica avanza en pasos de `1/hz` s (60 por defecto) sin importar los cuadros por segundo de la pantalla. `tick()` acumula el tiempo y el juego consume los pasos con `js.fixed.run((dt, i, n) => ...)`, que devuelve cuántos corrió (si el callback devuelve `false` corta). `js.fixed.alpha` (0 a 1) sirve para interpolar el dibujo entre el estado anterior y el actual. Ajustes: `hz`, `maxSteps` (5; el tiempo de más se descarta en vez de acumular deuda y `lagged` avisa), `tolerance` (2 ms; absorbe el jitter del navegador, sin esto un cuadro de 60 Hz se queda a veces sin paso y el siguiente hace dos), `paused`, `timeScale`. Contadores: `steps`, `ticks`, `time`; `reset()`.
- `js.input.consumePressed(acción)` / `consumeReleased(acción)`: para usar dentro de los pasos. Cada apretada la recibe un solo paso, aunque el cuadro tenga varios, y no se pierde si llega en un cuadro sin pasos. Lo que ningún paso consume se descarta cuando termina un `run()` con pasos. Dentro de un paso no usar `pressed()`.
- Nombre global nuevo reservado: `FixedTimestep`.
- Opcional: los juegos que ya tienen su propio acumulador (mario) no lo necesitan; no se migró nada.

## 1.6
- Entrada por acciones, `js.input` (clase `ActionMap`), actualizada sola al principio de `tick()`: `bind(acción, ...fuentes)`, `bindAll({...})`, `unbind`, `bindings`, `actions`. Fuentes: teclas por `KeyboardEvent.code` (`'Space'`, `'KeyW'`), `'mouse:left|middle|right'` (el toque cuenta como `mouse:left`) y gamepad `'pad:A'`, `'pad:LB'`, `'pad:Up'`, `'pad:LStickLeft'`, `'pad:RStickUp'`... Lectura: `isDown`, `pressed`, `released` (un solo cuadro), `value` (0 a 1, analógico), `axis(negativa, positiva)`, `vector(izq, der, arriba, abajo)` (largo máximo 1).
- Gamepad: zona muerta radial (`js.input.deadzone`, 0,2) con reescalado, varios gamepads sumados, `gamepads`, `onGamepad(fn)`, `rumble({ duration, weak, strong })`. `js.input.device` dice cuál se usó último (`keyboard`, `mouse`, `gamepad`).
- Reasignar controles: `captureNext({ cancel, mouse })` devuelve una promesa con el próximo control que se apriete (para pasárselo a `bind`); `exportBindings()` / `importBindings(obj)` para guardar la configuración; `setVirtual(acción, valor)` para botones táctiles en pantalla.
- Teclado: `js.keyLatch` registra las teclas apretadas desde el último `tick()`, así un golpe más corto que un cuadro no se pierde; y al perder el foco de la ventana se sueltan todas las teclas (antes quedaban apretadas).
- Nombre global nuevo reservado: `ActionMap`.
- Limitaciones: los gamepads conectados se suman en uno solo (sin jugador 1 / jugador 2), y `mouse:left` mira el estado (un clic más corto que un cuadro no se registra).

## 1.5
- Interfaz en modo inmediato, `js.ui` (clase `UI`): `begin()` una vez por cuadro y después `button(id, rect, texto, { primary, disabled, size })` (devuelve true al tocarlo), `toggle(id, rect, valor, texto)` y `slider(id, rect, valor, min, max, { step })` (devuelven el valor nuevo), `list(id, rect, items, { rowHeight, selected })` (devuelve el índice tocado o -1; rueda y arrastre; `getScroll`/`setScroll`), `panel(rect, { title, blocks })`, `label(texto, x, y, opts)`, `rows()`/`columns()` para repartir un rectángulo. Estado: `hot`, `active`, `clicked`, `wantsPointer` (para que el juego no use como propio un toque que cayó en la interfaz). Apariencia: `js.ui.theme` y `js.ui.scale`. La zona tocable se arma con lo declarado en el cuadro anterior: un widget nuevo responde desde el cuadro siguiente, y gana el último declarado.
- Flancos del puntero: `js.consumePointerEvents()` devuelve y reinicia `{ pressed, released, canceled, pressX/Y, releaseX/Y }` (mouse y toque), para no perder un toque que empieza y termina entre dos cuadros.
- Nombre global nuevo reservado: `UI`.
- Sin teclado ni foco todavía: la interfaz es sólo de puntero.

## 1.4
- Partículas: `js.particles.emit(x, y, cantidad, opciones | preset)` para ráfagas y `js.particles.stream(x, y, opciones, porSegundo, duración)` para emisores continuos (devuelve `{ x, y, rate, active, stop() }`). Pool de objetos (tope `max`, 2000), avance automático en `tick()`, dibujo con `js.particles.draw()` donde el juego quiera. Opciones: `speed`, `angle`, `spread`, `life`, `size`/`endSize`, `color` (lista o único)/`endColor`, `alpha`/`endAlpha`, `gravity`, `drag`, `spin`, `rotation`, `radius`, `shape` (`circle`, `square`, `line`, `image`), `image`, `additive`, `ease`. Cualquier número admite `[mínimo, máximo]`. Presets: `sparks`, `smoke`, `confetti`, `explosion`; `{ preset: 'confetti', gravity: 400 }` los modifica.
- Nombre global nuevo reservado: `ParticleSystem`.

## 1.3
- Screen shake: `js.shake(magnitud, segundos, { frequency, decay, rotation, axis })` devuelve `{ stop() }`; `js.stopShake()`. Se aplica en `clearBg()` (el fondo no se mueve, todo lo demás sí, cámara incluida). Los shakes simultáneos se suman. `js.shakeEnabled = false` lo apaga (opción de accesibilidad). `js.withoutShake(fn)` dibuja sin temblor ni cámara, para el HUD.
- Escenas: `js.scenes.add(nombre, escena)`, `switch(nombre, params, { fade, color })`, `push`, `pop`, `update(dt)`, `draw()`, `current`, `stack`, `transitioning`. Una escena es un objeto con `enter(params, from)`, `exit(to)`, `pause()`, `resume()`, `update(dt)`, `draw()` (todos opcionales) y `overlay: true` si deja ver la de abajo. Sin `update()` durante el fundido. El juego llama a `js.scenes.update(dt)` y `js.scenes.draw()` desde su loop.

## 1.3
- Screen shake: `js.shake(magnitud, segundos, { frequency, decay, rotation, axis })` devuelve `{ stop() }`; `js.stopShake()`. Se aplica en `clearBg()` (el fondo no se mueve, todo lo demás sí, cámara incluida). Los shakes simultáneos se suman. `js.shakeEnabled = false` lo apaga (opción de accesibilidad). `js.withoutShake(fn)` dibuja sin temblor ni cámara, para el HUD.
- Escenas: `js.scenes.add(nombre, escena)`, `switch(nombre, params, { fade, color })`, `push`, `pop`, `update(dt)`, `draw()`, `current`, `stack`, `transitioning`. Una escena es un objeto con `enter(params, from)`, `exit(to)`, `pause()`, `resume()`, `update(dt)`, `draw()` (todos opcionales) y `overlay: true` si deja ver la de abajo. Sin `update()` durante el fundido. El juego llama a `js.scenes.update(dt)` y `js.scenes.draw()` desde su loop.
- Las clases globales del motor se llaman `Tween`, `TweenManager` y `SceneManager`: ningún juego puede declarar esos nombres (la de truco-ar pasó a `CardTween`).

## 1.2
- `Ease`: 31 curvas de suavizado (`linear` + in/out/inOut de Quad, Cubic, Quart, Quint, Sine, Expo, Circ, Back, Elastic, Bounce). `Ease.get(nombre | función)`.
- `js.tween(objeto, props, segundos, opts)`: anima propiedades numéricas. Opciones: `ease`, `delay`, `repeat`, `yoyo`, `from`, `onStart`, `onUpdate`, `onComplete`, `overwrite`. Devuelve un `Tween` (`cancel()`, `finish()`, `active`, `finished` como promesa). Se avanza sola en `tick()`.
- `js.after(segundos, fn)`, `js.killTweens(objeto, props?)`, `js.clearTweens()`, `js.tweens.count`.
- `destroy()` limpia los tweens.

## 1.1
- Unificación de las seis copias (capital-rush, mario, digital-circus-vn, f1-simulator, bot-factory, truco-ar).
- `drawAnimatedSprite(name, dt, pivot)` ahora pide `dt`; se perdieron `setSpriteAnimation`, `addFramesToAnimation` y `animate` (sin uso).
