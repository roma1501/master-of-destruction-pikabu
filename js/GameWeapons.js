// GameWeapons.js — модели инструментов в руках (GLB из Blender). Исходники, скрипт сборки и превью —
// в assets/models/weapons/src/ (build_weapons.py: модель -> запечённые AO, износ, блик и нормали -> GLB).
//
// load(scene): каждая модель — Model3D.load + Model3D.build, корень модели (см движка) вешается на узел
// в МЕТРАХ (× 0.01) со своим поворотом кадра (rot). Узел: начало — рукоять (кисть), ствол вдоль −Z,
// верх +Y, право +X — пространство камеры. GameTools вешает узел на камеру: position = base (+ качание,
// отдача), rotation — анимация (кувалда вращается вокруг начала узла по X).
// Материалы: StandardMaterial, блик по типу материала (имя материала из Blender: steel, paint, polymer,
// rubber, wood, glass, copper, brass, tape); карта блика <id>_s.jpg и нормалей <id>_n.jpg — если
// загрузились (на телефоне не грузятся). Части *_glow светятся: плагин прибавляет цвет текстуры × k поверх
// света (HDR -> bloom). Свет: 6 огней сцены + свой заполняющий свет «от камеры» только для моделей в руках
// (иначе теневая сторона инструмента — чёрный силуэт), поэтому у их материалов maxSimultaneousLights = 7.
// Нет файла или ошибка — инструмента нет в models: GameTools оставит воксельную заготовку.

class WeaponGlowPlugin extends BABYLON.MaterialPluginBase {
    /** @param {BABYLON.Material} material */
    constructor(material) {
        super(material, 'WeaponGlow', 310, { WPNGLOW: false });
        this.k = 1.5;
        this.base = 1.5;
        this.kind = '';
        this._enable(true);
    }
    prepareDefines(defines) { defines.WPNGLOW = true; }
    getClassName() { return 'WeaponGlowPlugin'; }
    getUniforms() {
        return { ubo: [{ name: 'wpnGlow', size: 1, type: 'float' }], fragment: 'uniform float wpnGlow;' };
    }
    bindForSubMesh(ubo) { ubo.updateFloat('wpnGlow', this.k); }
    getCustomCode(shaderType) {
        if (shaderType === 'fragment') return { CUSTOM_FRAGMENT_BEFORE_FOG: 'color.rgb += baseColor.rgb * wpnGlow;' };
        return null;
    }
}

/**
 * @typedef {{ node: BABYLON.TransformNode, base: number[], scale?: number, muzzle?: number[],
 *   parts?: Record<string, BABYLON.AbstractMesh>, glow?: WeaponGlowPlugin[] }} WeaponModel
 */

