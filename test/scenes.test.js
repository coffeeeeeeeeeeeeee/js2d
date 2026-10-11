// Pruebas de escenas y screen shake. Correr: node test/scenes.test.js
const { load, runner } = require('./harness');
const { test, near, eq, done } = runner();

const env = load();
const js = env.make();
const log = [];
const mk = (name, extra = {}) => ({
	enter: (p, from) => log.push(`${name}.enter(${JSON.stringify(p)},${from})`),
	exit: (to) => log.push(`${name}.exit(${to})`),
	pause: () => log.push(`${name}.pause`),
	resume: () => log.push(`${name}.resume`),
	update: (dt) => log.push(`${name}.update`),
	draw: () => log.push(`${name}.draw`),
	...extra,
});
const take = () => log.splice(0).join(' ');

js.scenes.add('menu', mk('menu'));
js.scenes.add('juego', mk('juego'));
js.scenes.add('pausa', mk('pausa', { overlay: true }));

test('switch entra a la escena y le pasa los parámetros', () => {
	js.scenes.switch('menu', { a: 1 });
	eq(take(), 'menu.enter({"a":1},null)'); eq(js.scenes.current, 'menu');
});
test('update y draw van a la de arriba', () => {
	js.scenes.update(0.016); js.scenes.draw();
	eq(take(), 'menu.update menu.draw');
});
test('switch sale de la anterior y entra a la nueva', () => {
	js.scenes.switch('juego');
	eq(take(), 'menu.exit(juego) juego.enter({},menu)');
});
test('push pausa la de abajo; pop la retoma', () => {
	js.scenes.push('pausa');
	eq(take(), 'juego.pause pausa.enter({},juego)'); eq(js.scenes.stack.join(), 'juego,pausa');
	js.scenes.pop();
	eq(take(), 'pausa.exit(juego) juego.resume'); eq(js.scenes.current, 'juego');
});
test('con una escena overlay se dibuja también la de abajo, pero sólo la de arriba hace update', () => {
	js.scenes.push('pausa'); take();
	js.scenes.update(0.016); js.scenes.draw();
	eq(take(), 'pausa.update juego.draw pausa.draw');
	js.scenes.pop(); take();
});
test('pop con una sola escena no hace nada', () => {
	js.scenes.pop(); eq(take(), ''); eq(js.scenes.current, 'juego');
});
test('escena desconocida y no-objeto tiran error', () => {
	let n = 0;
	try { js.scenes.switch('nada'); } catch (e) { n++; }
	try { js.scenes.push('nada'); } catch (e) { n++; }
	try { js.scenes.add('x', 5); } catch (e) { n++; }
	eq(n, 3);
});
test('cambiar de escena desde un update no rompe el cuadro', () => {
	js.scenes.add('a', mk('a', { update() { log.push('a.update'); js.scenes.switch('menu'); } }));
	js.scenes.switch('a'); take();
	js.scenes.update(0.016);
	eq(take(), 'a.update a.exit(menu) menu.enter({},a)');
	js.scenes.draw(); eq(take(), 'menu.draw');
});

test('switch con fundido: oscurece, cambia en la mitad, aclara, y congela update', () => {
	js.scenes.switch('juego'); take();
	js.scenes.switch('menu', {}, { fade: 1 });   // 0,5 s para oscurecer + 0,5 s para aclarar
	eq(js.scenes.transitioning, true); eq(take(), '');
	js.scenes.update(0.25); eq(take(), ''); eq(js.scenes.current, 'juego');   // sin update durante el fundido
	js.scenes.update(0.25); eq(js.scenes.current, 'menu');
	eq(take(), 'juego.exit(menu) menu.enter({},juego)');
	js.scenes.update(0.25); eq(js.scenes.transitioning, true);
	js.scenes.update(0.25); eq(js.scenes.transitioning, false);
	eq(take(), 'menu.update');   // el cuadro en que termina el fundido ya actualiza la escena
	js.scenes.update(0.016); eq(take(), 'menu.update');
});
test('el fundido pinta un rectángulo con alpha parcial', () => {
	js.scenes.switch('juego'); take();
	js.scenes.switch('menu', {}, { fade: 1 });
	js.scenes.update(0.25);
	env.calls.length = 0;
	js.scenes.draw();
	const alpha = env.calls.find(c => c[0] === 'set:globalAlpha');
	near(alpha[1], 0.5);
	if (!env.calls.some(c => c[0] === 'fillRect')) throw new Error('no pintó el velo');
	js.scenes.update(1); js.scenes.update(1); take();
});
test('un segundo switch durante el fundido de salida gana el último', () => {
	js.scenes.switch('juego'); take();
	js.scenes.switch('menu', {}, { fade: 1 });
	js.scenes.update(0.2);
	js.scenes.switch('pausa', {}, { fade: 1 });
	js.scenes.update(0.5); eq(js.scenes.current, 'pausa');
	js.scenes.update(1); take();
});
test('el primer switch con fundido, sin escena previa, entra directo', () => {
	const j2 = env.make();
	j2.scenes.add('m', mk('m'));
	j2.scenes.switch('m', {}, { fade: 1 });
	eq(j2.scenes.current, 'm'); eq(j2.scenes.transitioning, false); take();
});

