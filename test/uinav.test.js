// Pruebas del teclado y el foco de la interfaz. Correr: node test/uinav.test.js
const { load, runner } = require('./harness');
const { test, near, eq, done } = runner();

const env = load();
let pads = [];
env.sandbox.navigator.getGamepads = () => pads;

let clock = 1000;
// Un cuadro: tick (actualiza la entrada), begin y lo que declare `fn`.
const frame = (js, fn = () => {}) => { js.tick(clock += 16); js.ui.begin(); return fn(js.ui); };
const mk = () => { pads = []; const js = env.make(); js.ui.navigation = true; frame(js); return js; };
const press = (js, code) => { js.fireWindow('keydown', { code }); };
const release = (js, code) => { js.fireWindow('keyup', { code }); };
// Una pulsación como la de un teclado real: un cuadro con la tecla suelta, otro con la tecla apretada, y se suelta.
// (Si se soltara y se volviera a apretar entre dos cuadros, el motor no vería la segunda pulsación.)
const key = (js, code, fn) => { frame(js, fn); press(js, code); const r = frame(js, fn); release(js, code); return r; };
const BTN = (x, y) => ({ x, y, width: 80, height: 30 });

// tres botones en fila, y un cuarto abajo
const fila = (ui, extra = {}) => {
	ui.button('a', BTN(10, 10), 'A'); ui.button('b', BTN(110, 10), 'B'); ui.button('c', BTN(210, 10), 'C');
	ui.button('d', BTN(110, 100), 'D', extra.d || {});
};
const draw = js => frame(js, ui => fila(ui));
const mkFila = () => { const js = mk(); draw(js); draw(js); return js; };

