// Pruebas del paso fijo de simulación. Correr: node test/fixed.test.js
const { load, runner } = require('./harness');
const { test, near, eq, done } = runner();

const env = load();
env.sandbox.navigator.getGamepads = () => [];
const mk = () => env.make();

// Corre `seconds` de pantalla a `fps` cuadros por segundo (con jitter opcional en ms) y devuelve
// los pasos totales. `body(js, steps)` se llama una vez por cuadro; por defecto sólo cuenta.
function simulate(js, { fps = 60, seconds = 1, jitter = 0, start = 1000, each = null } = {}) {
	let t = start, total = 0;
	js.tick(t);
	js.fixed.run(() => {});                    // el primer cuadro (1/60) se descarta del conteo
	js.fixed.reset();
	const frames = Math.round(fps * seconds);
	for (let i = 0; i < frames; i++) {
		t += 1000 / fps + (jitter ? (i % 2 ? jitter : -jitter) : 0);
		js.tick(t);
		total += js.fixed.run((dt, k, n) => { if (each) each(dt, k, n); });
	}
	return total;
}

test('a 60 fps hay un paso por cuadro', () => {
	const js = mk(); eq(simulate(js, { fps: 60, seconds: 2 }), 120);
});
test('a 30 fps hay dos pasos por cuadro', () => {
	const js = mk();
	const seen = [];
	simulate(js, { fps: 30, seconds: 1, each: (dt, i, n) => seen.push(n) });
	eq(seen.every(n => n === 2), true); eq(js.fixed.steps, 2);
});
test('a 144 fps hay menos cuadros que pasos; en total, 60 por segundo', () => {
	const js = mk();
	const total = simulate(js, { fps: 144, seconds: 5 });
	if (Math.abs(total - 300) > 2) throw new Error('pasos: ' + total);
});
test('con jitter de ±0,5 ms a 60 Hz sigue siendo exactamente un paso por cuadro', () => {
	const js = mk(); eq(simulate(js, { fps: 60, seconds: 3, jitter: 0.5 }), 180);
	const seen = new Set();
	const js2 = mk(); simulate(js2, { fps: 60, seconds: 3, jitter: 0.5, each: (d, i, n) => seen.add(n) });
	eq([...seen].join(), '1');
});
test('sin tolerancia, ese mismo jitter produce cuadros sin paso (el problema que resuelve)', () => {
	const js = mk(); js.fixed.tolerance = 0;
	const seen = new Set(); let zero = 0;
	let t = 1000; js.tick(t); js.fixed.run(() => {}); js.fixed.reset();
	for (let i = 0; i < 180; i++) {
		t += 1000 / 60 + (i % 2 ? 0.5 : -0.5); js.tick(t);
		if (js.fixed.run(() => {}) === 0) zero++;
	}
	if (zero === 0) throw new Error('el caso de prueba no reproduce el problema');
});
test('el resultado de la simulación no depende de los cuadros por segundo', () => {
	const run = (fps) => {
		const js = mk(); let x = 0, v = 0;
		simulate(js, { fps, seconds: 2, each: (dt) => { v += 100 * dt; x += v * dt; } });   // aceleración 100
		return x;
	};
	const a = run(30), b = run(60), c = run(144), d = run(75);
	const ref = b;
	for (const x of [a, c, d]) if (Math.abs(x - ref) / ref > 0.02) throw new Error(`${x} vs ${ref}`);
});
test('el callback recibe el paso, el índice y la cantidad', () => {
	const js = mk(); js.tick(1000); js.fixed.run(() => {}); js.fixed.reset();
	js.tick(1000 + 1000 / 15);        // 66,7 ms = 4 pasos
	const args = [];
	eq(js.fixed.run((dt, i, n) => args.push([Math.round(dt * 6000), i, n].join())), 4);
	eq(args.join('|'), '100,0,4|100,1,4|100,2,4|100,3,4');
});
test('hay un tope de pasos por cuadro y el resto se descarta', () => {
	const js = mk(); js.fixed.maxSteps = 3; js.tick(1000); js.fixed.run(() => {}); js.fixed.reset();
	js.tick(1000 + 100);              // el cuadro más largo que deja pasar tick()
	eq(js.fixed.run(() => {}), 3); eq(js.fixed.lagged, true);
	js.tick(1000 + 100 + 1000 / 60);
	eq(js.fixed.run(() => {}), 1); eq(js.fixed.lagged, false);   // no se acumula deuda
});
test('un cuadro larguísimo no manda más de maxSteps pasos', () => {
	const js = mk(); js.tick(1000); js.fixed.run(() => {}); js.fixed.reset();
	js.tick(1000 + 60000);
	if (js.fixed.run(() => {}) > js.fixed.maxSteps) throw new Error('pasó el tope');
});
test('alpha es la fracción pendiente del paso, entre 0 y 1', () => {
	const js = mk(); js.fixed.tolerance = 0; js.tick(1000); js.fixed.run(() => {}); js.fixed.reset();
	js.tick(1000 + 1000 / 120 * 3);   // 1,5 pasos
	eq(js.fixed.run(() => {}), 1); near(js.fixed.alpha, 0.5, 1e-9);
	for (let i = 0; i < 100; i++) { js.tick(1000 + 1000 / 120 * 3 + i * 3.1); js.fixed.run(() => {}); if (js.fixed.alpha < 0 || js.fixed.alpha > 1) throw new Error('alpha ' + js.fixed.alpha); }
});
test('hz cambia el tamaño del paso', () => {
	const js = mk(); js.fixed.hz = 30;
	near(js.fixed.step, 1 / 30);
	eq(simulate(js, { fps: 60, seconds: 2 }), 60);
});
test('timeScale: cámara lenta y rápida', () => {
	const slow = mk(); slow.fixed.timeScale = 0.5; eq(simulate(slow, { fps: 60, seconds: 2 }), 60);
	const fast = mk(); fast.fixed.timeScale = 2; eq(simulate(fast, { fps: 30, seconds: 1 }), 120);   // 1 s de pantalla = 2 s de juego
});
test('pausa: no hay pasos y al reanudar no se recupera el tiempo perdido', () => {
	const js = mk(); simulate(js, { fps: 60, seconds: 0.5, start: 1000 });
	js.fixed.paused = true;
	let t = 1500;
	for (let i = 0; i < 60; i++) { t += 1000 / 60; js.tick(t); eq(js.fixed.run(() => {}), 0); }
	js.fixed.paused = false;
	t += 1000 / 60; js.tick(t); eq(js.fixed.run(() => {}), 1);
});
test('ticks y time cuentan los pasos simulados; reset los pone en cero', () => {
	const js = mk(); simulate(js, { fps: 60, seconds: 1 });
	eq(js.fixed.ticks, 60); near(js.fixed.time, 1, 1e-9);
	js.fixed.reset(); eq(js.fixed.ticks, 0); eq(js.fixed.time, 0);
});
test('el callback puede cortar devolviendo false', () => {
	const js = mk(); js.tick(1000); js.fixed.run(() => {}); js.fixed.reset();
	js.tick(1000 + 50);
	eq(js.fixed.run((dt, i) => i === 1 ? false : undefined), 2);
	eq(js.fixed.ticks, 2);
});
test('si el callback tira error, el acumulado no se pierde ni se corrompe', () => {
	const js = mk(); js.tick(1000); js.fixed.run(() => {}); js.fixed.reset();
	js.tick(1000 + 17);
	let threw = false; try { js.fixed.run(() => { throw new Error('x'); }); } catch (e) { threw = true; }
	eq(threw, true);
	eq(js.fixed.run(() => {}), 1);   // el paso que falló sigue pendiente
});

