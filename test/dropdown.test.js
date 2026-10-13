// Pruebas del dropdown de la interfaz (js.ui.dropdown). Correr: node test/dropdown.test.js
const { load, runner } = require('./harness');
const { test, eq, done } = runner();

const env = load();
const F = { x: 100, y: 100, width: 200, height: 36 };       // el campo
const ITEMS = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'];
const ROW = 32;                                              // alto de fila por defecto
const rowPoint = i => ({ clientX: 150, clientY: 100 + 36 + 2 + i * ROW + ROW / 2 });   // fila i de la lista abierta (abajo del campo)
const fieldPoint = { clientX: 150, clientY: 118 };

let clock = 1000;
const frame = (js, fn = () => {}) => { js.tick(clock += 16); js.ui.begin(); return fn(js.ui); };
const move = (js, p) => js.fire('mousemove', p);
const down = (js, p) => { move(js, p); js.fire('mousedown', { button: 0, ...p }); };
const up = (js, p) => { move(js, p); js.fire('mouseup', { button: 0, ...p }); };
// Un juego mínimo: guarda lo elegido y redibuja el dropdown cada cuadro. `extra` declara más widgets.
const mk = (opts = {}, extra = () => {}) => {
	const js = env.make();
	const g = { js, sel: opts.sel ?? 1, opts, extra };
	g.draw = () => frame(js, ui => { g.sel = ui.dropdown('d', F, opts.items || ITEMS, g.sel, opts); extra(ui, g); if (opts.end) ui.end(); });
	g.draw(); g.draw();
	g.click = p => { down(js, p); g.draw(); up(js, p); g.draw(); g.draw(); };
	return g;
};
const zone = (js, id) => js.ui.zones.find(z => z.id === id);
const press = (js, code) => js.fireWindow('keydown', { code, key: code });
const release = (js, code) => js.fireWindow('keyup', { code, key: code });
const key = (g, code) => { g.draw(); press(g.js, code); g.draw(); release(g.js, code); g.draw(); };