test('por defecto la navegación está apagada: Tab no hace nada', () => {
	pads = []; const js = env.make(); frame(js); draw(js);
	key(js, 'Tab', fila); eq(js.ui.focused, null); eq(js.ui.wantsKeyboard, false);
});
test('Tab muestra el foco en el primer widget; otra vez, pasa al siguiente', () => {
	const js = mkFila();
	key(js, 'Tab', fila); eq(js.ui.focusVisible, true); eq(js.ui.focused, 'a'); eq(js.ui.wantsKeyboard, true);
	key(js, 'Tab', fila); eq(js.ui.focused, 'b');
	key(js, 'Tab', fila); eq(js.ui.focused, 'c');
	key(js, 'Tab', fila); eq(js.ui.focused, 'd');
	key(js, 'Tab', fila); eq(js.ui.focused, 'a');                // da la vuelta
});
test('Shift+Tab va para atrás, y desde sin foco arranca por el último', () => {
	const js = mkFila();
	press(js, 'ShiftLeft'); key(js, 'Tab', fila); eq(js.ui.focused, 'd');
	key(js, 'Tab', fila); eq(js.ui.focused, 'c');
	release(js, 'ShiftLeft');
});
test('las flechas saltan al widget más cercano en esa dirección', () => {
	const js = mkFila();
	key(js, 'Tab', fila); eq(js.ui.focused, 'a');
	key(js, 'ArrowRight', fila); eq(js.ui.focused, 'b');
	key(js, 'ArrowRight', fila); eq(js.ui.focused, 'c');
	key(js, 'ArrowRight', fila); eq(js.ui.focused, 'c');         // no hay nada más a la derecha
	key(js, 'ArrowLeft', fila); eq(js.ui.focused, 'b');
	key(js, 'ArrowDown', fila); eq(js.ui.focused, 'd');
	key(js, 'ArrowDown', fila); eq(js.ui.focused, 'd');
	key(js, 'ArrowUp', fila); eq(js.ui.focused, 'b');            // sube al de arriba más derecho
});
test('la primera tecla de navegación sólo muestra el foco; no mueve', () => {
	const js = mkFila();
	js.ui.focus('c'); js.ui.blur(); js.ui.focused = null;
	// un clic dejó el foco en 'b' sin anillo
	const z = js.ui.zones.find(z => z.id === 'b');
	js.fireWindow('mousemove', {}); js.fire('mousemove', { clientX: z.x + 5, clientY: z.y + 5 });
	js.fire('mousedown', { button: 0 }); js.fire('mouseup', { button: 0 });
	frame(js, fila); frame(js, fila);
	eq(js.ui.focused, 'b'); eq(js.ui.focusVisible, false); eq(js.ui.wantsKeyboard, false);
	key(js, 'ArrowRight', fila);
	eq(js.ui.focusVisible, true); eq(js.ui.focused, 'b');      // se mostró donde estaba
	key(js, 'ArrowRight', fila); eq(js.ui.focused, 'c');
});
test('Enter y Espacio activan el botón con foco, y lo devuelve el widget', () => {
	const js = mkFila();
	key(js, 'Tab', fila);
	let got = null;
	key(js, 'Enter', ui => { fila(ui); });
	eq(js.ui.clicked, 'a');
	key(js, 'ArrowRight', fila);
	let r; press(js, 'Space'); frame(js, ui => { ui.button('a', BTN(10, 10), 'A'); r = ui.button('b', BTN(110, 10), 'B'); }); release(js, 'Space');
	eq(r, true); eq(js.ui.clicked, 'b');
});
test('Enter con el foco oculto no activa nada (es del juego)', () => {
	const js = mkFila();
	key(js, 'Enter', fila); eq(js.ui.clicked, null); eq(js.ui.focusVisible, false);
	key(js, 'Space', fila); eq(js.ui.clicked, null);
});
test('Escape suelta el foco; con el foco oculto no hace nada', () => {
	const js = mkFila();
	key(js, 'Escape', fila); eq(js.ui.focusVisible, false);
	key(js, 'Tab', fila); eq(js.ui.wantsKeyboard, true);
	key(js, 'Escape', fila); eq(js.ui.focused, null); eq(js.ui.wantsKeyboard, false);
});
test('un botón deshabilitado no recibe el foco', () => {
	const js = mkFila();
	const f = ui => { ui.button('a', BTN(10, 10), 'A'); ui.button('x', BTN(110, 10), 'X', { disabled: true }); ui.button('c', BTN(210, 10), 'C'); };
	frame(js, f); frame(js, f);
	key(js, 'Tab', f); key(js, 'Tab', f); eq(js.ui.focused, 'c');
});
test('si el widget con foco deja de declararse, el foco se suelta', () => {
	const js = mkFila();
	key(js, 'Tab', fila); key(js, 'Tab', fila); eq(js.ui.focused, 'b');
	const sinB = ui => { ui.button('a', BTN(10, 10), 'A'); ui.button('c', BTN(210, 10), 'C'); };
	frame(js, sinB); frame(js, sinB);
	key(js, 'Tab', sinB);                                         // detecta que 'b' no está y arranca de nuevo
	eq(js.ui.focused, 'a');
});
test('un clic quita el anillo y da el foco al widget apretado', () => {
	const js = mkFila();
	key(js, 'Tab', fila); eq(js.ui.focusVisible, true);
	const z = js.ui.zones.find(z => z.id === 'c');
	js.fire('mousemove', { clientX: z.x + 5, clientY: z.y + 5 });
	js.fire('mousedown', { button: 0 }); frame(js, fila); js.fire('mouseup', { button: 0 }); frame(js, fila);
	eq(js.ui.focusVisible, false); eq(js.ui.focused, 'c');
});
test('focus(id) y blur() desde el juego', () => {
	const js = mkFila();
	js.ui.focus('d'); eq(js.ui.focused, 'd'); eq(js.ui.focusVisible, true);
	frame(js, fila); eq(js.ui.wantsKeyboard, true);
	js.ui.blur(); eq(js.ui.wantsKeyboard, false);
});
test('con navigation apagada el foco visible se oculta solo', () => {
	const js = mkFila();
	key(js, 'Tab', fila); eq(js.ui.focusVisible, true);
	js.ui.navigation = false; frame(js, fila);
	eq(js.ui.focusVisible, false); eq(js.ui.wantsKeyboard, false);
});
test('el botón con foco dibuja el anillo; sin foco, no', () => {
	const js = mkFila();
	const anillo = () => env.calls.some(c => c[0] === 'set:strokeStyle' && c[1] === js.ui.theme.focus);
	env.calls.length = 0; frame(js, fila); eq(anillo(), false);
	key(js, 'Tab', fila);
	env.calls.length = 0; frame(js, fila); eq(anillo(), true);
});
test('el anillo usa el color del tema', () => {
	const js = mkFila(); js.ui.theme.focus = '#ff00aa';
	key(js, 'Tab', fila);
	env.calls.length = 0; frame(js, fila);
	eq(env.calls.some(c => c[0] === 'set:strokeStyle' && c[1] === '#ff00aa'), true);
});

// --- toggle ---
test('toggle: Enter lo cambia', () => {
	const js = mk(); let v = false;
	const f = ui => { v = ui.toggle('t', { x: 10, y: 10, width: 200, height: 26 }, v, 'Sonido'); };
	frame(js, f); frame(js, f);
	key(js, 'Tab', f); eq(v, false);
	key(js, 'Enter', f); eq(v, true);
	key(js, 'Space', f); eq(v, false);
});

