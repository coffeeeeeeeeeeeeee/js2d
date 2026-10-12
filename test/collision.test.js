// Pruebas de colisiones y de la rejilla espacial. Correr: node test/collision.test.js
const { load, runner } = require('./harness');
const { test, near, eq, done } = runner();

const env = load();
const C = env.get('Collision');
const SpatialGrid = env.get('SpatialGrid');
const R = (x, y, width, height) => ({ x, y, width, height });
const S = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
const ok = (c, msg) => { if (!c) throw new Error(msg || 'falló'); };

// --- segmentos ---
test('segmento contra rect: entra por la izquierda, con la normal hacia atrás', () => {
	const h = C.segmentRect(S(0, 5, 20, 5), R(10, 0, 10, 10));
	near(h.t, 0.5); near(h.x, 10); near(h.y, 5); eq(h.nx, -1); eq(h.ny, 0);
});
test('segmento contra rect: entra por arriba y por abajo', () => {
	let h = C.segmentRect(S(5, 0, 5, 20), R(0, 10, 10, 10)); near(h.t, 0.5); eq(h.ny, -1);
	h = C.segmentRect(S(5, 30, 5, 0), R(0, 10, 10, 10)); near(h.t, 1 / 3); eq(h.ny, 1);
});
test('segmento contra rect: errado, corto y paralelo afuera dan null', () => {
	eq(C.segmentRect(S(0, 20, 20, 20), R(10, 0, 10, 10)), null);
	eq(C.segmentRect(S(0, 5, 5, 5), R(10, 0, 10, 10)), null);
	eq(C.segmentRect(S(0, 15, 20, 15), R(10, 0, 10, 10)), null);
});
test('segmento que empieza adentro: t = 0, inside y normal nula', () => {
	const h = C.segmentRect(S(15, 5, 30, 5), R(10, 0, 10, 10));
	eq(h.t, 0); eq(h.inside, true); eq(h.nx, 0); eq(h.ny, 0);
});
test('segmento diagonal pega en la esquina correcta', () => {
	const h = C.segmentRect(S(0, 0, 20, 20), R(10, 10, 5, 5));
	near(h.t, 0.5); near(h.x, 10); near(h.y, 10);
});
test('segmento contra círculo: punto de impacto y normal', () => {
	const h = C.segmentCircle(S(-10, 0, 10, 0), { x: 0, y: 0, radius: 4 });
	near(h.t, 0.3); near(h.x, -4); near(h.nx, -1); near(h.ny, 0);
});
test('segmento contra círculo: rasante, errado y desde adentro', () => {
	eq(C.segmentCircle(S(-10, 5, 10, 5), { x: 0, y: 0, radius: 4 }), null);
	eq(C.segmentCircle(S(-10, 0, -6, 0), { x: 0, y: 0, radius: 4 }), null);
	eq(C.segmentCircle(S(0, 0, 10, 0), { x: 0, y: 0, radius: 4 }).inside, true);
});
test('segmento contra segmento: cruce, t, u y normal', () => {
	const h = C.segmentSegment(S(0, 0, 10, 0), S(5, -5, 5, 5));
	near(h.t, 0.5); near(h.u, 0.5); near(h.x, 5); near(h.y, 0);
	near(h.nx, -1); near(h.ny, 0);   // el segundo es vertical: la normal es horizontal y mira hacia donde viene el primero
});
test('segmento contra segmento: paralelos y sin cruce dan null', () => {
	eq(C.segmentSegment(S(0, 0, 10, 0), S(0, 5, 10, 5)), null);
	eq(C.segmentSegment(S(0, 0, 4, 0), S(5, -5, 5, 5)), null);
});
test('segmento contra polígono: el borde más cercano', () => {
	const tri = [{ x: 10, y: -5 }, { x: 20, y: -5 }, { x: 20, y: 5 }, { x: 10, y: 5 }];
	const h = C.segmentPolygon(S(0, 0, 30, 0), tri);
	near(h.x, 10); near(h.nx, -1); near(h.t, 1 / 3);
	eq(C.segmentPolygon(S(0, 10, 30, 10), tri), null);
});