// --- shake ---
const frame = (j, dt = 1 / 60) => { j.tick(frame.t += dt * 1000); };
frame.t = 5000;
const sh = env.make();
frame(sh);

test('sin shake no hay desplazamiento', () => {
	frame(sh); eq(sh.shakeOffset.x, 0); eq(sh.shakeOffset.y, 0);
});
test('shake mueve el offset y se apaga solo al terminar la duración', () => {
	sh.shake(20, 0.5);
	let max = 0;
	for (let i = 0; i < 20; i++) { frame(sh); max = Math.max(max, Math.abs(sh.shakeOffset.x), Math.abs(sh.shakeOffset.y)); }
	if (!(max > 0.5)) throw new Error('no se movió: ' + max);
	if (max > 40) throw new Error('se pasó de la magnitud: ' + max);
	for (let i = 0; i < 30; i++) frame(sh);
	eq(sh.shakeOffset.x, 0); eq(sh.shakeOffset.y, 0); eq(sh.shakeOffset.rotation, 0);
});
test('axis x deja y en cero', () => {
	sh.shake(20, 0.5, { axis: 'x' });
	for (let i = 0; i < 10; i++) { frame(sh); eq(sh.shakeOffset.y, 0); }
	sh.stopShake();
});
test('rotation produce giro en radianes dentro del máximo', () => {
	sh.shake(5, 1, { rotation: 2 });
	let maxRot = 0;
	for (let i = 0; i < 30; i++) { frame(sh); maxRot = Math.max(maxRot, Math.abs(sh.shakeOffset.rotation)); }
	if (!(maxRot > 0)) throw new Error('no giró');
	if (maxRot > 2 * Math.PI / 180 + 1e-9) throw new Error('giró de más: ' + maxRot);
	sh.stopShake();
});
test('stop() del handle y stopShake() cortan el temblor', () => {
	const h = sh.shake(20, 5);
	frame(sh); h.stop(); frame(sh);
	eq(sh.shakeOffset.x, 0);
	sh.shake(20, 5); frame(sh); sh.stopShake(); eq(sh.shakeOffset.x, 0);
});
test('shakeEnabled = false lo apaga aunque haya shakes pedidos', () => {
	sh.shakeEnabled = false;
	sh.shake(50, 1);
	for (let i = 0; i < 5; i++) { frame(sh); eq(sh.shakeOffset.x, 0); }
	sh.shakeEnabled = true; sh.stopShake();
});
test('magnitud o duración inválidas se ignoran', () => {
	sh.shake(0, 1); sh.shake(5, 0); sh.shake(-3, 1); frame(sh); eq(sh.shakeOffset.x, 0);
});
test('clearBg aplica translate DESPUÉS de pintar el fondo, y sólo si hay shake', () => {
	env.calls.length = 0; sh.clearBg('#000');
	eq(env.calls.some(c => c[0] === 'translate'), false);
	sh.shake(30, 1);
	for (let i = 0; i < 5; i++) frame(sh);
	env.calls.length = 0; sh.clearBg('#000');
	const iFill = env.calls.findIndex(c => c[0] === 'fillRect');
	const iTr = env.calls.findIndex(c => c[0] === 'translate');
	if (iFill < 0 || iTr < 0 || iTr < iFill) throw new Error('orden incorrecto: ' + JSON.stringify(env.calls.map(c => c[0])));
	sh.stopShake();
});
test('withoutShake restablece la transformación base y restaura al salir', () => {
	env.calls.length = 0;
	let inside = false;
	sh.withoutShake(() => { inside = true; });
	eq(inside, true);
	eq(env.calls.map(c => c[0]).join(), 'save,setTransform,restore');
});
test('withoutShake restaura aunque la función tire error', () => {
	env.calls.length = 0;
	try { sh.withoutShake(() => { throw new Error('x'); }); } catch (e) {}
	eq(env.calls[env.calls.length - 1][0], 'restore');
});

done();
