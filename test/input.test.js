// Pruebas de la entrada por acciones. Correr: node test/input.test.js
const { load, runner } = require('./harness');
const { test, near, eq, done } = runner();

const env = load();
let pads = [];
env.sandbox.navigator.getGamepads = () => pads;

const mk = () => { pads = []; return env.make(); };
let clock = 1000;
const tick = (js) => js.tick(clock += 16);
const keyDown = (js, code) => js.fireWindow('keydown', { code });
const keyUp = (js, code) => js.fireWindow('keyup', { code });
const pad = (over = {}) => ({
	index: 0, id: 'Pad de prueba', connected: true,
	buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
	axes: [0, 0, 0, 0], ...over,
});
const press = (p, i, value = 1) => { p.buttons[i] = { pressed: value > 0.5, value }; };
const throws = (fn) => { try { fn(); } catch (e) { return true; } return false; };

test('una acción se activa con cualquiera de sus teclas', () => {
	const js = mk();
	js.input.bind('saltar', 'Space', 'KeyW');
	tick(js); eq(js.input.isDown('saltar'), false);
	keyDown(js, 'KeyW'); tick(js); eq(js.input.isDown('saltar'), true);
	keyUp(js, 'KeyW'); tick(js); eq(js.input.isDown('saltar'), false);
	keyDown(js, 'Space'); tick(js); eq(js.input.isDown('saltar'), true);
});
test('pressed y released duran un solo cuadro', () => {
	const js = mk();
	js.input.bind('a', 'KeyA');
	tick(js); eq(js.input.pressed('a'), false);
	keyDown(js, 'KeyA'); tick(js);
	eq(js.input.pressed('a'), true); eq(js.input.isDown('a'), true);
	tick(js); eq(js.input.pressed('a'), false); eq(js.input.isDown('a'), true);
	keyUp(js, 'KeyA'); tick(js);
	eq(js.input.released('a'), true); eq(js.input.isDown('a'), false);
	tick(js); eq(js.input.released('a'), false);
});
test('un golpe de tecla más corto que un cuadro no se pierde', () => {
	const js = mk();
	js.input.bind('a', 'KeyA');
	tick(js);
	keyDown(js, 'KeyA'); keyUp(js, 'KeyA');
	tick(js); eq(js.input.pressed('a'), true);
	tick(js); eq(js.input.isDown('a'), false); eq(js.input.released('a'), true);
});
test('pressed lo ven todos los que pregunten en el mismo cuadro', () => {
	const js = mk();
	js.input.bind('a', 'KeyA');
	tick(js); keyDown(js, 'KeyA'); tick(js);
	eq(js.input.pressed('a'), true); eq(js.input.pressed('a'), true);
});
test('el mouse y el toque en pantalla cuentan como mouse:left', () => {
	const js = mk();
	js.input.bind('disparar', 'mouse:left');
	tick(js);
	js.fire('mousedown', { button: 0 }); tick(js); eq(js.input.pressed('disparar'), true);
	js.fire('mouseup', { button: 0 }); tick(js); eq(js.input.isDown('disparar'), false);
	js.fire('touchstart', { touches: [{ clientX: 1, clientY: 1 }], changedTouches: [{ clientX: 1, clientY: 1 }] });
	tick(js); eq(js.input.isDown('disparar'), true);
});
test('gamepad: botones por nombre', () => {
	const js = mk();
	js.input.bind('saltar', 'pad:A').bind('pausa', 'pad:Start');
	const p = pad(); pads = [p];
	tick(js); eq(js.input.isDown('saltar'), false);
	press(p, 0); tick(js); eq(js.input.pressed('saltar'), true); eq(js.input.isDown('pausa'), false);
	press(p, 0, 0); press(p, 9); tick(js); eq(js.input.isDown('saltar'), false); eq(js.input.isDown('pausa'), true);
});
test('gamepad: los gatillos son analógicos y cuentan como apretados desde la mitad', () => {
	const js = mk();
	js.input.bind('acelerar', 'pad:RT');
	const p = pad(); pads = [p];
	press(p, 7, 0.3); tick(js); near(js.input.value('acelerar'), 0.3); eq(js.input.isDown('acelerar'), false);
	press(p, 7, 0.8); tick(js); near(js.input.value('acelerar'), 0.8); eq(js.input.isDown('acelerar'), true);
});
test('palanca: zona muerta radial y reescalado', () => {
	const js = mk();
	js.input.bind('izq', 'pad:LStickLeft').bind('der', 'pad:LStickRight').bind('arr', 'pad:LStickUp').bind('aba', 'pad:LStickDown');
	const p = pad(); pads = [p];
	p.axes = [0.15, 0.1, 0, 0]; tick(js);
	eq(js.input.value('der'), 0); eq(js.input.value('aba'), 0);          // adentro de la zona muerta
	p.axes = [1, 0, 0, 0]; tick(js); near(js.input.value('der'), 1); eq(js.input.isDown('der'), true);
	p.axes = [0.6, 0, 0, 0]; tick(js); near(js.input.value('der'), (0.6 - 0.2) / 0.8);
	p.axes = [-1, -1, 0, 0]; tick(js);
	near(js.input.value('izq'), Math.SQRT1_2); near(js.input.value('arr'), Math.SQRT1_2);   // diagonal completa: largo 1
	eq(js.input.value('der'), 0);
});
test('la palanca derecha es independiente de la izquierda', () => {
	const js = mk();
	js.input.bind('miraDer', 'pad:RStickRight').bind('izq', 'pad:LStickRight');
	const p = pad({ axes: [0, 0, 1, 0] }); pads = [p];
	tick(js); near(js.input.value('miraDer'), 1); eq(js.input.value('izq'), 0);
});
test('varios gamepads se suman en uno', () => {
	const js = mk();
	js.input.bind('a', 'pad:A').bind('der', 'pad:LStickRight');
	const p1 = pad({ index: 0 }), p2 = pad({ index: 1, axes: [0.9, 0, 0, 0] });
	press(p2, 0); pads = [p1, p2];
	tick(js); eq(js.input.isDown('a'), true); eq(js.input.isDown('der'), true);
	eq(js.input.gamepads.length, 2);
});
test('un gamepad desconectado se ignora', () => {
	const js = mk();
	js.input.bind('a', 'pad:A');
	const p = pad({ connected: false }); press(p, 0); pads = [p, null];
	tick(js); eq(js.input.isDown('a'), false); eq(js.input.gamepads.length, 0);
});
test('axis y vector combinan acciones; en diagonal con teclado el largo no pasa de 1', () => {
	const js = mk();
	js.input.bindAll({ izq: ['KeyA'], der: ['KeyD'], arr: ['KeyW'], aba: ['KeyS'] });
	tick(js);
	keyDown(js, 'KeyD'); tick(js);
	near(js.input.axis('izq', 'der'), 1);
	let v = js.input.vector('izq', 'der', 'arr', 'aba'); near(v.x, 1); near(v.y, 0);
	keyDown(js, 'KeyS'); tick(js);
	v = js.input.vector('izq', 'der', 'arr', 'aba'); near(Math.hypot(v.x, v.y), 1); near(v.x, Math.SQRT1_2);
	keyDown(js, 'KeyA'); tick(js);
	near(js.input.axis('izq', 'der'), 0);        // las dos se anulan
});
test('una palanca a medias da un vector de largo menor que 1', () => {
	const js = mk();
	js.input.bindAll({ izq: 'pad:LStickLeft', der: 'pad:LStickRight', arr: 'pad:LStickUp', aba: 'pad:LStickDown' });
	pads = [pad({ axes: [0.6, 0, 0, 0] })]; tick(js);
	const v = js.input.vector('izq', 'der', 'arr', 'aba');
	near(v.x, 0.5); near(v.y, 0);
});
test('teclado y gamepad en la misma acción: gana el mayor', () => {
	const js = mk();
	js.input.bind('der', 'KeyD', 'pad:LStickRight');
	pads = [pad({ axes: [0.6, 0, 0, 0] })]; tick(js);
	near(js.input.value('der'), 0.5);
	keyDown(js, 'KeyD'); tick(js); near(js.input.value('der'), 1);
});
test('acciones virtuales para controles táctiles', () => {
	const js = mk();
	js.input.bind('saltar', 'Space');
	tick(js); js.input.setVirtual('saltar', 1); tick(js);
	eq(js.input.pressed('saltar'), true);
	js.input.setVirtual('saltar', 0); tick(js); eq(js.input.isDown('saltar'), false);
});
test('rebind: bind reemplaza; bindings, unbind y actions', () => {
	const js = mk();
	js.input.bind('a', 'KeyA', 'pad:A');
	eq(js.input.bindings('a').join(), 'KeyA,pad:A');
	js.input.bind('a', 'KeyJ'); eq(js.input.bindings('a').join(), 'KeyJ');
	keyDown(js, 'KeyA'); tick(js); eq(js.input.isDown('a'), false);
	eq(js.input.actions.join(), 'a');
	js.input.unbind('a'); eq(js.input.actions.length, 0);
	eq(js.input.bindings('a').length, 0);
});
test('exportBindings / importBindings: ida y vuelta', () => {
	const js = mk();
	js.input.bindAll({ a: ['KeyA', 'pad:A'], b: 'mouse:right' });
	const saved = JSON.parse(JSON.stringify(js.input.exportBindings()));
	const js2 = mk(); js2.input.importBindings(saved);
	eq(js2.input.bindings('a').join(), 'KeyA,pad:A'); eq(js2.input.bindings('b').join(), 'mouse:right');
});
test('errores: acción sin asignar, fuentes mal escritas', () => {
	const js = mk();
	eq(throws(() => js.input.isDown('nada')), true);
	eq(throws(() => js.input.bind('x', 'pad:Z')), true);
	eq(throws(() => js.input.bind('x', 'pad:LStickDiagonal')), true);
	eq(throws(() => js.input.bind('x', 'mouse:izquierdo')), true);
	eq(throws(() => js.input.bind('x', '')), true);
	eq(js.input.actions.length, 0);   // un bind fallido no deja nada a medias
});
test('device recuerda el último dispositivo usado', () => {
	const js = mk();
	tick(js); eq(js.input.device, 'keyboard');
	const p = pad(); pads = [p]; press(p, 3); tick(js); eq(js.input.device, 'gamepad');
	press(p, 3, 0); tick(js);
	js.fire('mousedown', { button: 0 }); tick(js); eq(js.input.device, 'mouse');
	keyDown(js, 'KeyQ'); tick(js); eq(js.input.device, 'keyboard');
});
test('perder el foco suelta las teclas apretadas', () => {
	const js = mk();
	js.input.bind('a', 'KeyA');
	keyDown(js, 'KeyA'); tick(js); eq(js.input.isDown('a'), true);
	js.fireWindow('blur'); tick(js); eq(js.input.isDown('a'), false);
});
test('con la captura de texto prendida las teclas no activan acciones', () => {
	const js = mk();
	js.input.bind('a', 'KeyA');
	js.startTextCapture();
	keyDown(js, 'KeyA'); tick(js); eq(js.input.isDown('a'), false);
});
test('onGamepad avisa conexión y desconexión, y se puede dejar de escuchar', () => {
	const js = mk();
	const log = [];
	const off = js.input.onGamepad(e => log.push(`${e.connected}:${e.index}`));
	js.fireWindow('gamepadconnected', { gamepad: { index: 2, id: 'x' } });
	js.fireWindow('gamepaddisconnected', { gamepad: { index: 2, id: 'x' } });
	off(); js.fireWindow('gamepadconnected', { gamepad: { index: 3, id: 'y' } });
	eq(log.join(), 'true:2,false:2');
});
test('rumble usa dual-rumble en los gamepads con vibración y no rompe en los que no', () => {
	const js = mk();
	const calls = [];
	const con = pad({ index: 0, vibrationActuator: { playEffect: (t, o) => { calls.push([t, o]); } } });
	pads = [con, pad({ index: 1 })]; tick(js);
	js.input.rumble({ duration: 150, weak: 0.2, strong: 0.9 });
	eq(calls.length, 1); eq(calls[0][0], 'dual-rumble');
	eq(calls[0][1].duration, 150); near(calls[0][1].strongMagnitude, 0.9);
});
test('captureNext devuelve el próximo control apretado', async () => {
	const js = mk();
	tick(js);
	const p = js.input.captureNext();
	tick(js); keyDown(js, 'KeyJ'); tick(js);
	eq(await p, 'KeyJ');
	const q = js.input.captureNext();
	const pd = pad(); pads = [pd]; press(pd, 2); tick(js);
	eq(await q, 'pad:X');
});
test('captureNext ignora lo que ya estaba apretado, el mouse (salvo que se pida) y Escape cancela', async () => {
	const js = mk();
	keyDown(js, 'Enter'); tick(js);                      // el Enter con el que se abrió el diálogo
	const p = js.input.captureNext();
	tick(js); js.fire('mousedown', { button: 0 }); tick(js);
	keyDown(js, 'KeyZ'); tick(js);
	eq(await p, 'KeyZ');
	const q = js.input.captureNext();
	keyDown(js, 'Escape'); tick(js);
	eq(await q, null);
	const m = js.input.captureNext({ mouse: true });
	js.fire('mouseup', { button: 0 }); tick(js); js.fire('mousedown', { button: 2 }); tick(js);
	eq(await m, 'mouse:right');
});
test('captureNext con palanca: la dirección se reconoce pasada la zona muerta', async () => {
	const js = mk();
	tick(js);
	const p = js.input.captureNext();
	pads = [pad({ axes: [0, -1, 0, 0] })]; tick(js);
	eq(await p, 'pad:LStickUp');
});
test('lo capturado se puede usar en bind', async () => {
	const js = mk();
	js.input.bind('saltar', 'Space');
	tick(js);
	const p = js.input.captureNext();
	keyDown(js, 'KeyJ'); tick(js);
	js.input.bind('saltar', await p);
	keyUp(js, 'KeyJ'); tick(js);
	keyDown(js, 'KeyJ'); tick(js); eq(js.input.pressed('saltar'), true);
});
test('destroy() limpia asignaciones', () => {
	const js = mk();
	js.input.bind('a', 'KeyA'); js.destroy(); eq(js.input.actions.length, 0);
});

done();