// --- rayo ---
test('raycast elige la forma más cercana y devuelve la distancia', () => {
	const lejos = R(50, -5, 10, 10), cerca = { x: 20, y: 0, radius: 5 };
	const h = C.raycast({ x: 0, y: 0 }, { x: 3, y: 0 }, [lejos, cerca]);
	eq(h.shape, cerca); near(h.distance, 15); near(h.x, 15);
});
test('raycast respeta maxDistance y filter', () => {
	const w = R(50, -5, 10, 10);
	eq(C.raycast({ x: 0, y: 0 }, { x: 1, y: 0 }, [w], 40), null);
	near(C.raycast({ x: 0, y: 0 }, { x: 1, y: 0 }, [w], 60).distance, 50);
	eq(C.raycast({ x: 0, y: 0 }, { x: 1, y: 0 }, [w], Infinity, () => false), null);
	eq(C.raycast({ x: 0, y: 0 }, { x: 0, y: 0 }, [w]), null);
});
test('raycast con una forma de cada tipo', () => {
	const poly = [{ x: 30, y: -5 }, { x: 40, y: -5 }, { x: 40, y: 5 }, { x: 30, y: 5 }];
	const h = C.raycast({ x: 0, y: 0 }, { x: 1, y: 0 }, [R(60, -5, 5, 10), poly, { x: 80, y: 0, radius: 3 }]);
	eq(h.shape, poly); near(h.distance, 30);
});

// --- solapes ---
test('rects: empuja por el eje de menor solape, hacia el lado correcto', () => {
	let r = C.rects(R(0, 0, 10, 10), R(8, 0, 10, 10)); eq(r.nx, -1); eq(r.ny, 0); eq(r.depth, 2);
	r = C.rects(R(8, 0, 10, 10), R(0, 0, 10, 10)); eq(r.nx, 1);
	r = C.rects(R(0, 0, 10, 10), R(0, 9, 10, 10)); eq(r.ny, -1); eq(r.depth, 1);
});
test('rects: tocarse nada más no es chocar', () => {
	eq(C.rects(R(0, 0, 10, 10), R(10, 0, 10, 10)), null);
	eq(C.rects(R(0, 0, 10, 10), R(20, 0, 10, 10)), null);
});
test('aplicar el empuje deja de solapar', () => {
	const a = R(0, 0, 10, 10), b = R(7, 3, 10, 10);
	const r = C.rects(a, b);
	const moved = R(a.x + r.nx * r.depth, a.y + r.ny * r.depth, 10, 10);
	eq(C.rects(moved, b), null);
});
test('círculos', () => {
	const r = C.circles({ x: 0, y: 0, radius: 5 }, { x: 8, y: 0, radius: 5 });
	near(r.nx, -1); near(r.depth, 2);
	eq(C.circles({ x: 0, y: 0, radius: 5 }, { x: 10, y: 0, radius: 5 }), null);
	near(C.circles({ x: 1, y: 1, radius: 2 }, { x: 1, y: 1, radius: 2 }).depth, 4);   // mismo centro: no da NaN
});
test('círculo contra rect: lado, esquina y centro adentro', () => {
	const box = R(0, 0, 10, 10);
	let r = C.circleRect({ x: 12, y: 5, radius: 3 }, box); near(r.nx, 1); near(r.depth, 1);
	r = C.circleRect({ x: 12, y: 12, radius: 3 }, box); near(r.nx, Math.SQRT1_2); near(r.depth, 3 - Math.SQRT2 * 2);
	r = C.circleRect({ x: 9, y: 5, radius: 2 }, box); eq(r.nx, 1); near(r.depth, 3);   // adentro: sale por el lado más cercano
	eq(C.circleRect({ x: 14, y: 5, radius: 3 }, box), null);
});
test('polígonos convexos (SAT)', () => {
	const sq = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
	const r = C.polygons(sq(0, 0, 10), sq(8, 0, 10));
	near(Math.abs(r.nx), 1); near(r.depth, 2); ok(r.nx < 0, 'debe empujar a la izquierda');
	eq(C.polygons(sq(0, 0, 10), sq(11, 0, 10)), null);
	const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
	eq(C.polygons(tri, sq(6, 6, 4)), null);   // los cuadrados se tocan en la caja del triángulo pero no en el triángulo
});
test('polígono contra círculo', () => {
	const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
	const r = C.polygonCircle(sq, { x: 12, y: 5, radius: 3 });
	near(r.nx, -1); near(r.depth, 1);   // se mueve el polígono: a la izquierda
	eq(C.polygonCircle(sq, { x: 14, y: 5, radius: 3 }), null);
});
test('overlap despacha por tipo y es simétrico', () => {
	const r = R(0, 0, 10, 10), c = { x: 12, y: 5, radius: 3 };
	const a = C.overlap(r, c), b = C.overlap(c, r);
	near(a.nx, -b.nx); near(a.depth, b.depth);
	ok(C.overlap(r, R(5, 5, 10, 10)));
	eq(C.overlap(r, R(50, 50, 1, 1)), null);
	ok(C.overlap([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }], r));
});

