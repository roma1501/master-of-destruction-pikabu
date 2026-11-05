// VoxMaterials.js — материалы вокселей Rubble Lab: цвет, плотность, прочность, трение, горючесть.
// Воксель хранится одним байтом: 0 — пусто, 1..127 — номер материала, бит 128 — обгорел (темнее).
// Числа физики материалов — данные таблицы (как GAME_GROUNDS), а не константы редактора.
//
//   hard      — класс прочности: 0 неразрушимый, 1 мягкий (стекло, листва), 2 средний (дерево,
//               штукатурка, земля, кирпич), 3 твёрдый (бетон, камень), 4 металл. Инструмент ломает
//               материал, если его сила >= hard; взрыв — по сопротивлению resist.
//   resist    — доля радиуса взрыва, на которой материал ещё разрушается (стекло > 1, металл ~0.3)
//   density   — кг/м³ (масса вокселя = density · VOX_SIZE³)
//   friction, restitution — для контактов твёрдых тел; brittle — порог удара (м/с), выше которого
//               материал крошится сам (стекло, листва); 0 — не крошится от ударов
//   burn      — 0..1 горючесть; sound — класс звука GameAudio; noise — разброс цвета по вокселям
//   spec      — блик (0..1); glow — свечение (0..1, лава/лампы)

/** @typedef {{ id: number, key: string, sound: string, color: number[], noise: number, hard: number, resist: number,
 *   density: number, friction: number, restitution: number, brittle: number, burn: number, spec: number, glow: number,
 *   glass: boolean, explosive: boolean }} VoxMaterial */

/** @satisfies {Record<string, any>} */
const VoxMat = {
    /** @type {VoxMaterial[]} */
    list: [],
    /** @type {Record<string, number>} */
    id: {},
    CHAR: 128,              // бит «обгорел»
    MASK: 127,
    // Палитра для сетки: r, g, b (0..1, экранные), шум, блик, свечение — по номеру байта 0..255 (с обгоревшими).
    rgb: new Float32Array(256 * 3),
    aux: new Float32Array(256 * 4),

    /** @param {string} key @param {any} o */
    def(key, o) {
        const id = this.list.length ? this.list[this.list.length - 1].id + 1 : 1;
        const hex = o.color;
        const m = /** @type {VoxMaterial} */ ({
            id, key, sound: o.sound || key,
            color: [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255],
            noise: o.noise != null ? o.noise : 0.08, hard: o.hard != null ? o.hard : 2, resist: o.resist != null ? o.resist : 1,
            density: o.density || 1000, friction: o.friction != null ? o.friction : 0.6, restitution: o.restitution || 0.1,
            brittle: o.brittle || 0, burn: o.burn || 0, spec: o.spec || 0, glow: o.glow || 0,
            glass: !!o.glass, explosive: !!o.explosive,
        });
        this.list.push(m);
        this.id[key] = id;
        return id;
    },

    /** @param {number} v байт вокселя @returns {VoxMaterial} */
    of(v) { return this.list[(v & 127) - 1] || this.list[0]; },

    build() {
        for (let v = 0; v < 256; v++) {
            const m = this.list[(v & 127) - 1];
            if (!m || !(v & 127)) continue;
            const k = (v & 128) ? 0.34 : 1;
            this.rgb[v * 3] = m.color[0] * k;
            this.rgb[v * 3 + 1] = m.color[1] * k * ((v & 128) ? 0.92 : 1);
            this.rgb[v * 3 + 2] = m.color[2] * k * ((v & 128) ? 0.85 : 1);
            this.aux[v * 4] = (v & 128) ? m.noise * 1.6 : m.noise;
            this.aux[v * 4 + 1] = (v & 128) ? 0 : m.spec;
            this.aux[v * 4 + 2] = m.glow;
            this.aux[v * 4 + 3] = m.glass ? 1 : 0;
        }
    },
};

