// Pruebas de la interfaz (js.ui) y de los flancos del puntero. Correr: node test/ui.test.js
const { load, runner } = require('./harness');
const { test, near, eq, done } = runner();

const env = load();
const BTN = { x: 100, y: 100, width: 120, height: 40 };
const inside = { clientX: 150, clientY: 120 };
const outside = { clientX: 400, clientY: 400 };

// Un cuadro de juego: begin() y lo que declare `fn`. Devuelve lo que devuelva `fn`.
const frame = (js, fn = () => {}) => { js.ui.begin(); return fn(js.ui); };
const move = (js, p) => js.fire('mousemove', p);
const down = (js, p = inside) => { move(js, p); js.fire('mousedown', { button: 0, ...p }); };
const up = (js, p = inside) => { move(js, p); js.fire('mouseup', { button: 0, ...p }); };
const mk = () => { const js = env.make(); frame(js); return js; };

test('un botón responde al toque: apretar y soltar encima', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'OK');
	frame(js, b);                         // se declara (zona tocable desde el cuadro siguiente)
	down(js); eq(frame(js, b), false);
	eq(js.ui.active, 'b');
	up(js); eq(frame(js, b), true);
	eq(frame(js, b), false);              // sólo en ese cuadro
});
test('un toque rápido (apretar y soltar entre dos cuadros) no se pierde', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'OK');
	frame(js, b);
	down(js); up(js);
	eq(frame(js, b), true);
});
test('soltar fuera del botón no cuenta como toque', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'OK');
	frame(js, b);
	down(js); frame(js, b);
	up(js, outside); eq(frame(js, b), false); eq(js.ui.active, null);
});
test('apretar fuera y soltar sobre el botón tampoco', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'OK');
	frame(js, b);
	down(js, outside); frame(js, b);
	up(js); eq(frame(js, b), false);
});
test('hot y cursor: pointer sobre lo tocable', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'OK');
	frame(js, b); move(js, inside); frame(js, b);
	eq(js.ui.hot, 'b'); eq(js.canvasStub.style.cursor, 'pointer');
	move(js, outside); frame(js, b);
	eq(js.ui.hot, null); eq(js.canvasStub.style.cursor, '');
});
test('botón deshabilitado: no responde, no es hot, pero tapa lo de abajo', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'OK', { disabled: true });
	frame(js, b); down(js); up(js);
	eq(frame(js, b), false); eq(js.ui.hot, null); eq(js.ui.wantsPointer, true);
});
test('un panel (bloqueante) declarado encima tapa al botón; debajo, no', () => {
	const js = mk();
	const sobre = ui => { ui.button('b', BTN, 'OK'); ui.panel({ x: 90, y: 90, width: 200, height: 100 }); };
	frame(js, sobre); move(js, inside); frame(js, sobre);
	eq(js.ui.hot, null);
	const bajo = ui => { ui.panel({ x: 90, y: 90, width: 200, height: 100 }); ui.button('b', BTN, 'OK'); };
	frame(js, bajo); frame(js, bajo);
	eq(js.ui.hot, 'b');
	const libre = ui => { ui.button('b', BTN, 'OK'); ui.panel({ x: 90, y: 90, width: 200, height: 100 }, { blocks: false }); };
	frame(js, libre); frame(js, libre);
	eq(js.ui.hot, 'b');
});
test('entre dos botones superpuestos gana el que se declaró último', () => {
	const js = mk();
	const dos = ui => { ui.button('a', BTN, 'A'); ui.button('b', BTN, 'B'); };
	frame(js, dos); move(js, inside); frame(js, dos);
	eq(js.ui.hot, 'b');
});
test('wantsPointer: sobre la interfaz o apretándola', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'OK');
	frame(js, b); move(js, outside); frame(js, b); eq(js.ui.wantsPointer, false);
	move(js, inside); frame(js, b); eq(js.ui.wantsPointer, true);
	down(js); move(js, outside); frame(js, b); eq(js.ui.wantsPointer, true);   // sigue apretando
	up(js, outside); frame(js, b); eq(js.ui.wantsPointer, false);
});
test('si el mouse se suelta fuera del canvas, lo apretado se libera solo', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'OK');
	frame(js, b); down(js); frame(js, b); eq(js.ui.active, 'b');
	js.mouseButtons[0] = false;           // el motor nunca vio el mouseup
	frame(js, b); eq(js.ui.active, null);
});
test('toque con el dedo: touchstart/touchend', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'OK');
	frame(js, b);
	const t = { touches: [inside], changedTouches: [inside] };
	js.fire('touchstart', t); js.fire('touchend', { touches: [], changedTouches: [inside] });
	eq(frame(js, b), true);
});
test('touchcancel no cuenta como toque', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'OK');
	frame(js, b);
	js.fire('touchstart', { touches: [inside], changedTouches: [inside] });
	js.fire('touchcancel', { touches: [], changedTouches: [inside] });
	eq(frame(js, b), false);
});
test('el botón dibuja fondo redondeado y su texto, y respeta primary', () => {
	const js = mk();
	env.calls.length = 0;
	frame(js, ui => ui.button('b', BTN, 'Jugar', { primary: true }));
	if (!env.calls.some(c => c[0] === 'roundRect')) throw new Error('sin fondo');
	const t = env.calls.find(c => c[0] === 'fillText');
	eq(t[1], 'Jugar');
	if (!env.calls.some(c => c[0] === 'set:fillStyle' && c[1] === js.ui.theme.accent)) throw new Error('no usó el color de acento');
});