// --- barrido y movimiento ---
test('sweepRect: frena justo antes de la pared, sin atravesarla aunque vaya muy rápido', () => {
	const h = C.sweepRect(R(0, 0, 10, 10), 1000, 0, R(50, 0, 5, 10));
	near(h.t, 40 / 1000); eq(h.nx, -1);
	eq(C.sweepRect(R(0, 0, 10, 10), 30, 0, R(50, 0, 5, 10)), null);
});
test('sweepRect: apoyado en el piso, caminar de costado no se engancha', () => {
	eq(C.sweepRect(R(0, 40, 10, 10), 5, 0, R(-100, 50, 400, 20)), null);
});
test('sweepRect: rozando el techo de un bloque que viene adelante, pasa de largo', () => {
	eq(C.sweepRect(R(0, 40, 10, 10), 30, 0, R(20, 50, 100, 20)), null);   // apoyado a ras
	eq(C.sweepRect(R(0, 60, 10, 10), 30, 0, R(20, 50, 100, 10)), null);   // a ras de la base
	near(C.sweepRect(R(0, 41, 10, 10), 30, 0, R(20, 50, 100, 20)).t, 10 / 30);   // un px más abajo ya choca
});
test('sweepRect: apoyado en una pared y yéndose para el otro lado no choca', () => {
	eq(C.sweepRect(R(40, 0, 10, 10), -5, 0, R(50, 0, 5, 10)), null);
});
test('moveAndCollide: cae al piso y queda apoyado en el borde exacto', () => {
	const suelo = R(0, 100, 200, 20);
	const r = C.moveAndCollide(R(50, 50, 10, 10), 0, 500, [suelo]);
	eq(r.y, 90); eq(r.bottom, true); eq(r.solids[0], suelo);
});
test('moveAndCollide: desliza por la pared, frena en X y sigue en Y', () => {
	const r = C.moveAndCollide(R(0, 0, 10, 10), 100, 20, [R(30, -50, 10, 200)]);
	eq(r.x, 20); eq(r.y, 20); eq(r.right, true); eq(r.bottom, false);
});
test('moveAndCollide: apoyado en el piso camina de costado cuadro tras cuadro', () => {
	const suelo = R(-1000, 100, 5000, 20);
	let p = { x: 0, y: 90, width: 10, height: 10 };
	for (let i = 0; i < 200; i++) {
		const r = C.moveAndCollide(p, 2.3, 4, [suelo]);   // la gravedad empuja cada cuadro
		p = { ...p, x: r.x, y: r.y };
		ok(r.bottom, 'perdió el apoyo en el cuadro ' + i);
	}
	near(p.x, 460, 1e-6); eq(p.y, 90);
});
test('moveAndCollide: techo y pared izquierda', () => {
	const r = C.moveAndCollide(R(50, 50, 10, 10), -100, -100, [R(0, 0, 40, 200), R(0, 0, 200, 30)]);
	eq(r.left, true); eq(r.top, true); eq(r.x, 40); eq(r.y, 30);
});
test('moveAndCollide: sin obstáculos ni movimiento', () => {
	const r = C.moveAndCollide(R(1, 2, 3, 4), 0, 0, [R(0, 0, 100, 100)]);
	eq(r.x, 1); eq(r.y, 2); eq(r.solids.length, 0);
	const q = C.moveAndCollide(R(1, 2, 3, 4), 5, -1, []);
	eq(q.x, 6); eq(q.y, 1);
});