// Порядок задаёт номера материалов: новые — в конец (карты и тела хранят номера).
VoxMat.def('bedrock',  { color: 0x45413d, hard: 0, resist: 0, density: 2700, noise: 0.10, sound: 'rock' });
VoxMat.def('dirt',     { color: 0x6e5038, hard: 2, resist: 0.5, density: 1600, noise: 0.12, friction: 0.8, sound: 'dirt' });
VoxMat.def('grass',    { color: 0x5a8a37, hard: 2, resist: 0.55, density: 1500, noise: 0.07, friction: 0.8, sound: 'grass' });
VoxMat.def('wood',     { color: 0x9b6a3d, hard: 2, resist: 1.0, density: 650, noise: 0.10, friction: 0.55, restitution: 0.15, burn: 0.9, sound: 'wood' });
VoxMat.def('plank',    { color: 0xb8875a, hard: 2, resist: 1.05, density: 600, noise: 0.09, friction: 0.55, restitution: 0.15, burn: 1, sound: 'wood' });
VoxMat.def('darkwood', { color: 0x5e3f28, hard: 2, resist: 0.95, density: 700, noise: 0.08, friction: 0.55, restitution: 0.12, burn: 0.8, sound: 'wood' });
VoxMat.def('brick',    { color: 0x98483a, hard: 2, resist: 0.72, density: 1900, noise: 0.13, friction: 0.7, sound: 'brick' });
VoxMat.def('brick2',   { color: 0x7c3a2e, hard: 2, resist: 0.72, density: 1900, noise: 0.12, friction: 0.7, sound: 'brick' });
VoxMat.def('mortar',   { color: 0xb3aa9a, hard: 2, resist: 0.8, density: 1700, noise: 0.06, friction: 0.7, sound: 'brick' });
VoxMat.def('concrete', { color: 0x9c9a94, hard: 3, resist: 0.52, density: 2400, noise: 0.07, friction: 0.75, sound: 'concrete' });
VoxMat.def('concrete2',{ color: 0x7d7b76, hard: 3, resist: 0.52, density: 2400, noise: 0.07, friction: 0.75, sound: 'concrete' });
VoxMat.def('plaster',  { color: 0xe0d6c2, hard: 1, resist: 1.1, density: 1100, noise: 0.04, friction: 0.6, sound: 'plaster' });
VoxMat.def('plaster2', { color: 0x8fa6a0, hard: 1, resist: 1.1, density: 1100, noise: 0.04, friction: 0.6, sound: 'plaster' });
VoxMat.def('metal',    { color: 0x6f7880, hard: 4, resist: 0.3, density: 7800, noise: 0.05, friction: 0.45, restitution: 0.25, spec: 0.6, sound: 'metal' });
VoxMat.def('rust',     { color: 0x7d4a2c, hard: 4, resist: 0.34, density: 7800, noise: 0.14, friction: 0.5, restitution: 0.2, spec: 0.2, sound: 'metal' });
VoxMat.def('glass',    { color: 0x9fd2e0, hard: 1, resist: 1.6, density: 2500, noise: 0.02, friction: 0.4, restitution: 0.2, brittle: 2.5, spec: 1, glass: true, sound: 'glass' });
VoxMat.def('leaves',   { color: 0x48782c, hard: 1, resist: 1.5, density: 250, noise: 0.22, friction: 0.9, brittle: 4, burn: 0.7, sound: 'foliage' });
VoxMat.def('rock',     { color: 0x7b7770, hard: 3, resist: 0.45, density: 2600, noise: 0.12, friction: 0.8, sound: 'rock' });
VoxMat.def('roof',     { color: 0x6e2f25, hard: 2, resist: 0.85, density: 1800, noise: 0.10, friction: 0.65, sound: 'brick' });
VoxMat.def('asphalt',  { color: 0x3c3c3e, hard: 3, resist: 0.6, density: 2200, noise: 0.06, friction: 0.85, sound: 'concrete' });
VoxMat.def('tile',     { color: 0xd9dcd6, hard: 2, resist: 0.9, density: 2000, noise: 0.03, friction: 0.5, spec: 0.5, sound: 'plaster' });
VoxMat.def('barrel',   { color: 0xb3261e, hard: 2, resist: 1.2, density: 900, noise: 0.05, friction: 0.5, restitution: 0.2, spec: 0.4, explosive: true, sound: 'metal' });
VoxMat.def('hazard',   { color: 0xe0b021, hard: 4, resist: 0.3, density: 7800, noise: 0.03, friction: 0.45, spec: 0.5, sound: 'metal' });
VoxMat.def('lamp',     { color: 0xfff1c4, hard: 1, resist: 1.4, density: 1500, noise: 0.0, brittle: 3, glow: 1, glass: false, sound: 'glass' });
VoxMat.def('sand',     { color: 0xc8b07c, hard: 2, resist: 0.6, density: 1600, noise: 0.10, friction: 0.85, sound: 'dirt' });
VoxMat.def('foam',     { color: 0xe6e2da, hard: 1, resist: 1.3, density: 120, noise: 0.03, friction: 0.7, restitution: 0.3, sound: 'plaster' });
VoxMat.def('crate',    { color: 0xa97a45, hard: 2, resist: 1.0, density: 500, noise: 0.12, friction: 0.6, restitution: 0.15, burn: 1, sound: 'wood' });
VoxMat.def('blue',     { color: 0x2f5d8c, hard: 2, resist: 0.9, density: 1200, noise: 0.05, friction: 0.6, spec: 0.3, sound: 'plaster' });
// Материалы карты (GameMapBuild): оттенки и мелочи обстановки.
VoxMat.def('grass2',   { color: 0x4f7f31, hard: 2, resist: 0.9, density: 1500, noise: 0.09, friction: 0.8, sound: 'grass' });
VoxMat.def('roof2',    { color: 0x5c271f, hard: 2, resist: 0.85, density: 1800, noise: 0.10, friction: 0.65, sound: 'brick' });
VoxMat.def('hay',      { color: 0xd2b25c, hard: 1, resist: 1.3, density: 160, noise: 0.16, friction: 0.9, burn: 1, sound: 'foliage' });
VoxMat.def('fabric',   { color: 0x55606d, hard: 1, resist: 1.3, density: 300, noise: 0.06, friction: 0.85, restitution: 0.2, burn: 0.9, sound: 'plaster' });
VoxMat.def('terracotta', { color: 0xb0603a, hard: 1, resist: 1.2, density: 1800, noise: 0.07, friction: 0.6, brittle: 4, sound: 'brick' });
VoxMat.def('paint',    { color: 0xd9d8cf, hard: 3, resist: 0.6, density: 2200, noise: 0.04, friction: 0.85, sound: 'concrete' });
VoxMat.def('steelg',   { color: 0x2f6650, hard: 4, resist: 0.3, density: 7800, noise: 0.05, friction: 0.45, restitution: 0.25, spec: 0.45, sound: 'metal' });
VoxMat.def('rubber',   { color: 0x232325, hard: 2, resist: 1.0, density: 1100, noise: 0.04, friction: 1.0, restitution: 0.45, burn: 0.5, sound: 'dirt' });
VoxMat.def('leaves2',  { color: 0x6b9a38, hard: 1, resist: 1.5, density: 250, noise: 0.22, friction: 0.9, brittle: 4, burn: 0.7, sound: 'foliage' });
// набор карт C: город, горная деревня, пустынный аванпост
VoxMat.def('snow',     { color: 0xedf1f5, hard: 1, resist: 1.3, density: 400, noise: 0.03, friction: 0.35, sound: 'foliage' });
VoxMat.def('snow2',    { color: 0xcfd6dd, hard: 1, resist: 1.2, density: 600, noise: 0.05, friction: 0.4, sound: 'foliage' });
VoxMat.def('ice',      { color: 0xa7d3e6, hard: 1, resist: 1.4, density: 920, noise: 0.03, friction: 0.05, restitution: 0.1, brittle: 3, spec: 0.9, glass: true, sound: 'glass' });
VoxMat.def('water',    { color: 0x2f6f96, hard: 1, resist: 1.8, density: 1000, noise: 0.02, friction: 0.1, spec: 1, glass: true, sound: 'glass' });
VoxMat.def('stone',    { color: 0x908b82, hard: 3, resist: 0.5, density: 2500, noise: 0.12, friction: 0.75, sound: 'rock' });
VoxMat.def('stone2',   { color: 0x6e6961, hard: 3, resist: 0.5, density: 2500, noise: 0.10, friction: 0.75, sound: 'rock' });
VoxMat.def('slate',    { color: 0x4b515a, hard: 2, resist: 0.85, density: 2700, noise: 0.07, friction: 0.6, sound: 'rock' });
VoxMat.def('adobe',    { color: 0xb88660, hard: 2, resist: 0.8, density: 1550, noise: 0.10, friction: 0.75, sound: 'brick' });
VoxMat.def('adobe2',   { color: 0xd6b48c, hard: 2, resist: 0.85, density: 1500, noise: 0.06, friction: 0.7, sound: 'plaster' });
VoxMat.def('sandstone',  { color: 0xc69a68, hard: 3, resist: 0.55, density: 2300, noise: 0.11, friction: 0.8, sound: 'rock' });
VoxMat.def('sandstone2', { color: 0xa7724a, hard: 3, resist: 0.55, density: 2300, noise: 0.11, friction: 0.8, sound: 'rock' });
VoxMat.def('fueltank', { color: 0xe2e0d8, hard: 2, resist: 1.15, density: 900, noise: 0.03, friction: 0.5, restitution: 0.2, spec: 0.55, explosive: true, sound: 'metal' });
VoxMat.def('carred',   { color: 0xb3242b, hard: 3, resist: 0.55, density: 450, noise: 0.03, friction: 0.5, restitution: 0.15, spec: 0.7, sound: 'metal' });
VoxMat.def('carwhite', { color: 0xdcddd8, hard: 3, resist: 0.55, density: 450, noise: 0.03, friction: 0.5, restitution: 0.15, spec: 0.7, sound: 'metal' });
VoxMat.def('caryellow',{ color: 0xe3b021, hard: 3, resist: 0.55, density: 450, noise: 0.03, friction: 0.5, restitution: 0.15, spec: 0.7, sound: 'metal' });
VoxMat.def('neonred',  { color: 0xff4d3d, hard: 1, resist: 1.4, density: 1500, noise: 0.0, brittle: 3, glow: 0.85, sound: 'glass' });
VoxMat.def('neongreen',{ color: 0x4ce38a, hard: 1, resist: 1.4, density: 1500, noise: 0.0, brittle: 3, glow: 0.85, sound: 'glass' });
VoxMat.def('neonamber',{ color: 0xffb43a, hard: 1, resist: 1.4, density: 1500, noise: 0.0, brittle: 3, glow: 0.85, sound: 'glass' });
VoxMat.def('canvas',   { color: 0xc2473b, hard: 1, resist: 1.4, density: 350, noise: 0.05, friction: 0.8, burn: 1, sound: 'plaster' });
VoxMat.def('canvas2',  { color: 0xeadfc6, hard: 1, resist: 1.4, density: 350, noise: 0.05, friction: 0.8, burn: 1, sound: 'plaster' });
VoxMat.def('pine',     { color: 0x2d5235, hard: 1, resist: 1.5, density: 260, noise: 0.2, friction: 0.9, brittle: 4, burn: 0.8, sound: 'foliage' });
VoxMat.def('cable',    { color: 0x2a2c30, hard: 2, resist: 0.6, density: 1200, noise: 0.03, friction: 0.5, restitution: 0.1, spec: 0.4, sound: 'metal' });
VoxMat.def('bronze',   { color: 0x8a6a35, hard: 3, resist: 0.45, density: 8700, noise: 0.06, friction: 0.5, restitution: 0.2, spec: 0.65, sound: 'metal' });
VoxMat.def('stained',  { color: 0xd9a441, hard: 1, resist: 1.6, density: 2500, noise: 0.05, friction: 0.4, restitution: 0.2, brittle: 2.5, spec: 1, glass: true, sound: 'glass' });
VoxMat.def('stained2', { color: 0x3d62b5, hard: 1, resist: 1.6, density: 2500, noise: 0.05, friction: 0.4, restitution: 0.2, brittle: 2.5, spec: 1, glass: true, sound: 'glass' });
// набор карт B: стройка, завод, порт (листовой металл — «эффективная» плотность тонкого листа на воксель)
VoxMat.def('rebar',    { color: 0x5b4535, hard: 3, resist: 0.42, density: 7800, noise: 0.12, friction: 0.5, restitution: 0.2, spec: 0.25, sound: 'metal' });
VoxMat.def('scaffold', { color: 0xa2aaae, hard: 3, resist: 0.42, density: 2600, noise: 0.05, friction: 0.45, restitution: 0.2, spec: 0.7, sound: 'metal' });
VoxMat.def('ctr_red',  { color: 0x9a3325, hard: 3, resist: 0.5, density: 450, noise: 0.07, friction: 0.5, restitution: 0.15, spec: 0.3, sound: 'metal' });
VoxMat.def('ctr_blue', { color: 0x2c5b88, hard: 3, resist: 0.5, density: 450, noise: 0.07, friction: 0.5, restitution: 0.15, spec: 0.3, sound: 'metal' });
VoxMat.def('ctr_green',{ color: 0x3e6a44, hard: 3, resist: 0.5, density: 450, noise: 0.07, friction: 0.5, restitution: 0.15, spec: 0.3, sound: 'metal' });
VoxMat.def('ctr_orange',{ color: 0xcc6a21, hard: 3, resist: 0.5, density: 450, noise: 0.07, friction: 0.5, restitution: 0.15, spec: 0.3, sound: 'metal' });
VoxMat.def('corrugated',{ color: 0x98a0a3, hard: 2, resist: 0.9, density: 700, noise: 0.05, friction: 0.5, restitution: 0.15, spec: 0.5, sound: 'metal' });
VoxMat.def('corrugated2',{ color: 0x4a7a7e, hard: 2, resist: 0.9, density: 700, noise: 0.05, friction: 0.5, restitution: 0.15, spec: 0.4, sound: 'metal' });
VoxMat.def('oxygen',   { color: 0x3566a5, hard: 2, resist: 1.2, density: 900, noise: 0.04, friction: 0.5, restitution: 0.2, spec: 0.5, explosive: true, sound: 'metal' });
VoxMat.def('tanksteel',{ color: 0xc2c6c3, hard: 4, resist: 0.36, density: 2400, noise: 0.04, friction: 0.45, restitution: 0.2, spec: 0.6, sound: 'metal' });
VoxMat.def('mud',      { color: 0x3a3028, hard: 2, resist: 0.5, density: 1800, noise: 0.10, friction: 0.9, sound: 'dirt' });
VoxMat.def('gravel',   { color: 0x8a857c, hard: 2, resist: 0.55, density: 1700, noise: 0.17, friction: 0.85, sound: 'dirt' });
VoxMat.def('redwash',  { color: 0xb3342b, hard: 2, resist: 0.75, density: 1900, noise: 0.05, friction: 0.7, sound: 'brick' });
// набор карт A: ферма, пригород, заправка
VoxMat.def('barnred',  { color: 0x9a2e24, hard: 2, resist: 1.0, density: 600, noise: 0.08, friction: 0.55, restitution: 0.15, burn: 0.9, sound: 'wood' });
VoxMat.def('trim',     { color: 0xe9e5da, hard: 2, resist: 1.0, density: 600, noise: 0.04, friction: 0.55, restitution: 0.15, burn: 0.8, sound: 'wood' });
VoxMat.def('tin',      { color: 0xa8b0b4, hard: 3, resist: 0.62, density: 900, noise: 0.06, friction: 0.45, restitution: 0.2, spec: 0.55, sound: 'metal' });
VoxMat.def('soil',     { color: 0x4c3524, hard: 2, resist: 0.5, density: 1500, noise: 0.14, friction: 0.9, sound: 'dirt' });
VoxMat.def('crop',     { color: 0xc8a443, hard: 1, resist: 1.5, density: 120, noise: 0.2, friction: 0.9, brittle: 3, burn: 1, sound: 'foliage' });
VoxMat.def('carblue',  { color: 0x2b5ca6, hard: 3, resist: 0.55, density: 450, noise: 0.03, friction: 0.5, restitution: 0.15, spec: 0.7, sound: 'metal' });
VoxMat.def('cargreen', { color: 0x2f7f35, hard: 3, resist: 0.55, density: 600, noise: 0.03, friction: 0.5, restitution: 0.15, spec: 0.6, sound: 'metal' });
VoxMat.def('siding',   { color: 0xe0cd96, hard: 2, resist: 1.0, density: 600, noise: 0.05, friction: 0.55, restitution: 0.15, burn: 0.85, sound: 'wood' });
VoxMat.def('siding2',  { color: 0x8eaabb, hard: 2, resist: 1.0, density: 600, noise: 0.05, friction: 0.55, restitution: 0.15, burn: 0.85, sound: 'wood' });
VoxMat.def('brandteal',  { color: 0x16857e, hard: 2, resist: 0.9, density: 800, noise: 0.03, friction: 0.5, spec: 0.45, sound: 'metal' });
VoxMat.def('brandorange',{ color: 0xef8a1f, hard: 2, resist: 0.9, density: 800, noise: 0.03, friction: 0.5, spec: 0.45, sound: 'metal' });
VoxMat.def('goods_y',  { color: 0xe3b437, hard: 1, resist: 1.25, density: 300, noise: 0.14, friction: 0.7, burn: 0.8, sound: 'plaster' });
VoxMat.def('goods_g',  { color: 0x3f8f4f, hard: 1, resist: 1.25, density: 300, noise: 0.14, friction: 0.7, burn: 0.8, sound: 'plaster' });
// набор карт B (дополнение): мутная вода луж и доков
VoxMat.def('murk',     { color: 0x46553f, hard: 1, resist: 1.8, density: 1000, noise: 0.03, friction: 0.15, spec: 1, glass: true, sound: 'glass' });
VoxMat.build();

/** Номера материалов по имени: M.brick, M.glass … */
const M = VoxMat.id;