// --- toggle ---
test('toggle devuelve el valor nuevo al tocarlo, y el mismo si no', () => {
	const js = mk();
	let v = false;
	const tg = ui => { v = ui.toggle('t', BTN, v, 'Sonido'); };
	frame(js, tg); eq(v, false);
	down(js); up(js); frame(js, tg); eq(v, true);
	frame(js, tg); eq(v, true);
	down(js); up(js); frame(js, tg); eq(v, false);
});
test('toggle deshabilitado no cambia', () => {
	const js = mk();
	let v = true;
	const tg = ui => { v = ui.toggle('t', BTN, v, 'X', { disabled: true }); };
	frame(js, tg); down(js); up(js); frame(js, tg); eq(v, true);
});

// --- slider ---
const SL = { x: 100, y: 100, width: 200, height: 24 };
test('slider: arrastrar cambia el valor y se queda en [min, max]', () => {
	const js = mk();
	let v = 0;
	const sl = ui => { v = ui.slider('s', SL, v, 0, 100); };
	frame(js, sl);
	down(js, { clientX: 200, clientY: 112 }); frame(js, sl);
	if (!(v > 40 && v < 60)) throw new Error('mitad: ' + v);
	move(js, { clientX: 5000, clientY: 112 }); frame(js, sl); eq(v, 100);
	move(js, { clientX: -5000, clientY: 112 }); frame(js, sl); eq(v, 0);
	up(js, { clientX: -5000, clientY: 112 }); frame(js, sl);
});
test('slider: un toque rápido salta al lugar tocado', () => {
	const js = mk();
	let v = 0;
	const sl = ui => { v = ui.slider('s', SL, v, 0, 1); };
	frame(js, sl);
	const p = { clientX: 250, clientY: 112 };
	down(js, p); up(js, p); frame(js, sl);
	if (!(v > 0.6 && v < 0.85)) throw new Error('v=' + v);
});
test('slider: step ajusta a múltiplos', () => {
	const js = mk();
	let v = 0;
	const sl = ui => { v = ui.slider('s', SL, v, 0, 10, { step: 2 }); };
	frame(js, sl); down(js, { clientX: 213, clientY: 112 }); frame(js, sl);
	eq(v % 2, 0);
});