/** @satisfies {Record<string, any>} */
const GameWeapons = {
    /** @type {Record<string, WeaponModel>} */
    models: {},
    /** Новый экземпляр ракеты: нос в начале узла, корпус вдоль +Z (летит вдоль −Z), метры, длина ≈ 0.68 с факелом;
     * группа рендера 0, без теней. Снять — node.dispose() (материалы общие). null — модель не загрузилась.
     * @type {((scene?: BABYLON.Scene) => BABYLON.TransformNode) | null} */
    rocket: null,
    /** @type {WeaponGlowPlugin[]} */
    _glow: [],
    /** @type {any} */
    _obs: null,
    /** @type {BABYLON.DirectionalLight | null} */
    fill: null,
    // заполняющий свет в пространстве камеры: сверху-слева-сзади на инструмент; сила, цвет
    FILL_DIR: [0.75, -0.5, -0.45],
    FILL: 0.85,

    // url — модель, n / s — карты нормалей и блика; base — место узла в пространстве камеры;
    // rot — поворот модели внутри узла (кадр), off — её сдвиг в узле (метры: где ось вращения GameTools);
    // muzzle — срез ствола в координатах модели (метры, из meta-<id>.json).
    DEFS: {
        hammer: { url: 'assets/models/weapons/hammer.glb', n: 'assets/models/weapons/hammer_n.jpg', s: 'assets/models/weapons/hammer_s.jpg',
            base: [0.27, -0.36, -0.42], rot: [0, 0.35, -0.2], off: [0, -0.3, 0], muzzle: [0, 0.745, -0.124] },
        rifle: { url: 'assets/models/weapons/rifle.glb', n: 'assets/models/weapons/rifle_n.jpg', s: 'assets/models/weapons/rifle_s.jpg',
            base: [0.2, -0.25, -0.42], rot: [0, 0.1, 0], muzzle: [0, 0.106, -0.71] },
        shotgun: { url: 'assets/models/weapons/shotgun.glb', n: 'assets/models/weapons/shotgun_n.jpg', s: 'assets/models/weapons/shotgun_s.jpg',
            base: [0.19, -0.265, -0.48], rot: [0.05, 0.14, 0], muzzle: [0, 0.095, -0.697] },
        launcher: { url: 'assets/models/weapons/launcher.glb', n: 'assets/models/weapons/launcher_n.jpg', s: 'assets/models/weapons/launcher_s.jpg',
            base: [0.25, -0.285, -0.42], rot: [0, 0.08, 0], muzzle: [0, 0.118, -0.738] },
        bomb: { url: 'assets/models/weapons/bomb.glb', n: 'assets/models/weapons/bomb_n.jpg', s: 'assets/models/weapons/bomb_s.jpg',
            base: [0.2, -0.17, -0.42], rot: [0.15, 1.1, 0.1], muzzle: null },
        grab: { url: 'assets/models/weapons/grab.glb', n: 'assets/models/weapons/grab_n.jpg', s: 'assets/models/weapons/grab_s.jpg',
            base: [0.2, -0.2, -0.46], rot: [-0.06, 0.2, 0], muzzle: [0, 0.078, -0.214] },
        spawner: { url: 'assets/models/weapons/spawner.glb', n: 'assets/models/weapons/spawner_n.jpg', s: 'assets/models/weapons/spawner_s.jpg',
            base: [0.22, -0.18, -0.4], rot: [0.05, 0.16, 0], muzzle: [0, 0.082, -0.15] },
        torch: { url: 'assets/models/weapons/torch.glb', n: 'assets/models/weapons/torch_n.jpg', s: 'assets/models/weapons/torch_s.jpg',
            base: [0.24, -0.24, -0.5], rot: [0, 0.18, 0], muzzle: [0, 0.08, -0.56] },
    },
    ROCKET: { url: 'assets/models/weapons/rocket.glb', n: 'assets/models/weapons/rocket_n.jpg', s: 'assets/models/weapons/rocket_s.jpg' },

    // Блик по типу материала: [цвет, сила без карты, степень]. С картой блика сила — из карты.
    SPEC: {
        steel: [[0.95, 0.97, 1.0], 0.55, 60], paint: [[1, 1, 1], 0.32, 30], polymer: [[1, 1, 1], 0.16, 18],
        rubber: [[1, 1, 1], 0.06, 10], wood: [[1, 0.95, 0.88], 0.22, 22], glass: [[1, 1, 1], 1.0, 140],
        copper: [[1.0, 0.72, 0.5], 0.8, 70], brass: [[1.0, 0.85, 0.55], 0.8, 70], tape: [[1, 1, 1], 0.25, 20],
    },

    async load(scene) {
        const ids = Object.keys(this.DEFS);
        const extras = typeof IS_MOBILE === 'undefined' || !IS_MOBILE;
        await Promise.all(ids.map(async (id) => {
            try {
                const m = await this._make(scene, id, this.DEFS[id], extras);
                if (m) this.models[id] = m;
            } catch (e) {
                console.warn('GameWeapons: ' + id + ' — ' + ((e && e.message) || e));
            }
        }));
        try { await this._loadRocket(scene, extras); } catch (e) { console.warn('GameWeapons: rocket — ' + ((e && e.message) || e)); }
        this._makeFill(scene);
        if (!this._obs) this._obs = scene.onBeforeRenderObservable.add(() => this._tick(scene));
        return this.models;
    },

    /** @returns {Promise<WeaponModel | null>} */
    async _make(scene, id, def, extras) {
        const model = await Model3D.load(def.url);
        const maps = extras ? await this._maps(scene, def) : { n: null, s: null };
        const node = new BABYLON.TransformNode('wpn-' + id, scene);
        const root = Model3D.build(model, scene, { name: 'wpn-' + id + '-model' });
        root.parent = node;
        root.scaling.setAll(0.01);
        root.rotation.set(def.rot[0], def.rot[1], def.rot[2]);
        const off = def.off || [0, 0, 0];
        root.position.set(off[0], off[1], off[2]);
        const glow = this._setup(root, maps, 2);
        /** @type {Record<string, BABYLON.AbstractMesh>} */
        const parts = {};
        for (const m of root.getChildMeshes(false)) parts[(m.metadata && m.metadata.part) || m.name] = m;
        let muzzle = null;
        if (def.muzzle) {
            const M = BABYLON.Matrix.Compose(new BABYLON.Vector3(0.01, 0.01, 0.01),
                BABYLON.Quaternion.FromEulerAngles(def.rot[0], def.rot[1], def.rot[2]), new BABYLON.Vector3(off[0], off[1], off[2]));
            const v = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(def.muzzle[0] * 100, def.muzzle[1] * 100, def.muzzle[2] * 100), M);
            muzzle = [v.x, v.y, v.z];
        }
        node.setEnabled(false);
        return { node, base: def.base.slice(), muzzle, parts, glow };
    },

    // Ракета: один шаблон (материалы и свечение — раз), экземпляры — клоны с общей геометрией и материалами,
    // поэтому node.dispose() ничего не теряет и не копит.
    async _loadRocket(scene, extras) {
        const def = this.ROCKET;
        const model = await Model3D.load(def.url);
        const maps = extras ? await this._maps(scene, def) : { n: null, s: null };
        const tpl = Model3D.build(model, scene, { name: 'rocket-model' });
        tpl.scaling.setAll(0.01);
        this._setup(tpl, maps, 0);
        tpl.setEnabled(false);
        let n = 0;
        this.rocket = () => {
            const node = new BABYLON.TransformNode('rocket' + (n++), scene);
            const root = tpl.clone('rocket-model', node, false);
            root.setEnabled(true);
            for (const m of root.getChildMeshes(false)) { m.isPickable = false; m.receiveShadows = false; m.renderingGroupId = 0; m.setEnabled(true); }
            return node;
        };
    },

    /** Карты нормалей и блика модели: { n, s } (null — нет файла или не прочиталась). */
    async _maps(scene, def) {
        const load = (url) => new Promise((resolve) => {
            if (!url) { resolve(null); return; }
            let done = false;
            const fin = (t) => { if (!done) { done = true; resolve(t); } };
            const t = new BABYLON.Texture(url, scene, {
                invertY: true, samplingMode: BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
                onLoad: () => fin(t), onError: () => { t.dispose(); fin(null); },
            });
            setTimeout(() => { if (!done) { t.dispose(); fin(null); } }, 15000);
        });
        const [n, s] = await Promise.all([load(def.n), load(def.s)]);
        if (n) n.anisotropicFilteringLevel = 4;
        return { n, s };
    },

    /** Меши и материалы модели: группа рендера, блик, карты, свечение. Возвращает плагины свечения. */
    _setup(root, maps, group) {
        /** @type {WeaponGlowPlugin[]} */
        const glow = [];
        /** @type {BABYLON.BaseTexture | null} */
        let tex = null;
        const seen = new Set();
        for (const mesh of root.getChildMeshes(false)) {
            mesh.renderingGroupId = group;
            mesh.isPickable = false;
            mesh.receiveShadows = false;
            if (group === 2) mesh.alwaysSelectAsActiveMesh = true;
            const mm = mesh.material;
            const list = mm ? (/** @type {any} */ (mm).subMaterials || [mm]) : [];
            for (const mat of list) {
                if (!mat || seen.has(mat)) continue;
                seen.add(mat);
                const sm = /** @type {BABYLON.StandardMaterial} */ (mat);
                // одна картинка на модель: копии из разных материалов GLB — в одну текстуру
                if (sm.diffuseTexture) {
                    if (!tex) tex = sm.diffuseTexture;
                    else if (sm.diffuseTexture !== tex) { const old = sm.diffuseTexture; sm.diffuseTexture = tex; old.dispose(); }
                }
                sm.maxSimultaneousLights = group === 2 ? 7 : 6;
                const name = String(sm.name).split('/').pop();
                const key = Object.keys(this.SPEC).find(k => name.startsWith(k)) || 'paint';
                const [sc, amt, pow] = this.SPEC[key];
                if (maps.s) { sm.specularTexture = maps.s; sm.specularColor = new BABYLON.Color3(sc[0], sc[1], sc[2]); }
                else sm.specularColor = new BABYLON.Color3(sc[0] * amt, sc[1] * amt, sc[2] * amt);
                sm.specularPower = pow;
                if (maps.n) sm.bumpTexture = maps.n;
                if (name.includes('_glow')) {
                    sm.emissiveColor = new BABYLON.Color3(1, 1, 1);
                    sm.specularColor = new BABYLON.Color3(0, 0, 0);
                    sm.specularTexture = null;
                    sm.bumpTexture = null;
                    const p = new WeaponGlowPlugin(sm);
                    p.kind = name;
                    p.base = name.startsWith('screen') ? 0.8 : 1.6;
                    glow.push(p);
                    this._glow.push(p);
                }
            }
        }
        return glow;
    },

    /** Заполняющий свет только для моделей в руках (в кадре всегда видна их теневая сторона). */
    _makeFill(scene) {
        /** @type {BABYLON.AbstractMesh[]} */
        const meshes = [];
        for (const id in this.models) meshes.push(...this.models[id].node.getChildMeshes(false));
        if (!meshes.length) return;
        const L = this.fill = new BABYLON.DirectionalLight('wpnFill', new BABYLON.Vector3(0, -1, 0), scene);
        L.intensity = this.FILL;
        L.diffuse = new BABYLON.Color3(1.0, 0.96, 0.9);
        L.specular = new BABYLON.Color3(0.9, 0.9, 0.9);
        L.shadowEnabled = false;
        L.includedOnlyMeshes = meshes;
    },

    _tick(scene) {
        const cam = scene.activeCamera;
        if (this.fill && cam) {
            const d = this.FILL_DIR;
            this.fill.direction = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(d[0], d[1], d[2]), cam.getWorldMatrix()).normalize();
        }
        // живое свечение: катушка захвата пульсирует (быстрее с грузом), запал и пилот мерцают, светодиоды мигают
        const t = performance.now() / 1000;
        const held = typeof GameTools !== 'undefined' && GameTools.held ? 1 : 0;
        for (const p of this._glow) {
            const kind = p.kind;
            let k = p.base;
            if (kind.startsWith('coil') || kind.startsWith('emitter')) k = p.base * (0.75 + 0.25 * Math.sin(t * (held ? 14 : 4))) + held * 0.8;
            else if (kind.startsWith('pilot') || kind.startsWith('fuse') || kind.startsWith('flame')) k = p.base * (0.8 + 0.2 * Math.sin(t * 31) * Math.sin(t * 17.3));
            else if (kind.startsWith('led')) k = p.base * (Math.sin(t * 3.1) > -0.3 ? 1 : 0.25);
            p.k = k;
        }
    },
};