// --- teclas en pasos fijos ---
const keyDown = (js, code) => js.fireWindow('keydown', { code });
const keyUp = (js, code) => js.fireWindow('keyup', { code });

test('consumePressed: una apretada llega a un solo paso, aunque el cuadro tenga varios', () => {
	const js = mk(); js.input.bind('saltar', 'Space');
	let t = 1000; js.tick(t); js.fixed.run(() => {}); js.fixed.reset();
	keyDown(js, 'Space');
	t += 1000 / 30; js.tick(t);                       // 30 fps: dos pasos
	const seen = [];
	js.fixed.run(() => seen.push(js.input.consumePressed('saltar')));
	eq(seen.join(), 'true,false');
	t += 1000 / 30; js.tick(t);
	const seen2 = []; js.fixed.run(() => seen2.push(js.input.consumePressed('saltar')));
	eq(seen2.join(), 'false,false');
});
test('consumePressed: una apretada en un cuadro sin pasos no se pierde', () => {
	const js = mk(); js.input.bind('saltar', 'Space');
	js.fixed.tolerance = 0;
	let t = 1000; js.tick(t); js.fixed.run(() => {}); js.fixed.reset();
	t += 1000 / 144; js.tick(t); eq(js.fixed.run(() => {}), 0);      // cuadro corto: sin pasos
	keyDown(js, 'Space'); t += 1000 / 144; js.tick(t);
	eq(js.fixed.run(() => {}), 0);                                     // otra vez sin pasos, con la tecla ya apretada
	let got = false;
	for (let i = 0; i < 4 && !got; i++) { t += 1000 / 144; js.tick(t); js.fixed.run(() => { if (js.input.consumePressed('saltar')) got = true; }); }
	eq(got, true);
});
test('lo que ningún paso consume se descarta al terminar un run con pasos', () => {
	const js = mk(); js.input.bind('saltar', 'Space');
	let t = 1000; js.tick(t); js.fixed.run(() => {}); js.fixed.reset();
	keyDown(js, 'Space'); t += 1000 / 60; js.tick(t);
	eq(js.fixed.run(() => {}), 1);                                     // nadie lo preguntó
	keyUp(js, 'Space'); t += 1000 / 60; js.tick(t);
	let late = false; js.fixed.run(() => { late = js.input.consumePressed('saltar'); });
	eq(late, false);                                                   // no aparece tarde
});
test('consumeReleased funciona igual', () => {
	const js = mk(); js.input.bind('disparar', 'KeyF');
	let t = 1000; js.tick(t); js.fixed.run(() => {}); js.fixed.reset();
	keyDown(js, 'KeyF'); t += 1000 / 60; js.tick(t); js.fixed.run(() => js.input.consumePressed('disparar'));
	keyUp(js, 'KeyF'); t += 1000 / 60; js.tick(t);
	let rel = false; js.fixed.run(() => { rel = js.input.consumeReleased('disparar'); });
	eq(rel, true);
});
test('consumePressed de una acción sin asignar avisa', () => {
	const js = mk(); let threw = false; try { js.input.consumePressed('nada'); } catch (e) { threw = true; }
	eq(threw, true);
});

done();