// --- lista ---
const LST = { x: 100, y: 100, width: 150, height: 108 };   // 3 filas de 36
const items = Array.from({ length: 10 }, (_, i) => 'item ' + i);
const rowAt = (i) => ({ clientX: 150, clientY: 100 + 36 * i + 18 });
test('lista: tocar una fila devuelve su índice', () => {
	const js = mk();
	let got = -2;
	const ls = ui => { got = ui.list('l', LST, items); };
	frame(js, ls); down(js, rowAt(1)); frame(js, ls);
	up(js, rowAt(1)); frame(js, ls); eq(got, 1);
	frame(js, ls); eq(got, -1);
});
test('lista: la rueda desplaza y el toque cae en la fila de lo que se ve', () => {
	const js = mk();
	let got = -2;
	const ls = ui => { got = ui.list('l', LST, items); };
	frame(js, ls); move(js, rowAt(0)); frame(js, ls);
	js.fire('wheel', { deltaY: 100 }); frame(js, ls);
	near(js.ui.getScroll('l'), 36);
	down(js, rowAt(0)); up(js, rowAt(0)); frame(js, ls); eq(got, 1);
});
test('lista: el desplazamiento se limita al final', () => {
	const js = mk();
	const ls = ui => ui.list('l', LST, items);
	frame(js, ls); move(js, rowAt(0)); frame(js, ls);
	for (let i = 0; i < 30; i++) { js.fire('wheel', { deltaY: 100 }); frame(js, ls); }
	near(js.ui.getScroll('l'), 10 * 36 - 108);
	for (let i = 0; i < 30; i++) { js.fire('wheel', { deltaY: -100 }); frame(js, ls); }
	eq(js.ui.getScroll('l'), 0);
});
test('lista: arrastrar desplaza y no cuenta como toque', () => {
	const js = mk();
	let got = -2;
	const ls = ui => { got = ui.list('l', LST, items); };
	frame(js, ls);
	down(js, { clientX: 150, clientY: 190 }); frame(js, ls);
	move(js, { clientX: 150, clientY: 150 }); frame(js, ls);     // sube 40 px
	move(js, { clientX: 150, clientY: 130 }); frame(js, ls);
	up(js, { clientX: 150, clientY: 130 }); frame(js, ls);
	eq(got, -1);
	if (!(js.ui.getScroll('l') > 20)) throw new Error('no desplazó: ' + js.ui.getScroll('l'));
});
test('lista: una fila deshabilitada no se devuelve; setScroll y selected', () => {
	const js = mk();
	let got = -2;
	const its = ['a', { label: 'b', disabled: true }, 'c'];
	const ls = ui => { got = ui.list('l', LST, its, { selected: 2 }); };
	frame(js, ls); down(js, rowAt(1)); up(js, rowAt(1)); frame(js, ls); eq(got, -1);
	js.ui.setScroll('l', 5); eq(js.ui.getScroll('l'), 5);
});
test('lista: con scale las filas miden más', () => {
	const js = mk();
	js.ui.scale = 2;
	let got = -2;
	const ls = ui => { got = ui.list('l', { x: 100, y: 100, width: 150, height: 216 }, items); };
	frame(js, ls);
	down(js, { clientX: 150, clientY: 100 + 72 + 10 }); up(js, { clientX: 150, clientY: 100 + 72 + 10 }); frame(js, ls);
	eq(got, 1);
});

test('táctil: un toque lejos del anterior no se confunde con un arrastre', () => {
	const js = mk();
	let got = -2;
	const ls = ui => { got = ui.list('l', LST, items); };
	frame(js, ls);
	const lejos = { clientX: 700, clientY: 500 };                     // el dedo estuvo allá
	js.fire('touchstart', { touches: [lejos], changedTouches: [lejos] });
	js.fire('touchend', { touches: [], changedTouches: [lejos] }); frame(js, ls);
	const f = rowAt(1);                                               // y ahora toca una fila
	js.fire('touchstart', { touches: [f], changedTouches: [f] }); frame(js, ls);
	js.fire('touchend', { touches: [], changedTouches: [f] }); frame(js, ls);
	eq(got, 1);
});

test('lista: size cambia el tamaño de la letra', () => {
	const js = mk();
	const tam = () => parseFloat(/(\d+(?:\.\d+)?)px/.exec(env.calls.filter(c => c[0] === 'set:font').pop()[1])[1]);
	env.calls.length = 0; frame(js, ui => ui.list('l', LST, ['a', 'b']));
	const normal = tam();
	env.calls.length = 0; frame(js, ui => ui.list('l', LST, ['a', 'b'], { size: 10 }));
	eq(tam(), 10); if (!(normal > 10)) throw new Error('el tamaño por defecto debería ser mayor: ' + normal);
});

