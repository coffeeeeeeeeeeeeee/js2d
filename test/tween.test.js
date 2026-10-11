// Pruebas de Ease / Tween / TweenManager. Correr: node test/tween.test.js
// Carga js2d.js en un contexto aislado; estas clases no tocan el DOM.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({ console, Math, Promise });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js2d.js'), 'utf8'), ctx);
const { Ease, TweenManager } = vm.runInContext('({ Ease, TweenManager })', ctx);

let ok = 0, fail = 0;
function test(name, fn) {
	try { fn(); ok++; console.log('  ok   ' + name); }
	catch (e) { fail++; console.log('  FALLA ' + name + '\n       ' + e.message); }
}
const near = (a, b, eps = 1e-9) => { if (Math.abs(a - b) > eps) throw new Error(`${a} != ${b}`); };
const eq = (a, b) => { if (a !== b) throw new Error(`${a} !== ${b}`); };

const names = Object.keys(Ease).filter(k => k !== 'get');

test('todas las curvas valen 0 en t=0 y 1 en t=1', () => {
	for (const n of names) { near(Ease[n](0), 0, 1e-6); near(Ease[n](1), 1, 1e-6); }
});
test('hay 31 curvas (linear + 10 familias x 3)', () => eq(names.length, 31));
test('las curvas in/out son espejo: out(t) = 1 - in(1-t)', () => {
	for (const f of ['Quad', 'Cubic', 'Sine', 'Expo', 'Circ', 'Bounce'])
		for (const t of [0.1, 0.3, 0.7, 0.9]) near(Ease['out' + f](t), 1 - Ease['in' + f](1 - t), 1e-9);
});
test('inOut pasa por 0.5 en t=0.5 (salvo back/elastic)', () => {
	for (const f of ['Quad', 'Cubic', 'Quart', 'Quint', 'Sine', 'Expo', 'Circ', 'Bounce']) near(Ease['inOut' + f](0.5), 0.5, 1e-9);
});
test('outBack se pasa de 1; inBack baja de 0', () => {
	if (!(Ease.outBack(0.8) > 1)) throw new Error('outBack no se pasa');
	if (!(Ease.inBack(0.2) < 0)) throw new Error('inBack no baja');
});
test('Ease.get: nombre, función, nada y error', () => {
	eq(Ease.get('outCubic'), Ease.outCubic);
	const f = t => t; eq(Ease.get(f), f);
	eq(Ease.get(undefined), Ease.linear);
	let threw = false; try { Ease.get('outCubicc'); } catch (e) { threw = true; }
	if (!threw) throw new Error('no avisó del nombre inexistente');
});