test('cerrado: muestra lo elegido y no cambia el valor ni abre nada', () => {
	const g = mk();
	eq(g.sel, 1);
	eq(zone(g.js, 'd:list'), undefined);
	const calls = env.calls.filter(c => c[0] === 'fillText' && c[1] === 'Dos');
	eq(calls.length > 0, true);
});
test('tocar el campo abre la lista debajo, con una fila por ítem', () => {
	const g = mk();
	g.click(fieldPoint);
	const l = zone(g.js, 'd:list');
	eq(!!l, true); eq(l.y, 100 + 36 + 2); eq(l.h, 5 * ROW); eq(l.w, 200); eq(l.x, 100);
});
test('elegir una fila devuelve su índice y cierra la lista', () => {
	const g = mk();
	g.click(fieldPoint);
	g.click(rowPoint(3));
	eq(g.sel, 3);
	eq(zone(g.js, 'd:list'), undefined);
});
test('volver a elegir la misma fila cierra y deja el valor', () => {
	const g = mk();
	g.click(fieldPoint); g.click(rowPoint(1));
	eq(g.sel, 1); eq(zone(g.js, 'd:list'), undefined);
});
test('apretar afuera cierra sin cambiar nada, y ese toque no llega al widget de abajo', () => {
	let clicks = 0;
	const g = mk({}, (ui) => { if (ui.button('b', { x: 400, y: 100, width: 80, height: 30 }, 'B')) clicks++; });
	g.click(fieldPoint);
	g.click({ clientX: 440, clientY: 115 });
	eq(zone(g.js, 'd:list'), undefined); eq(g.sel, 1); eq(clicks, 0);
	g.click({ clientX: 440, clientY: 115 });          // ya cerrado: el botón responde
	eq(clicks, 1);
});
test('tocar otra vez el campo con la lista abierta la cierra', () => {
	const g = mk();
	g.click(fieldPoint); eq(!!zone(g.js, 'd:list'), true);
	g.click(fieldPoint); eq(zone(g.js, 'd:list'), undefined); eq(g.sel, 1);
});
test('Escape cierra la lista', () => {
	const g = mk();
	g.click(fieldPoint);
	key(g, 'Escape');
	eq(zone(g.js, 'd:list'), undefined); eq(g.sel, 1);
});
test('con la lista abierta, un widget declarado después no recibe toques encima de ella', () => {
	let clicks = 0;
	const g = mk({}, (ui) => { if (ui.button('b', { x: 100, y: 150, width: 200, height: 30 }, 'Tapado')) clicks++; });
	g.click(fieldPoint);
	g.click(rowPoint(0));                              // cae sobre el botón, pero la lista está encima
	eq(clicks, 0); eq(g.sel, 0);
});
test('deshabilitado: no abre, no cambia y tapa lo de abajo', () => {
	const g = mk({ disabled: true });
	g.click(fieldPoint);
	eq(zone(g.js, 'd:list'), undefined); eq(g.sel, 1); eq(g.js.ui.wantsPointer, true);   // tapa lo de abajo
});
test('placeholder cuando no hay nada elegido', () => {
	const g = mk({ sel: -1, placeholder: 'Elegí...' });
	eq(g.sel, -1);
	eq(env.calls.some(c => c[0] === 'fillText' && c[1] === 'Elegí...'), true);
});
test('ítems deshabilitados no se pueden elegir', () => {
	const g = mk({ items: ['A', { label: 'B', disabled: true }, 'C'], sel: 0 });
	g.click(fieldPoint);
	g.click(rowPoint(1)); eq(g.sel, 0); eq(!!zone(g.js, 'd:list'), true);     // sigue abierta
	g.click(rowPoint(2)); eq(g.sel, 2); eq(zone(g.js, 'd:list'), undefined);
});
test('maxRows limita el alto y la lista se desplaza con la rueda', () => {
	const items = Array.from({ length: 20 }, (_, i) => 'Ítem ' + i);
	const g = mk({ items, sel: 0, maxRows: 4 });
	g.click(fieldPoint);
	const l = zone(g.js, 'd:list');
	eq(l.h, 4 * ROW);
	move(g.js, rowPoint(1)); g.draw();
	g.js.fire('wheel', { deltaY: 100 }); g.draw(); g.draw();
	g.click(rowPoint(0));                              // tras desplazarse una fila, la primera visible es el ítem 1
	eq(g.sel, 1);
});
test('si abajo no entra, la lista se abre arriba del campo', () => {
	const js = env.make();
	let sel = 0;
	const F2 = { x: 100, y: 540, width: 200, height: 36 };
	const draw = () => frame(js, ui => { sel = ui.dropdown('d', F2, ITEMS, sel); });
	draw(); draw();
	const p = { clientX: 150, clientY: 558 };
	down(js, p); draw(); up(js, p); draw(); draw();
	const l = zone(js, 'd:list');
	eq(l.y + l.h <= F2.y, true); eq(l.y >= 0, true);
});
test('el popup no se sale de la pantalla por la derecha', () => {
	const js = env.make();
	let sel = 0;
	const F2 = { x: 700, y: 100, width: 90, height: 36 };
	const draw = () => frame(js, ui => { sel = ui.dropdown('d', F2, ITEMS, sel, { popupWidth: 200 }); });
	draw(); draw();
	const p = { clientX: 740, clientY: 118 };
	down(js, p); draw(); up(js, p); draw(); draw();
	const l = zone(js, 'd:list');
	eq(l.x + l.w <= 800, true);
});
test('teclado: Tab llega al campo, Enter abre, abajo y Enter eligen', () => {
	const g = mk({ end: false });
	g.js.ui.navigation = true;
	key(g, 'Tab'); eq(g.js.ui.focused, 'd');
	key(g, 'Enter'); eq(!!zone(g.js, 'd:list'), true); eq(g.js.ui.focused, 'd:list');
	key(g, 'ArrowDown'); key(g, 'ArrowDown');
	key(g, 'Enter');
	eq(g.sel, 3); eq(zone(g.js, 'd:list'), undefined); eq(g.js.ui.focused, 'd');
});
test('teclado: con el campo cerrado, arriba y abajo cambian la elección sin abrir', () => {
	const g = mk();
	g.js.ui.navigation = true;
	key(g, 'Tab');
	key(g, 'ArrowDown'); eq(g.sel, 2);
	key(g, 'ArrowUp'); key(g, 'ArrowUp'); eq(g.sel, 0);
	key(g, 'ArrowUp'); eq(g.sel, 0);                    // no da la vuelta
	eq(zone(g.js, 'd:list'), undefined);
});
test('end(): la lista se dibuja al final y queda encima; la elección llega al cuadro siguiente', () => {
	let clicks = 0;
	const g = mk({ end: true }, (ui) => { if (ui.button('b', { x: 100, y: 150, width: 200, height: 30 }, 'Tapado')) clicks++; });
	g.click(fieldPoint);
	const zs = g.js.ui.zones;
	const iList = zs.findIndex(z => z.id === 'd:list'), iBtn = zs.findIndex(z => z.id === 'b');
	eq(iList > iBtn, true);                              // la lista se registró después del botón
	g.click(rowPoint(0));
	eq(clicks, 0); eq(g.sel, 0);
});
test('si el dropdown deja de declararse mientras está abierto, la lista se cierra', () => {
	const g = mk();
	g.click(fieldPoint); eq(!!zone(g.js, 'd:list'), true);
	frame(g.js); frame(g.js);
	eq(zone(g.js, 'd:list'), undefined);
	g.draw(); g.draw();
	eq(zone(g.js, 'd:list'), undefined);
});

done();