// --- varios ---
test('rows y columns reparten el rectángulo', () => {
	const js = mk();
	const rs = js.ui.rows({ x: 0, y: 0, width: 100, height: 100 }, 4, 10);
	eq(rs.length, 4); near(rs[0].height, 17.5); near(rs[3].y + rs[3].height, 100);
	const cs = js.ui.columns({ x: 10, y: 0, w: 100, h: 50 }, 2, 20);
	near(cs[0].width, 40); near(cs[1].x, 70);
});
test('label y panel con título dibujan texto', () => {
	const js = mk();
	env.calls.length = 0;
	frame(js, ui => { ui.panel({ x: 0, y: 0, width: 200, height: 100 }, { title: 'Opciones' }); ui.label('hola', 10, 10, { align: 'center' }); });
	const texts = env.calls.filter(c => c[0] === 'fillText').map(c => c[1]);
	eq(texts.join(), 'Opciones,hola');
});
test('el tema se puede cambiar', () => {
	const js = mk();
	js.ui.theme.accent = '#123456';
	env.calls.length = 0;
	frame(js, ui => ui.button('b', BTN, 'X', { primary: true }));
	if (!env.calls.some(c => c[0] === 'set:fillStyle' && c[1] === '#123456')) throw new Error('no usó el tema');
});
test('consumePointerEvents devuelve los flancos y los reinicia', () => {
	const js = mk();
	down(js); up(js);
	const e = js.consumePointerEvents();
	eq(e.pressed, true); eq(e.released, true);
	const e2 = js.consumePointerEvents();
	eq(e2.pressed, false); eq(e2.released, false);
});
test('el botón derecho del mouse no cuenta', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'OK');
	frame(js, b);
	move(js, inside); js.fire('mousedown', { button: 2 }); js.fire('mouseup', { button: 2 });
	eq(frame(js, b), false);
});