// --- slider ---
const SL = { x: 10, y: 10, width: 200, height: 24 };
test('slider: izquierda y derecha cambian el valor; arriba y abajo cambian de widget', () => {
	const js = mk(); let v = 0.5;
	const f = ui => { v = ui.slider('s', SL, v, 0, 1); ui.button('b', { x: 10, y: 80, width: 80, height: 30 }, 'B'); };
	frame(js, f); frame(js, f);
	key(js, 'Tab', f); eq(js.ui.focused, 's');
	key(js, 'ArrowRight', f); near(v, 0.55, 1e-9);
	key(js, 'ArrowLeft', f); key(js, 'ArrowLeft', f); near(v, 0.45, 1e-9);
	key(js, 'ArrowDown', f); eq(js.ui.focused, 'b');
});
test('slider: con step avanza de a un paso y se queda en el rango', () => {
	const js = mk(); let v = 0;
	const f = ui => { v = ui.slider('s', SL, v, 0, 10, { step: 2 }); };
	frame(js, f); frame(js, f); key(js, 'Tab', f);
	key(js, 'ArrowRight', f); eq(v, 2);
	for (let i = 0; i < 10; i++) key(js, 'ArrowRight', f);
	eq(v, 10);
	for (let i = 0; i < 10; i++) key(js, 'ArrowLeft', f);
	eq(v, 0);
});
test('una flecha mantenida repite después de una pausa', () => {
	const js = mk(); let v = 0;
	const f = ui => { v = ui.slider('s', SL, v, 0, 100, { step: 1 }); };
	frame(js, f); frame(js, f); key(js, 'Tab', f);
	press(js, 'ArrowRight');
	frame(js, f); eq(v, 1);                                       // el primer paso
	for (let i = 0; i < 10; i++) frame(js, f);                    // 160 ms: todavía no repite
	eq(v, 1);
	for (let i = 0; i < 50; i++) frame(js, f);                    // pasan los 0,4 s y repite cada 0,06 s
	if (!(v > 6 && v < 14)) throw new Error('repetición fuera de lo esperado: ' + v);
	const antes = v; release(js, 'ArrowRight');
	for (let i = 0; i < 10; i++) frame(js, f);
	eq(v, antes);                                                 // soltar la flecha frena
});

// --- lista ---
const LST = { x: 10, y: 50, width: 150, height: 72 };           // 2 filas visibles de 36
const ITEMS = ['uno', { label: 'dos', disabled: true }, 'tres', 'cuatro', 'cinco', 'seis'];
test('lista: arriba y abajo mueven la fila, saltean las deshabilitadas y Enter la devuelve', () => {
	const js = mk(); let got = -2;
	const f = ui => { got = ui.list('l', LST, ITEMS); };
	frame(js, f); frame(js, f); key(js, 'Tab', f);
	key(js, 'Enter', f); eq(got, 0);                              // empieza en la primera habilitada
	key(js, 'ArrowDown', f); key(js, 'Enter', f); eq(got, 2);     // se salteó la deshabilitada
	key(js, 'ArrowDown', f); key(js, 'Enter', f); eq(got, 3);
	key(js, 'ArrowUp', f); key(js, 'ArrowUp', f); key(js, 'Enter', f); eq(got, 0);
	frame(js, f); eq(got, -1);                                    // sólo en el cuadro del Enter
});
test('lista: el desplazamiento acompaña a la fila con foco', () => {
	const js = mk();
	const f = ui => ui.list('l', LST, ITEMS);
	frame(js, f); frame(js, f); key(js, 'Tab', f);
	for (let i = 0; i < 4; i++) key(js, 'ArrowDown', f);
	// fila 5 (índice 5), a 72 px de alto con filas de 36: el scroll tiene que dejarla a la vista
	near(js.ui.getScroll('l'), 6 * 36 - 72);
	for (let i = 0; i < 6; i++) key(js, 'ArrowUp', f);
	eq(js.ui.getScroll('l'), 0);
});
test('lista: al llegar al borde el foco sigue hacia el widget de ese lado', () => {
	const js = mk();
	const f = ui => { ui.button('arriba', { x: 10, y: 10, width: 100, height: 30 }, 'A'); ui.list('l', LST, ITEMS); ui.button('abajo', { x: 10, y: 140, width: 100, height: 30 }, 'B'); };
	frame(js, f); frame(js, f);
	key(js, 'Tab', f); key(js, 'Tab', f); eq(js.ui.focused, 'l');
	key(js, 'ArrowUp', f); eq(js.ui.focused, 'arriba');          // ya estaba en la primera fila
	key(js, 'ArrowDown', f); eq(js.ui.focused, 'l');
	for (let i = 0; i < 8; i++) key(js, 'ArrowDown', f);
	eq(js.ui.focused, 'abajo');
});
test('lista: un clic con el mouse también deja la fila para el teclado', () => {
	const js = mk(); let got = -2;
	const f = ui => { got = ui.list('l', LST, ITEMS); };
	frame(js, f); frame(js, f);
	const p = { clientX: 40, clientY: 50 + 36 * 2 + 4 };          // la fila "tres" no entra: usar scroll
	js.ui.setScroll('l', 36 * 2); frame(js, f);
	js.fire('mousemove', { clientX: 40, clientY: 60 }); js.fire('mousedown', { button: 0 }); frame(js, f); js.fire('mouseup', { button: 0 }); frame(js, f);
	eq(got, 2);
	key(js, 'Tab', f); key(js, 'ArrowDown', f); key(js, 'Enter', f); eq(got, 3);
});
test('lista: la fila con foco se dibuja resaltada', () => {
	const js = mk();
	const f = ui => ui.list('l', LST, ITEMS);
	frame(js, f); frame(js, f);
	const hay = () => env.calls.some(c => c[0] === 'set:fillStyle' && c[1] === js.ui.theme.focusRow);
	env.calls.length = 0; frame(js, f); eq(hay(), false);
	key(js, 'Tab', f); env.calls.length = 0; frame(js, f); eq(hay(), true);
});

