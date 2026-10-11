// Humo de test.html: carga la página con un DOM de mentira, recorre las siete secciones, usa los
// controles y revisa que no haya errores ni NaN en el dibujo. Correr: node test/page.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const near = (a, b, eps = 1e-9) => { if (Math.abs(a - b) > eps) throw new Error(`${a} != ${b}`); };
const eq = (a, b) => { if (a !== b) throw new Error(`${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };
// Las pruebas dependen del estado que dejó la anterior (cada sección parte de la anterior), así
// que se corren una por una, esperando a las asíncronas.
const cola = [];
const test = (name, fn) => cola.push([name, fn]);
async function done() {
	let ok = 0, fail = 0;
	for (const [name, fn] of cola) {
		try { await fn(); ok++; console.log('  ok   ' + name); }
		catch (e) { fail++; console.log('  FALLA ' + name + '\n       ' + e.message); }
	}
	console.log(`\n${ok} pasaron, ${fail} fallaron.`);
	process.exit(fail ? 1 : 0);
}

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'test.html'), 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (inline.length !== 1) throw new Error('se esperaba un solo script inline, hay ' + inline.length);

const noop = () => {};
const bad = [];                 // llamadas de dibujo con NaN / Infinity
let seccion = '(inicio)';
const props = {};
const ctx = new Proxy({}, {
	get: (_, name) => {
		if (name === 'measureText') return (t) => ({ width: String(t).length * 0.5 * parseFloat((/(\d+(?:\.\d+)?)px/.exec(props.font || '') || [0, 16])[1]) });
		if (name === 'createRadialGradient' || name === 'createLinearGradient') return () => ({ addColorStop: noop });
		if (name in props) return props[name];
		return (...args) => { for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${seccion}: ${String(name)}(${args.join(', ')})`); };
	},
	set: (_, name, v) => { if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${seccion}: ${String(name)} = ${v}`); props[name] = v; return true; },
});
const listeners = { canvas: {}, window: {} };
const canvas = {
	getContext: () => ctx, style: {}, width: 1100, height: 700, parentElement: null,
	addEventListener: (t, f) => { (listeners.canvas[t] ||= []).push(f); }, removeEventListener: noop,
	getBoundingClientRect: () => ({ left: 0, top: 0, width: 1100, height: 700 }),
};
let raf = null, pads = [];
const store = {};
const errores = [];
const sandbox = vm.createContext({
	console: { ...console, log: noop, error: (...a) => errores.push(a.join(' ')) },
	Math, Promise, setTimeout, clearTimeout, performance,
	window: {
		AudioContext: class { constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; } resume() { return Promise.resolve(); } },
		addEventListener: (t, f) => { (listeners.window[t] ||= []).push(f); }, removeEventListener: noop,
		innerWidth: 1100, innerHeight: 700, devicePixelRatio: 2, visualViewport: null, matchMedia: () => ({ matches: false }),
	},
	document: { cookie: '', addEventListener: noop, getElementById: () => canvas, body: { appendChild: noop }, createElement: () => ({ style: {}, remove: noop }), documentElement: { clientWidth: 1100, clientHeight: 700 } },
	requestAnimationFrame: (f) => { raf = f; },
	navigator: { getGamepads: () => pads }, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
	Image: function () {}, Audio: function () {}, Path2D: class {},
});
vm.runInContext(fs.readFileSync(path.join(root, 'js2d.js'), 'utf8'), sandbox, { filename: 'js2d.js' });
vm.runInContext(inline[0], sandbox, { filename: 'test.html' });
const ev = (e) => vm.runInContext(e, sandbox);

let ts = 1000;
function frames(n, dt = 16) { for (let i = 0; i < n; i++) { ts += dt; const f = raf; raf = null; f(ts); } }
const fire = (t, e = {}) => { for (const f of (listeners.canvas[t] || [])) f({ preventDefault: noop, cancelable: false, button: 0, ...e }); };
const fireWin = (t, e = {}) => { for (const f of (listeners.window[t] || [])) f({ preventDefault: noop, ...e }); };
const move = (x, y) => fire('mousemove', { clientX: x, clientY: y });
const down = (x, y) => { move(x, y); fire('mousedown', { clientX: x, clientY: y }); };
const up = (x, y) => { move(x, y); fire('mouseup', { clientX: x, clientY: y }); };
const tap = (x, y) => { down(x, y); frames(1); up(x, y); frames(2); };
const zona = (id) => { const z = ev('js.ui.zones').find(z => z.id === id); if (!z) throw new Error(`no hay zona "${id}" en ${seccion}: ${ev('js.ui.zones').map(z => z.id).filter(Boolean).join(',')}`); return z; };
const tapId = (id) => { const z = zona(id); tap(z.x + z.w / 2, z.y + z.h / 2); };
const tecla = (code) => { fireWin('keydown', { code }); frames(1); fireWin('keyup', { code }); frames(1); };
const micro = () => new Promise(r => setTimeout(r, 0));   // deja correr las promesas (captureNext)
const ir = (n, nombre) => { seccion = nombre; tecla('Digit' + n); frames(40); };

frames(5);
test('la página carga y arranca en la sección de curvas', () => {
	eq(ev('js.scenes.current'), 'curvas'); eq(errores.length, 0);
	eq(ev('NOMBRES.length'), 31);
});
test('las siete pestañas existen y las teclas 1 a 7 cambian de sección', () => {
	const nombres = ['curvas', 'shake', 'escenas', 'particulas', 'interfaz', 'entrada', 'pasofijo'];
	nombres.forEach((n, i) => { ir(i + 1, n); eq(ev('js.scenes.current'), n); });
	eq(ev('js.ui.zones').filter(z => z.id && z.id.startsWith('tab:')).length, 7);
	ir(1, 'curvas');
});
test('clic en una pestaña también cambia de sección', () => {
	tapId('tab:shake'); frames(5); eq(ev('js.scenes.current'), 'shake');
	tapId('tab:curvas'); frames(5); eq(ev('js.scenes.current'), 'curvas');
});

// --- 1. curvas ---
test('curvas: el marcador del tween coincide con la curva (el tween usa la misma Ease)', () => {
	seccion = 'curvas'; frames(30);
	const celdas = ev('curvas.celdas');
	for (const c of celdas) near(c.v, ev(`Ease.get("${c.nombre}")`)(c.p) , 1e-9);
});
test('curvas: clic en una celda reinicia su tween; el botón Repetir relanza la demo', () => {
	frames(30);
	const antes = ev('curvas.celdas.find(c => c.nombre === "outBack").p');
	tapId('curva:outBack');
	const despues = ev('curvas.celdas.find(c => c.nombre === "outBack").p');
	if (!(despues < antes)) throw new Error(`no reinició: ${antes} -> ${despues}`);
	frames(120);
	eq(ev('curvas.demo.fin'), 'onComplete llamado'); eq(ev('curvas.demo.color'), 1);
	tapId('demo'); frames(2);
	eq(ev('curvas.demo.fin'), '-'); eq(ev('curvas.demo.color'), 0);
});

// --- 2. shake ---
test('shake: los botones sacuden y el HUD queda quieto', () => {
	ir(2, 'shake');
	tapId('golpe');
	let max = 0; for (let i = 0; i < 10; i++) { frames(1); max = Math.max(max, Math.abs(ev('js.shakeOffset.x')), Math.abs(ev('js.shakeOffset.y'))); }
	if (!(max > 0)) throw new Error('no tembló');
	frames(60); eq(ev('js.shakeOffset.x'), 0);
	tapId('largo'); let rot = 0; for (let i = 0; i < 12; i++) { frames(1); rot = Math.max(rot, Math.abs(ev('js.shakeOffset.rotation'))); }
	if (!(rot > 0)) throw new Error('no giró');
	tapId('stop'); frames(2); eq(ev('js.shakeOffset.x'), 0);
	tapId('solox'); let y = 0; for (let i = 0; i < 12; i++) { frames(1); y = Math.max(y, Math.abs(ev('js.shakeOffset.y'))); }
	eq(y, 0);
});
test('shake: el interruptor de shakeEnabled apaga el temblor', () => {
	tapId('s_en'); eq(ev('js.shakeEnabled'), false);
	tapId('golpe'); for (let i = 0; i < 5; i++) { frames(1); eq(ev('js.shakeOffset.x'), 0); }
	tapId('s_en'); eq(ev('js.shakeEnabled'), true);
});
test('shake: el slider de magnitud cambia el valor', () => {
	const z = zona('s_mag'); const antes = ev('sacudida.magnitud');
	tap(z.x + z.w * 0.9, z.y + z.h / 2);
	if (!(ev('sacudida.magnitud') > antes)) throw new Error('no cambió: ' + ev('sacudida.magnitud'));
});

// --- 3. escenas ---
test('escenas: switch, fundido, push y pop del SceneManager propio', () => {
	ir(3, 'escenas');
	eq(ev('esc.sm.current'), 'A');
	tapId('e_fade');                                  // sin fundido
	tapId('irB'); frames(2); eq(ev('esc.sm.current'), 'B');
	tapId('push'); frames(2); eq(ev('esc.sm.stack.join()'), 'B,pausa');
	tapId('pop'); frames(2); eq(ev('esc.sm.stack.join()'), 'B');
	tapId('e_fade');                                  // con fundido
	tapId('irC'); frames(2); eq(ev('esc.sm.transitioning'), true);
	frames(80); eq(ev('esc.sm.current'), 'C'); eq(ev('esc.sm.transitioning'), false);
	if (!ev('esc.log.some(s => s.startsWith("B.exit"))')) throw new Error('falta el evento exit');
});

// --- 4. partículas ---
test('particulas: un clic en la escena lanza una ráfaga; el preset y la cantidad se respetan', () => {
	ir(4, 'particulas');
	if (!(ev('js.particles.count') > 0)) throw new Error('falta la ráfaga de bienvenida');
	ev('js.particles.clear()'); frames(2);
	eq(ev('js.particles.count'), 0);
	tap(700, 300);
	eq(ev('js.particles.count'), 40);
	ev('js.particles.clear()');
	const z = zona('p_lista'); tap(z.x + 20, z.y + 34 * 2.5 * ev('U'));
	eq(ev('part.preset'), 2); eq(ev('PRESETS[part.preset]'), 'confetti');
	tap(700, 300); eq(ev('js.particles.count'), 40);
});
test('particulas: clic sobre los controles no lanza nada; el stream sigue al mouse y limpiar vacía', () => {
	ev('js.particles.clear()'); frames(2);
	const z = zona('p_cant'); tap(z.x + z.w * 0.5, z.y + z.h / 2);
	eq(ev('js.particles.count'), 0);
	tapId('p_seg'); eq(ev('part.seguir'), true);
	move(800, 300); frames(30);
	if (!(ev('js.particles.count') > 10)) throw new Error('el stream no emite: ' + ev('js.particles.count'));
	tapId('p_seg'); eq(ev('part.flujo'), null);
	tapId('limpiar'); eq(ev('js.particles.count'), 0);
});

// --- 5. interfaz ---
test('interfaz: botones, interruptores, sliders y lista responden', () => {
	ir(5, 'interfaz');
	tapId('b_prim'); eq(ev('ui5.ultimo'), 'b_prim');
	const pz = zona('b_prim');                                          // el deshabilitado está justo debajo
	tap(pz.x + 10, pz.y + pz.h + 6 * ev('U') + 10); eq(ev('ui5.ultimo'), 'b_prim');   // sin efecto
	tapId('t1'); eq(ev('ui5.toggle1'), false);
	const s = zona('sl1'); tap(s.x + s.w * 0.9, s.y + s.h / 2);
	if (!(ev('ui5.slider') > 0.8)) throw new Error('slider: ' + ev('ui5.slider'));
	const s2 = zona('sl2'); tap(s2.x + s2.w * 0.5, s2.y + s2.h / 2);
	eq(ev('ui5.paso') % 2, 0);
	const l = zona('lista'); tap(l.x + 30, l.y + 30 * 1.5 * ev('U') + 1);
	eq(ev('ui5.lista'), 1);
});
test('interfaz: la lista se desplaza con la rueda y no devuelve filas deshabilitadas', () => {
	const l = zona('lista'); move(l.x + 30, l.y + 40);
	for (let i = 0; i < 6; i++) { fire('wheel', { deltaY: 100 }); frames(1); }
	if (!(ev('js.ui.getScroll("lista")') > 0)) throw new Error('no desplazó');
	const antes = ev('ui5.lista');
	// la fila 4 (índice 3) está deshabilitada; con scroll 0 está a 3,5 filas del borde
	ev('js.ui.setScroll("lista", 0)'); frames(2);
	tap(l.x + 30, l.y + 30 * 3.5 * ev('U')); eq(ev('ui5.lista'), antes);
});
test('interfaz: el multiplicador de escala agranda los widgets sin romper nada', () => {
	const z = zona('sl_esc'); tap(z.x + z.w * 0.95, z.y + z.h / 2);
	if (!(ev('ui5.escala') > 1.4)) throw new Error('escala: ' + ev('ui5.escala'));
	frames(10);
	tap(z.x + z.w * 0.05, z.y + z.h / 2); frames(5);
});

// --- teclado y foco (sección de interfaz) ---
test('interfaz con teclado: Tab muestra el foco, Enter activa, las flechas ajustan el slider', () => {
	ir(5, 'interfaz');
	eq(ev('js.ui.navigation'), true); eq(ev('js.ui.focusVisible'), false);
	ev('ui5.ultimo = "-"');
	tecla('Tab'); eq(ev('js.ui.focusVisible'), true);
	const primero = ev('js.ui.focused');
	if (!primero) throw new Error('Tab no dejó el foco en ningún widget');
	// llevar el foco a "b_prim" y activarlo con Enter
	for (let i = 0; i < 8 && ev('js.ui.focused') !== 'b_prim'; i++) tecla('Tab');
	eq(ev('js.ui.focused'), 'b_prim');
	tecla('Enter'); eq(ev('ui5.ultimo'), 'b_prim');
	// el slider: Tab hasta él y flechas
	for (let i = 0; i < 20 && ev('js.ui.focused') !== 'sl1'; i++) tecla('Tab');
	eq(ev('js.ui.focused'), 'sl1');
	const v0 = ev('ui5.slider'); tecla('ArrowRight'); tecla('ArrowRight');
	if (!(ev('ui5.slider') > v0 + 0.05)) throw new Error('el slider no cambió con las flechas');
	tecla('Escape'); eq(ev('js.ui.focused'), null);
});
test('interfaz con teclado: la lista se maneja con las flechas y devuelve la fila con Enter', () => {
	for (let i = 0; i < 30 && ev('js.ui.focused') !== 'lista'; i++) tecla('Tab');
	eq(ev('js.ui.focused'), 'lista');
	const antes = ev('ui5.lista');
	tecla('ArrowDown'); tecla('Enter');
	if (ev('ui5.lista') === antes) throw new Error('la lista no cambió de fila');
	tecla('Escape');
});
test('interfaz con teclado: el interruptor "navigation" lo apaga', () => {
	tapId('t_nav'); eq(ev('ui5.nav'), false); frames(3); eq(ev('js.ui.navigation'), false);
	tecla('Tab'); eq(ev('js.ui.focusVisible'), false);
	tapId('t_nav'); eq(ev('ui5.nav'), true);
});

// --- 6. entrada ---
test('entrada: el teclado mueve el círculo y Espacio lanza chispas; la navegación de la interfaz está apagada', () => {
	ir(6, 'entrada');
	eq(ev('js.ui.navigation'), false);
	const x0 = ev('ent.x');
	fireWin('keydown', { code: 'KeyD' }); frames(20); fireWin('keyup', { code: 'KeyD' }); frames(2);
	if (!(ev('ent.x') > x0 + 10)) throw new Error('no se movió: ' + x0 + ' -> ' + ev('ent.x'));
	tecla('Space'); if (!(ev('js.particles.count') > 0)) throw new Error('sin chispas');
});
test('entrada: el gamepad (simulado) mueve, enciende botones y se lista', () => {
	const pad = { index: 0, id: 'Gamepad de prueba', connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
	pads = [pad]; frames(3);
	eq(ev('js.input.gamepads.length'), 1);
	const y0 = ev('ent.y'); pad.axes = [0, 1, 0, 0]; frames(20);
	if (!(ev('ent.y') > y0 + 10)) throw new Error('la palanca no movió');
	pad.axes = [0, 0, 0, 0]; pad.buttons[0] = { pressed: true, value: 1 }; frames(2);
	eq(ev('js.input.isDown("pb_A")'), true); eq(ev('js.input.device'), 'gamepad');
	pad.buttons[0] = { pressed: false, value: 0 }; frames(2);
});
test('entrada: reasignar una acción con captureNext y restaurar', async () => {
	tapId('rebind:accion'); frames(2);
	eq(ev('ent.esperando'), 'accion');
	tecla('KeyJ'); frames(3); await micro();
	eq(ev('js.input.bindings("accion").join()'), 'KeyJ'); eq(ev('ent.esperando'), null);
	tapId('reset'); frames(2);
	eq(ev('js.input.bindings("accion").join()'), 'Space,pad:A');
});
test('entrada: Escape cancela una reasignación', async () => {
	tapId('rebind:turbo'); frames(2); tecla('Escape'); frames(3); await micro();
	eq(ev('ent.mensaje'), 'cancelado'); eq(ev('js.input.bindings("turbo").join()'), 'ShiftLeft,pad:RT');
});
test('entrada: el botón virtual activa la acción mientras se mantiene apretado', () => {
	const z = zona('virtual'); down(z.x + 10, z.y + 10); frames(3);
	eq(ev('js.input.isDown("turbo")'), true);
	up(z.x + 10, z.y + 10); frames(3); eq(ev('js.input.isDown("turbo")'), false);
});

// --- 7. paso fijo ---
test('pasofijo: cambia el hz, cuenta pasos y respeta pausa y reset', () => {
	ir(7, 'pasofijo');
	eq(ev('js.fixed.hz'), 60);
	tapId('hz:30'); eq(ev('js.fixed.hz'), 30);
	const t0 = ev('js.fixed.ticks'); frames(60);
	if (!(ev('js.fixed.ticks') > t0 + 20)) throw new Error('no hay pasos');
	tapId('hz:60');
	tapId('pf_pau'); eq(ev('js.fixed.paused'), true);
	const t1 = ev('js.fixed.ticks'); frames(30); eq(ev('js.fixed.ticks'), t1);
	tapId('pf_pau'); tapId('pf_reset'); eq(ev('js.fixed.ticks') < 10, true);
});
test('pasofijo: con retraso artificial la bola A conserva el pico y la B se corre', () => {
	ev('pf.lag = 0'); tapId('pf_reset'); frames(300);
	const picoA0 = ev('pf.picoA'), picoB0 = ev('pf.picoB');
	if (!(picoA0 > 100 && picoB0 > 100)) throw new Error(`sin rebotes: ${picoA0} ${picoB0}`);
	tapId('pf_reset');
	for (let i = 0; i < 60; i++) frames(3, 40);               // cuadros de 40 ms (25 fps)
	const picoA1 = ev('pf.picoA'), picoB1 = ev('pf.picoB');
	near(picoA1, picoA0, picoA0 * 0.02);                       // A: mismo pico con 60 o con 25 fps
	if (!(Math.abs(picoB1 - picoB0) > picoB0 * 0.03)) throw new Error(`B no se corrió: ${picoB0} -> ${picoB1}`);
	ev('pf.lag = 0');
});

test('ninguna llamada de dibujo recibió NaN ni infinitos', () => {
	if (bad.length) throw new Error(bad.length + ' llamadas, p. ej.: ' + bad.slice(0, 3).join(' | '));
});
test('el motor no registró errores por consola', () => {
	if (errores.length) throw new Error(errores.slice(0, 3).join(' | '));
});

done();