// --- apariencia, zonas y táctil ---
test('hitTest y zones muestran lo del último cuadro dibujado', () => {
	const js = mk();
	frame(js, ui => { ui.button('b', BTN, 'OK'); ui.panel({ x: 300, y: 300, width: 50, height: 50 }); });
	eq(js.ui.hitTest(150, 120).id, 'b'); eq(js.ui.hitTest(150, 120).interactive, true);
	const p = js.ui.hitTest(310, 310); eq(p.id, null); eq(p.interactive, false);
	eq(js.ui.hitTest(5, 5), null);
	eq(js.ui.zones.length, 2);
	js.ui.zones[0].x = 999; eq(js.ui.zones[0].x, 100);       // es una copia
});
test('block tapa sin dibujar nada', () => {
	const js = mk();
	env.calls.length = 0;
	frame(js, ui => { ui.button('b', BTN, 'OK'); ui.block({ x: 90, y: 90, width: 200, height: 100 }); });
	const antes = env.calls.length;
	frame(js, ui => { ui.block({ x: 90, y: 90, width: 200, height: 100 }); });
	eq(js.ui.hitTest(150, 120).interactive, false);
	eq(env.calls.some(c => c[0] === 'roundRect') , true);   // el del botón del primer cuadro
	env.calls.length = 0; frame(js, ui => ui.block({ x: 0, y: 0, width: 10, height: 10 }));
	eq(env.calls.length, 0);
});
test('button con color propio: base, y overlay al apretar y al pasar el puntero', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'X', { color: '#336699' });
	const fills = () => env.calls.filter(c => c[0] === 'set:fillStyle').map(c => c[1]);
	frame(js, b);
	env.calls.length = 0; frame(js, b);
	eq(fills().includes('#336699'), true); eq(fills().some(f => f.startsWith('rgba(0,0,0')), false);
	move(js, inside); frame(js, b);
	env.calls.length = 0; frame(js, b);
	eq(fills().includes('rgba(255,255,255,0.08)'), true);
	down(js); frame(js, b);
	env.calls.length = 0; frame(js, b);
	eq(fills().includes('rgba(0,0,0,0.22)'), true);
});
test('button con color por estado { base, hover, active }', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'X', { color: { base: '#111111', hover: '#222222', active: '#333333' } });
	const last = () => env.calls.filter(c => c[0] === 'set:fillStyle').map(c => c[1]).find(f => /^#[123]{6}$/.test(f));
	frame(js, b); env.calls.length = 0; frame(js, b); eq(last(), '#111111');
	move(js, inside); frame(js, b); env.calls.length = 0; frame(js, b); eq(last(), '#222222');
	down(js); frame(js, b); env.calls.length = 0; frame(js, b); eq(last(), '#333333');
});
test('button: border, gloss, textColor, weight, radius y shadow', () => {
	const js = mk();
	env.calls.length = 0;
	frame(js, ui => ui.button('b', BTN, 'X', { color: '#445566', border: '#abcdef', gloss: true, textColor: '#fedcba', weight: 900, radius: 7, shadow: true }));
	const names = env.calls.map(c => c[0]);
	eq(names.includes('stroke'), true);                                        // el borde
	eq(env.calls.some(c => c[0] === 'set:strokeStyle' && c[1] === '#abcdef'), true);
	eq(env.calls.filter(c => c[0] === 'roundRect').length >= 3, true);          // fondo, brillo y borde
	eq(env.calls.some(c => c[0] === 'set:shadowBlur' && c[1] > 0), true);
	eq(env.calls.some(c => c[0] === 'set:fillStyle' && c[1] === '#fedcba'), true);
	eq(env.calls.some(c => c[0] === 'set:font' && /^900 /.test(c[1])), true);
	eq(env.calls.find(c => c[0] === 'roundRect')[5], 7);
});
test('button fit: achica la letra hasta que el texto entre, y sin fit no la toca', () => {
	const js = mk();
	const size = () => {
		const f = env.calls.filter(c => c[0] === 'set:font').map(c => parseFloat(/(\d+(?:\.\d+)?)px/.exec(c[1])[1]));
		return f[f.length - 1];
	};
	const largo = 'Texto bastante largo para un botón';
	env.calls.length = 0; frame(js, ui => ui.button('b', { x: 0, y: 0, width: 100, height: 40 }, largo, { size: 20, fit: true }));
	const achicada = size();
	if (!(achicada < 20)) throw new Error('no achicó: ' + achicada);
	if (achicada < 12) throw new Error('bajó del piso (60%): ' + achicada);
	env.calls.length = 0; frame(js, ui => ui.button('b', { x: 0, y: 0, width: 100, height: 40 }, largo, { size: 20 }));
	eq(size(), 20);
	env.calls.length = 0; frame(js, ui => ui.button('b', { x: 0, y: 0, width: 400, height: 40 }, 'corto', { size: 20, fit: true }));
	eq(size(), 20);
});
test('panel: border y shadow', () => {
	const js = mk();
	env.calls.length = 0;
	frame(js, ui => ui.panel({ x: 0, y: 0, width: 100, height: 100 }, { color: '#102030', border: '#a0b0c0', shadow: true }));
	eq(env.calls.some(c => c[0] === 'set:strokeStyle' && c[1] === '#a0b0c0'), true);
	eq(env.calls.some(c => c[0] === 'set:shadowBlur' && c[1] > 0), true);
	env.calls.length = 0;
	frame(js, ui => ui.panel({ x: 0, y: 0, width: 100, height: 100 }));
	eq(env.calls.some(c => c[0] === 'set:shadowBlur'), false);
});
test('con el dedo no queda nada resaltado después de tocar, pero sí mientras se aprieta', () => {
	const js = mk();
	const b = ui => ui.button('b', BTN, 'OK');
	frame(js, b);
	js.fire('touchstart', { touches: [inside], changedTouches: [inside] }); frame(js, b);
	eq(js.ui.hot, 'b'); eq(js.ui.active, 'b');
	js.fire('touchend', { touches: [], changedTouches: [inside] }); frame(js, b);
	eq(js.ui.clicked, 'b'); eq(js.ui.hot, null);
	frame(js, b); eq(js.ui.hot, null);
	move(js, inside); frame(js, b); eq(js.ui.hot, 'b');        // con el mouse vuelve el hover
});
test('js.ui.clicked se puede leer desde el update sin usar el valor devuelto', () => {
	const js = mk();
	frame(js, ui => ui.button('x', BTN, 'X'));
	down(js); up(js); js.ui.begin();
	eq(js.ui.clicked, 'x');
});

done();
