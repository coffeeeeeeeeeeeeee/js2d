// Pruebas del sistema de partículas. Correr: node test/particles.test.js
const { load, runner } = require('./harness');
const { test, near, eq, done } = runner();

const env = load();
const js = env.make();
const P = js.particles;
const still = { speed: 0, life: 1, size: 4 };   // sin azar: rangos fijos

test('emit crea la cantidad pedida y devuelve cuántas nacieron', () => {
	eq(P.emit(10, 20, 5, still), 5); eq(P.count, 5);
});
test('las partículas mueren al cumplir su vida y se reutilizan del pool', () => {
	P.update(0.5); eq(P.count, 5);
	P.update(0.6); eq(P.count, 0);
	P.emit(0, 0, 3, still); eq(P.count, 3);
	P.clear();
});
test('speed y angle: 0 va a la derecha, 90 baja, -90 sube', () => {
	const donde = (angle) => {
		P.clear();
		P.emit(0, 0, 1, { ...still, speed: 100, angle, life: 5 });
		P.update(1);
		env.calls.length = 0; P.draw();
		const [, x, y] = env.calls.find(c => c[0] === 'arc');
		return [Math.round(x), Math.round(y)].join();
	};
	eq(donde(0), '100,0'); eq(donde(90), '0,100'); eq(donde(-90), '0,-100'); eq(donde(180), '-100,0');
	P.clear();
});
test('el movimiento respeta la velocidad y la gravedad', () => {
	P.clear();
	P.emit(0, 0, 1, { ...still, speed: 100, angle: 0, life: 10, gravity: 200 });
	P.update(1);
	env.calls.length = 0; P.draw();
	const [, x, y] = env.calls.find(c => c[0] === 'arc');
	near(x, 100, 1e-6);       // vx constante: 100 * 1 s
	near(y, 200, 1e-6);       // vy = 200 tras 1 s; Euler semiimplícito: y += vy*dt
	P.clear();
});
test('drag frena de forma exponencial', () => {
	P.clear();
	P.emit(0, 0, 1, { ...still, speed: 100, angle: 0, life: 10, drag: 1 });
	P.update(1);
	env.calls.length = 0; P.draw();
	near(env.calls.find(c => c[0] === 'arc')[1], 100 * Math.exp(-1), 1e-6);
	P.clear();
});
test('un [min, max] sortea dentro del rango', () => {
	P.clear();
	P.emit(0, 0, 200, { ...still, life: [1, 2], speed: [50, 60], angle: 0 });
	P.update(0.001);
	env.calls.length = 0; P.draw();
	for (const c of env.calls.filter(c => c[0] === 'arc')) if (c[1] < 0.049 || c[1] > 0.061) throw new Error('x fuera de rango: ' + c[1]);
	P.clear();
});
test('spread 0 con angle sale derecho; sin angle ni spread sale para todos lados', () => {
	P.clear();
	P.emit(0, 0, 50, { ...still, speed: 100, angle: -90, life: 5 }); P.update(1);
	env.calls.length = 0; P.draw();
	for (const c of env.calls.filter(c => c[0] === 'arc')) { near(c[1], 0, 1e-6); near(c[2], -100, 1e-6); }
	P.clear();
	P.emit(0, 0, 100, { ...still, speed: 100, life: 5 }); P.update(1);
	env.calls.length = 0; P.draw();
	const xs = env.calls.filter(c => c[0] === 'arc').map(c => c[1]);
	if (!(Math.min(...xs) < -50 && Math.max(...xs) > 50)) throw new Error('no se repartió');
	P.clear();
});
test('radius hace nacer las partículas dentro de un disco', () => {
	P.clear();
	P.emit(100, 100, 100, { ...still, radius: 10, life: 5 });
	env.calls.length = 0; P.draw();
	for (const c of env.calls.filter(c => c[0] === 'arc')) if (Math.hypot(c[1] - 100, c[2] - 100) > 10 + 1e-9) throw new Error('afuera del disco');
	P.clear();
});
test('color y alpha se interpolan en la vida', () => {
	P.clear();
	P.emit(0, 0, 1, { ...still, life: 1, color: '#ff0000', endColor: '#0000ff', alpha: 1, endAlpha: 0 });
	P.update(0.5);
	env.calls.length = 0; P.draw();
	const fill = env.calls.filter(c => c[0] === 'set:fillStyle').pop()[1];
	eq(fill, 'rgb(128,0,128)');
	near(env.calls.filter(c => c[0] === 'set:globalAlpha').pop()[1], 0.5, 1e-9);
	P.clear();
});
test('formatos de color: #rgb, #rrggbbaa y rgba()', () => {
	P.clear();
	const fills = [];
	for (const color of ['#f00', '#00ff0080', 'rgba(10, 20, 30, 0.5)', 'cosa rara']) {
		P.emit(0, 0, 1, { ...still, life: 5, color });
		env.calls.length = 0; P.draw();
		fills.push(env.calls.filter(c => c[0] === 'set:fillStyle').pop()[1]);
		P.clear();
	}
	eq(fills.join('|'), 'rgb(255,0,0)|rgb(0,255,0)|rgb(10,20,30)|rgb(255,255,255)');
});
test('size cambia a endSize; si ya es 0 no se dibuja', () => {
	P.clear();
	P.emit(0, 0, 1, { ...still, life: 1, size: 10, endSize: 0 });
	P.update(0.5);
	env.calls.length = 0; P.draw();
	near(env.calls.find(c => c[0] === 'arc')[3], 5, 1e-9);
	P.clear();
});
test('el tope max descarta las nuevas', () => {
	P.clear(); P.max = 10;
	eq(P.emit(0, 0, 25, still), 10); eq(P.count, 10);
	P.max = 2000; P.clear();
});
test('stream emite según rate y se apaga con stop() o duration', () => {
	P.clear();
	const s = P.stream(0, 0, { ...still, life: 100 }, 10);
	P.update(0.5); eq(P.count, 5);
	P.update(0.25); eq(P.count, 7);    // 2,5 acumulado -> 2 más, queda 0,5
	const stop = s.stop; stop();       // suelto, sin perder el this
	P.update(1); eq(P.count, 7);
	P.clear();
	P.stream(0, 0, { ...still, life: 100 }, 10, 0.3);
	P.update(0.2); P.update(0.2); P.update(5);
	eq(P.count, 2);
	P.clear();
});
test('el stream sigue a x/y si se mueven', () => {
	P.clear();
	const s = P.stream(0, 0, { ...still, life: 100 }, 100);
	s.x = 500; P.update(0.01);
	env.calls.length = 0; P.draw();
	near(env.calls.find(c => c[0] === 'arc')[1], 500);
	s.stop(); P.clear();
});
test('presets: existen, se pueden pisar y uno desconocido avisa', () => {
	for (const name of Object.keys(P.constructor.presets)) { P.clear(); eq(P.emit(0, 0, 5, name), 5); P.update(0.05); env.calls.length = 0; P.draw(); }
	P.clear();
	P.emit(0, 0, 1, { preset: 'confetti', shape: 'circle', gravity: 0, speed: 0, life: 5, size: 7 });
	env.calls.length = 0; P.draw();
	eq(env.calls.find(c => c[0] === 'arc')[3], 7);
	let threw = false; try { P.emit(0, 0, 1, 'nada'); } catch (e) { threw = true; }
	if (!threw) throw new Error('no avisó');
	P.clear();
});
test('additive se dibuja al final con composite "lighter" y restaura al salir', () => {
	P.clear();
	P.emit(0, 0, 1, { ...still, life: 5, additive: true });
	P.emit(0, 0, 1, { ...still, life: 5 });
	env.calls.length = 0; P.draw();
	const ops = env.calls.filter(c => c[0] === 'set:globalCompositeOperation').map(c => c[1]);
	eq(ops.join(), 'source-over,lighter');
	eq(env.calls[0][0], 'save'); eq(env.calls[env.calls.length - 1][0], 'restore');
	P.clear();
});
test('formas: square rota, line traza, image dibuja la imagen', () => {
	P.clear();
	const img = { fake: true };
	P.emit(0, 0, 1, { ...still, life: 5, shape: 'square' });
	P.emit(0, 0, 1, { ...still, life: 5, shape: 'line' });
	P.emit(0, 0, 1, { ...still, life: 5, shape: 'image', image: img });
	env.calls.length = 0; P.draw();
	const names = env.calls.map(c => c[0]);
	for (const n of ['fillRect', 'rotate', 'lineTo', 'stroke', 'drawImage']) if (!names.includes(n)) throw new Error('falta ' + n);
	P.clear();
});
test('tick() avanza las partículas con el delta del cuadro, y destroy() las limpia', () => {
	const j2 = env.make();
	let clock = 1000; j2.tick(clock);
	j2.particles.emit(0, 0, 4, { ...{ speed: 0, size: 4 }, life: 0.2 });
	eq(j2.particles.count, 4);
	for (let i = 0; i < 6; i++) j2.tick(clock += 50);
	eq(j2.particles.count, 0);
	j2.particles.emit(0, 0, 4, still); j2.destroy(); eq(j2.particles.count, 0);
});

done();