test('tween lineal llega al valor final', () => {
	const m = new TweenManager(), o = { x: 0 };
	m.add(o, { x: 100 }, 1);
	m.update(0.5); near(o.x, 50);
	m.update(0.5); near(o.x, 100); eq(m.count, 0);
});
test('un dt enorme no se pasa del valor final', () => {
	const m = new TweenManager(), o = { x: 0 };
	m.add(o, { x: 10 }, 1, { ease: 'outBack' });
	m.update(5); near(o.x, 10);
});
test('delay: no se mueve hasta que pasa y usa la sobra del cuadro', () => {
	const m = new TweenManager(), o = { x: 0 };
	m.add(o, { x: 100 }, 1, { delay: 0.5 });
	m.update(0.4); eq(o.x, 0);
	m.update(0.4); near(o.x, 30);   // 0.1 de espera restante, 0.3 de animación
});
test('el valor inicial se toma al arrancar, no al crear', () => {
	const m = new TweenManager(), o = { x: 0 };
	m.add(o, { x: 100 }, 1, { delay: 1 });
	o.x = 50;
	m.update(1); m.update(0.5); near(o.x, 75);
});
test('onStart, onUpdate y onComplete, cada uno cuando corresponde', () => {
	const m = new TweenManager(), o = { x: 0 }, log = [];
	m.add(o, { x: 1 }, 1, { onStart: () => log.push('s'), onUpdate: (t, p) => log.push('u' + p), onComplete: () => log.push('c') });
	m.update(0.5); m.update(0.5);
	eq(log.join(','), 's,u0.5,u1,c');
});
test('from fija el inicio al arrancar', () => {
	const m = new TweenManager(), o = { a: 7 };
	m.add(o, { a: 1 }, 1, { from: { a: 0 } });
	m.update(0.5); near(o.a, 0.5);
});
test('duración 0 completa en el primer update', () => {
	const m = new TweenManager(), o = { x: 0 }; let done = 0;
	m.add(o, { x: 9 }, 0, { onComplete: () => done++ });
	m.update(0.016); eq(o.x, 9); eq(done, 1);
});
test('repeat: n veces más, con la sobra de tiempo', () => {
	const m = new TweenManager(), o = { x: 0 }; let done = 0;
	m.add(o, { x: 10 }, 1, { repeat: 1, onComplete: () => done++ });
	m.update(1.25); near(o.x, 2.5);
	m.update(0.75); near(o.x, 10); eq(done, 1); eq(m.count, 0);
});
test('yoyo vuelve al valor de partida', () => {
	const m = new TweenManager(), o = { x: 0 };
	m.add(o, { x: 10 }, 1, { repeat: 1, yoyo: true });
	m.update(1); m.update(0.5); near(o.x, 5);
	m.update(0.5); near(o.x, 0); eq(m.count, 0);
});
test('repeat infinito no termina', () => {
	const m = new TweenManager(), o = { x: 0 };
	m.add(o, { x: 1 }, 0.1, { repeat: true });
	for (let i = 0; i < 100; i++) m.update(0.05);
	eq(m.count, 1);
});
test('overwrite: el tween nuevo le saca la propiedad al viejo', () => {
	const m = new TweenManager(), o = { x: 0, y: 0 };
	const a = m.add(o, { x: 100, y: 100 }, 1);
	m.update(0.5);
	m.add(o, { x: 0 }, 1);
	m.update(0.5);
	near(o.y, 100);            // y siguió con el viejo
	near(o.x, 25);
	eq(a.active, false);
});
test('overwrite: un tween que se queda sin propiedades se cancela', () => {
	const m = new TweenManager(), o = { x: 0 };
	const a = m.add(o, { x: 100 }, 1);
	m.add(o, { x: 5 }, 1);
	eq(a.state, 'cancelled');
});
test('overwrite:false deja convivir los dos', () => {
	const m = new TweenManager(), o = { x: 0 };
	const a = m.add(o, { x: 100 }, 1);
	m.add(o, { x: 5 }, 1, { overwrite: false });
	eq(a.active, true);
});
test('cancel no llama a onComplete y frena el valor', () => {
	const m = new TweenManager(), o = { x: 0 }; let done = 0;
	const t = m.add(o, { x: 100 }, 1, { onComplete: () => done++ });
	m.update(0.3); t.cancel(); m.update(0.3);
	near(o.x, 30); eq(done, 0); eq(m.count, 0);
});
test('finish salta al final y llama a onComplete', () => {
	const m = new TweenManager(), o = { x: 0 }; let done = 0;
	const t = m.add(o, { x: 100 }, 1, { onComplete: () => done++ });
	t.finish(); near(o.x, 100); eq(done, 1);
});
test('kill por objeto y por propiedad', () => {
	const m = new TweenManager(), o = { x: 0, y: 0 };
	m.add(o, { x: 1 }, 1); m.add(o, { y: 1 }, 1);
	m.kill(o, ['x']); eq(m.count, 1);
	m.kill(o); eq(m.count, 0);
});
test('crear un tween dentro de un callback arranca en el cuadro siguiente', () => {
	const m = new TweenManager(), o = { x: 0 }, p = { x: 0 };
	m.add(o, { x: 1 }, 0.5, { onComplete: () => m.add(p, { x: 10 }, 1) });
	m.update(0.5); eq(p.x, 0); eq(m.count, 1);
	m.update(0.5); near(p.x, 5);
});
test('clear dentro de un callback no rompe el recorrido', () => {
	const m = new TweenManager(), a = { x: 0 }, b = { x: 0 };
	m.add(a, { x: 1 }, 0.1, { onComplete: () => m.clear() });
	m.add(b, { x: 1 }, 1);
	m.update(0.1); eq(m.count, 0);
});
test('finished resuelve true al terminar y false al cancelar', async () => {
	const m = new TweenManager();
	const t1 = m.add({ x: 0 }, { x: 1 }, 0.1), t2 = m.add({ y: 0 }, { y: 1 }, 1);
	const p1 = t1.finished, p2 = t2.finished;
	m.update(0.1); t2.cancel();
	eq(await p1, true); eq(await p2, false);
});
test('el objetivo tiene que ser un objeto', () => {
	let threw = false; try { new TweenManager().add(5, { x: 1 }, 1); } catch (e) { threw = true; }
	if (!threw) throw new Error('aceptó un número');
});


// --- Integración con una instancia de Js2d (con un DOM mínimo de mentira) ---
const noop = () => {};
const fakeCtx = new Proxy({}, { get: () => noop, set: () => true });
const fakeCanvas = { getContext: () => fakeCtx, addEventListener: noop, removeEventListener: noop, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), width: 800, height: 600, parentElement: null };
const sandbox = vm.createContext({
	console, Math, Promise, setTimeout, clearTimeout,
	window: { addEventListener: noop, removeEventListener: noop, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, visualViewport: null },
	document: { addEventListener: noop, body: { appendChild: noop }, createElement: () => fakeCanvas, documentElement: { clientWidth: 800, clientHeight: 600 } },
	navigator: {}, localStorage: {}, Image: function () {}, Audio: function () {},
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js2d.js'), 'utf8'), sandbox);
let js = null;
try { js = vm.runInContext('new Js2d(canvasStub)', Object.assign(sandbox, { canvasStub: fakeCanvas })); }
catch (e) { console.log('  (integración omitida: ' + e.message + ')'); }
if (js) {
	// Avanza el reloj del motor en cuadros de 50 ms (tick recorta los cuadros largos).
	let clock = 1000;
	const frames = n => { for (let i = 0; i < n; i++) js.tick(clock += 50); };
	js.tick(clock);
	test('tick() avanza los tweens con el delta del cuadro', () => {
		const o = { x: 0 };
		js.tween(o, { x: 100 }, 1);
		frames(10); near(o.x, 50);
		frames(10); near(o.x, 100); eq(js.tweens.count, 0);
	});
	test('after() ejecuta la función una vez, a tiempo', () => {
		let n = 0;
		js.after(1, () => n++);
		frames(10); eq(n, 0);
		frames(11); eq(n, 1);
		frames(20); eq(n, 1);
	});
	test('killTweens y destroy() limpian', () => {
		const o = { x: 0 };
		js.tween(o, { x: 1 }, 5);
		js.killTweens(o); eq(js.tweens.count, 0);
		js.tween(o, { x: 1 }, 5); js.destroy(); eq(js.tweens.count, 0);
	});
}

// Los tests async terminan después: esperar un tick antes de reportar.
setTimeout(() => { console.log(`\n${ok} pasaron, ${fail} fallaron.`); process.exit(fail ? 1 : 0); }, 20);
