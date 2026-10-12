#!/bin/bash
# Copia js2d.js (fuente canónica) a los proyectos que lo usan.
# Uso: ./sync.sh            -> sincroniza todos
#      ./sync.sh --check    -> sólo informa cuáles están desactualizados
cd "$(dirname "$0")" || exit 1
SRC=js2d.js
DEV=..
# proyecto:tipo  (tipo "module" agrega el export ES al final)
PROJECTS="senal-muerta:plain capital-rush:plain mario:plain digital-circus-vn:plain bot-factory:plain truco-ar:plain f1-simulator:module"
EXPORT='
// --- adaptación f1-simulator: se consume como módulo ES ---
export { Js2d, Color, Pivot, Line_Cap, SpriteFont, Ease, Collision, SpatialGrid };'

for entry in $PROJECTS; do
	name=${entry%%:*}; kind=${entry##*:}
	dest="$DEV/$name/js2d.js"
	tmp=$(mktemp)
	cat "$SRC" > "$tmp"
	[ "$kind" = module ] && printf '%s\n' "$EXPORT" >> "$tmp"
	if cmp -s "$tmp" "$dest"; then
		echo "ok            $name"
	elif [ "$1" = --check ]; then
		echo "DESACTUALIZADO $name"
	else
		cp "$tmp" "$dest" && echo "actualizado   $name"
	fi
	rm -f "$tmp"
done
