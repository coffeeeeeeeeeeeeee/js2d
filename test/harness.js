// Carga js2d.js en un contexto aislado, con un DOM de mentira, para probar sin navegador.
// Devuelve { vm context, make() } donde make() crea un Js2d con un ctx que graba las llamadas.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
	const noop = () => {};
	const calls = [];
	// Un contexto 2D de mentira: graba las llamadas y guarda las propiedades que se le asignan.
	// measureText mide 0,5 x el tamaño de la letra por carácter, para poder probar texto que se achica.
	const props = {};
	const ctx = new Proxy({}, {
		get: (_, name) => {
			if (name === 'measureText') return (text) => ({ width: String(text).length * 0.5 * parseFloat((/(\d+(?:\.\d+)?)px/.exec(props.font || '') || [0, 16])[1]) });
			if (name in props) return props[name];
			return (...args) => { calls.push([name, ...args]); };
		},
		set: (_, name, value) => { props[name] = value; calls.push(['set:' + name, value]); return true; },
	});
	const mkCanvas = () => {
		const listeners = {};
		return {
			listeners,
			getContext: () => ctx,
			addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
			removeEventListener: noop,
			style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), width: 800, height: 600, parentElement: null,
		};
	};
	let canvas = mkCanvas();
	const sandbox = vm.createContext({
		// el motor avisa por consola cosas como "AudioContext inicializado": en las pruebas sobra
		console: { ...console, log: (...a) => { if (!String(a[0]).startsWith('[Js2d]')) console.log(...a); } },
		Math, Promise, setTimeout, clearTimeout, canvasStub: canvas,
		window: { AudioContext: class { constructor() { this.state = 'running'; this.currentTime = 0; } resume() { return Promise.resolve(); } }, addEventListener: noop, removeEventListener: noop, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, visualViewport: null },
		document: { addEventListener: noop, body: { appendChild: noop }, createElement: () => canvas, documentElement: { clientWidth: 800, clientHeight: 600 } },
		navigator: {}, localStorage: {}, Image: function () {}, Audio: function () {},
	});
	vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js2d.js'), 'utf8'), sandbox);
	return {
		calls, sandbox,
		get: (expr) => vm.runInContext(expr, sandbox),
		// Crea un Js2d con su propio canvas. `js.fire(tipo, evento)` dispara los eventos del
		// canvas (mousedown, mouseup, touchstart, wheel...) como lo haría el navegador.
		make: () => {
			const own = mkCanvas();
			const winListeners = {};
			sandbox.canvasStub = own;
			sandbox.window = {
				...sandbox.window,
				addEventListener: (t, f) => { (winListeners[t] ||= []).push(f); },
			};
			const js = vm.runInContext('new Js2d(canvasStub)', sandbox);
			js.fire = (type, ev = {}) => { for (const f of own.listeners[type] || []) f({ preventDefault: noop, cancelable: false, ...ev }); };
			// eventos de la ventana: keydown, keyup, blur, gamepadconnected...
			js.fireWindow = (type, ev = {}) => { for (const f of winListeners[type] || []) f({ preventDefault: noop, ...ev }); };
			js.canvasStub = own;
			return js;
		},
	};
}

function runner() {
	let ok = 0, fail = 0;
	const pending = [];
	return {
		test(name, fn) {
			try {
				const r = fn();
				if (r && r.then) pending.push(r.then(() => { ok++; console.log('  ok   ' + name); }, e => { fail++; console.log('  FALLA ' + name + '\n       ' + e.message); }));
				else { ok++; console.log('  ok   ' + name); }
			} catch (e) { fail++; console.log('  FALLA ' + name + '\n       ' + e.message); }
		},
		near(a, b, eps = 1e-9) { if (Math.abs(a - b) > eps) throw new Error(`${a} != ${b}`); },
		eq(a, b) { if (a !== b) throw new Error(`${JSON.stringify(a)} !== ${JSON.stringify(b)}`); },
		async done() { await Promise.all(pending); console.log(`\n${ok} pasaron, ${fail} fallaron.`); process.exit(fail ? 1 : 0); },
	};
}

module.exports = { load, runner };