// --- rejilla espacial ---
test('rejilla: query devuelve sólo lo que toca el área, sin repetidos', () => {
	const g = new SpatialGrid(10);
	const a = R(0, 0, 25, 25), b = R(100, 100, 5, 5), c = R(22, 22, 4, 4);
	[a, b, c].forEach(o => g.insert(o));
	eq(g.size, 3);
	const hits = g.query(R(20, 20, 10, 10));
	eq(hits.length, 2); ok(hits.includes(a) && hits.includes(c));
	eq(g.query(R(200, 200, 5, 5)).length, 0);
	eq(g.query(R(25, 0, 5, 5)).length, 0);   // tocarse nada más no cuenta
});
test('rejilla: update mueve el objeto y remove lo saca', () => {
	const g = new SpatialGrid(10), a = R(0, 0, 5, 5);
	g.insert(a);
	a.x = 100; a.y = 100; g.update(a);
	eq(g.query(R(0, 0, 10, 10)).length, 0); eq(g.query(R(98, 98, 10, 10)).length, 1);
	eq(g.remove(a), true); eq(g.remove(a), false); eq(g.size, 0); eq(g.has(a), false);
	g.update(a); eq(g.size, 1);   // update de uno que no estaba lo inserta
	g.clear(); eq(g.size, 0);
});
test('rejilla: insert de un objeto con otra caja (el objeto no tiene x, y, width, height)', () => {
	const g = new SpatialGrid(16), e = { nombre: 'x' };
	g.insert(e, R(40, 40, 8, 8));
	eq(g.query(R(44, 44, 1, 1))[0], e);
});
test('rejilla: coordenadas negativas y objetos grandes', () => {
	const g = new SpatialGrid(10), a = R(-35, -35, 20, 20), grande = R(-100, -100, 300, 300);
	g.insert(a); g.insert(grande);
	eq(g.query(R(-30, -30, 2, 2)).length, 2);
	eq(g.query(R(150, 150, 2, 2)).length, 1);
});
test('rejilla: queryPoint', () => {
	const g = new SpatialGrid(10), a = R(5, 5, 10, 10);
	g.insert(a);
	eq(g.queryPoint(10, 10)[0], a); eq(g.queryPoint(30, 30).length, 0); eq(g.queryPoint(16, 10).length, 0);
});
test('rejilla: querySegment ordena del más cercano al más lejano', () => {
	const g = new SpatialGrid(10), a = R(10, 0, 5, 5), b = R(40, 0, 5, 5), c = R(70, 50, 5, 5);
	[b, c, a].forEach(o => g.insert(o));
	const r = g.querySegment(S(0, 2, 100, 2));
	eq(r.length, 2); eq(r[0], a); eq(r[1], b);
});
test('rejilla: pairs da cada par una sola vez, aunque compartan varias celdas', () => {
	const g = new SpatialGrid(10);
	const a = R(0, 0, 35, 35), b = R(5, 5, 30, 30), c = R(200, 200, 5, 5), d = R(30, 30, 5, 5);
	[a, b, c, d].forEach(o => g.insert(o));
	const p = g.pairs();
	eq(p.length, 3);   // a-b, a-d, b-d
	ok(!p.some(([x, y]) => x === c || y === c));
});
test('rejilla: pairs coincide con la comparación de todos contra todos', () => {
	let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
	const items = Array.from({ length: 300 }, () => R(rnd() * 500 - 100, rnd() * 500 - 100, 2 + rnd() * 30, 2 + rnd() * 30));
	const g = new SpatialGrid(32);
	items.forEach(o => g.insert(o));
	let brute = 0;
	for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (C.rects(items[i], items[j])) brute++;
	eq(g.pairs().length, brute);
	const area = R(50, 50, 120, 90);
	eq(g.query(area).length, items.filter(o => C.rects(o, area)).length);
});

done();