// --- gamepad y controles propios ---
const pad = (o = {}) => ({ index: 0, id: 'pad', connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0], ...o });
test('gamepad: la cruceta navega, A activa y B suelta el foco', () => {
	const js = mkFila();
	const p = pad(); pads = [p];
	p.buttons[15] = { pressed: true, value: 1 }; frame(js, fila); p.buttons[15] = { pressed: false, value: 0 }; frame(js, fila);   // derecha: muestra
	eq(js.ui.focusVisible, true); eq(js.ui.focused, 'a');
	p.buttons[15] = { pressed: true, value: 1 }; frame(js, fila); p.buttons[15] = { pressed: false, value: 0 }; frame(js, fila);
	eq(js.ui.focused, 'b');
	p.buttons[0] = { pressed: true, value: 1 }; frame(js, fila); eq(js.ui.clicked, 'b'); p.buttons[0] = { pressed: false, value: 0 }; frame(js, fila);
	p.buttons[1] = { pressed: true, value: 1 }; frame(js, fila); p.buttons[1] = { pressed: false, value: 0 };
	eq(js.ui.focused, null);
});
test('gamepad: RB y LB recorren en orden, y la palanca navega', () => {
	const js = mkFila();
	const p = pad(); pads = [p];
	p.buttons[5] = { pressed: true, value: 1 }; frame(js, fila); p.buttons[5] = { pressed: false, value: 0 }; frame(js, fila);
	eq(js.ui.focused, 'a');
	p.buttons[5] = { pressed: true, value: 1 }; frame(js, fila); p.buttons[5] = { pressed: false, value: 0 }; frame(js, fila);
	eq(js.ui.focused, 'b');
	p.buttons[4] = { pressed: true, value: 1 }; frame(js, fila); p.buttons[4] = { pressed: false, value: 0 }; frame(js, fila);
	eq(js.ui.focused, 'a');
	p.axes = [1, 0, 0, 0]; frame(js, fila); p.axes = [0, 0, 0, 0]; frame(js, fila);
	eq(js.ui.focused, 'b');
});
test('los controles ya asignados por el juego se respetan', () => {
	pads = []; const js = env.make(); js.ui.navigation = true;
	js.input.bind('ui:accept', 'KeyJ'); js.input.bind('ui:next', 'KeyN');
	frame(js); draw(js); draw(js);
	key(js, 'KeyN', fila); eq(js.ui.focused, 'a');
	key(js, 'Tab', fila); eq(js.ui.focused, 'a');                // Tab ya no es "siguiente"
	key(js, 'Enter', fila); eq(js.ui.clicked, null);
	key(js, 'KeyJ', fila); eq(js.ui.clicked, 'a');
});
test('si el juego desasigna una acción de navegación no se rompe', () => {
	const js = mkFila();
	key(js, 'Tab', fila);
	js.input.unbind('ui:left');
	key(js, 'ArrowLeft', fila);                                   // sin error; esa tecla ya no hace nada
	eq(js.ui.focused, 'a');
});
test('con navegación y sin widgets, las teclas no rompen nada', () => {
	const js = mk();
	for (const k of ['Tab', 'ArrowDown', 'Enter', 'Escape']) key(js, k, () => {});
	eq(js.ui.focused, null); eq(js.ui.wantsKeyboard, false);
});
test('las zonas informan de qué tipo de widget son', () => {
	const js = mk();
	const f = ui => { ui.button('b', BTN(0, 0), 'B'); ui.toggle('t', { x: 0, y: 40, width: 100, height: 26 }, false, 'T'); ui.slider('s', { x: 0, y: 80, width: 100, height: 24 }, 0, 0, 1); ui.list('l', { x: 0, y: 120, width: 100, height: 60 }, ['a']); };
	frame(js, f);
	eq(js.ui.zones.map(z => z.kind).join(), 'button,toggle,slider,list');
});

done();
