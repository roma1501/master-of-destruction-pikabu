// GameTools.js — инструменты игрока Rubble Lab: кувалда, винтовка (прострел мягкого), дробовик,
// ракетомёт, бомба (настоящее твёрдое тело с запалом), захват (мягкая связь, бросок), спавнер
// предметов и огнемёт (поджог горючего). Модели в руках — воксельные (тот же мешер и шейдер),
// висят на камере в своей группе рендера: не проваливаются в стены.
// События для HUD и обучения: GameTools.on(fn) -> { type: 'select' | 'hit' | 'explode' | 'grab' | 'throw' | 'spawn' | 'kind', … }.

/** @satisfies {Record<string, any>} */
const GameTools = {
    /** @type {any} */
    game: null,
    list: [
        { id: 'hammer', icon: '🔨', key: '1' },
        { id: 'rifle', icon: '🎯', key: '2' },
        { id: 'shotgun', icon: '💥', key: '3' },
        { id: 'launcher', icon: '🚀', key: '4' },
        { id: 'bomb', icon: '💣', key: '5' },
        { id: 'grab', icon: '✋', key: '6' },
        { id: 'spawner', icon: '📦', key: '7' },
        { id: 'torch', icon: '🔥', key: '8' },
    ],
    current: 0,
    cool: 0,
    swing: -1,
    _swingHit: false,
    switchT: 0,
    /** @type {{ x: number, y: number, z: number, vx: number, vy: number, vz: number, t: number, node: BABYLON.TransformNode | null }[]} */
    rockets: [],
    /** @type {{ body: VoxBody, fuse: number, kind: string, holder: BABYLON.TransformNode | null, stuck: VoxBody | null, local: any }[]} */
    bombs: [],
    /** @type {{ joint: any, body: VoxBody, dist: number } | null} */
    held: null,
    spawnKinds: ['crate', 'barrel', 'block', 'plank', 'ball', 'wall'],
    spawnKind: 0,
    /** @type {((e: any) => void)[]} */
    _ls: [],
    /** @type {BABYLON.TransformNode | null} */
    vmRoot: null,
    /** @type {Record<string, BABYLON.TransformNode>} */
    vm: {},
    _sway: { x: 0, y: 0 },
    recoil: 0,
    _torchT: 0,
    /** @type {{ set(v: number): void, stop(): void } | null} */
    _torchLoop: null,
    aim: /** @type {any} */ (null),

    on(fn) { this._ls.push(fn); },
    emit(e) { for (const fn of this._ls) { try { fn(e); } catch (err) { console.warn(err); } } },
    get tool() { return this.list[this.current]; },

    /** Сборка YouTube Playables (локально — ?playables в адресе). */
    get playables() {
        if (this._pl === undefined) this._pl = (typeof GAME_PLATFORM !== 'undefined' && /** @type {string} */ (GAME_PLATFORM) === 'playables') || /[?&]playables\b/.test(location.search);
        return this._pl;
    },
    /** @type {boolean | undefined} */
    _pl: undefined,
    /** Усиление оружия в Playables: кувалда, винтовка, дробовик ломают любой материал. */
    get _boost() { return this.playables && (typeof RL_PL_BOOST !== 'undefined' ? RL_PL_BOOST : 1) > 0; },

    /** Закрыт ли инструмент i (магазин GameShop). */
    _locked(i) { return typeof GameShop !== 'undefined' && !!GameShop.game && GameShop.toolLocked(this.list[i].id); },
    prev: 0,
    /** Q: на предыдущий инструмент (и обратно); если он закрыт — ничего. */
    _swapPrev() {
        if (this.prev === this.current || this._locked(this.prev)) return;
        this.select(this.prev);
    },

    /** Колесо: следующий ОТКРЫТЫЙ инструмент (закрытые пропускаются, магазин не открывается). */
    _cycle(dir) {
        const n = this.list.length;
        for (let k = 1; k < n; k++) {
            const i = ((this.current + dir * k) % n + n) % n;
            if (!this._locked(i)) { this.select(i); return; }
        }
    },

    init(game) {
        this.game = game;
        this._buildViewmodels();
        this.select(0, true);
    },

    select(i, silent = false) {
        const n = this.list.length;
        i = ((i % n) + n) % n;
        if (i === this.current && !silent) return;
        if (!silent && this._locked(i)) {
            // закрытый инструмент: подсказка (магазин — клавиша B), выбор не меняется
            if (typeof GameHud !== 'undefined' && GameHud.toast) GameHud.toast('rls.locked');
            if (typeof GameAudio !== 'undefined') GameAudio.ui('click');
            return;
        }
        if (this.held) this._release(false);
        if (i !== this.current) this.prev = this.current;
        this.current = i;
        this.switchT = 0.28;
        this.swing = -1;
        for (const id in this.vm) this.vm[id].setEnabled(id === this.list[i].id);
        if (!silent && typeof GameAudio !== 'undefined') GameAudio.ui('select');
        this.emit({ type: 'select', index: i, id: this.list[i].id });
    },

    // ------------------------------------------------------------------ прицел

    /** Ближайшее попадание луча из глаз: мир или тело. { t, x, y, z, nx, ny, nz, v, body, lx, ly, lz } | null */
    ray(ox, oy, oz, dx, dy, dz, max) {
        const w = this.game.world;
        const hw = w.raycast(ox, oy, oz, dx, dy, dz, max);
        const hb = VoxPhysics.raycastBodies(ox, oy, oz, dx, dy, dz, hw ? hw.t : max);
        if (hb && (!hw || hb.t < hw.t)) {
            return { t: hb.t, x: ox + dx * hb.t, y: oy + dy * hb.t, z: oz + dz * hb.t, nx: hb.nx, ny: hb.ny, nz: hb.nz, v: hb.v, body: hb.body, lx: hb.x, ly: hb.y, lz: hb.z };
        }
        if (hw) return { t: hw.t, x: ox + dx * hw.t, y: oy + dy * hw.t, z: oz + dz * hw.t, nx: hw.nx, ny: hw.ny, nz: hw.nz, v: hw.v, body: null, lx: hw.x, ly: hw.y, lz: hw.z };
        return null;
    },
    _eyeRay(max) {
        const p = this.game.player, e = p.eye, d = p.dir();
        return { e, d, hit: this.ray(e.x, e.y, e.z, d.x, d.y, d.z, max) };
    },

    // ------------------------------------------------------------------ кадр

    update(dt, sdt) {
        const g = this.game, p = g.player;
        if (Input.pressed('tool1')) this.select(0); if (Input.pressed('tool2')) this.select(1);
        if (Input.pressed('tool3')) this.select(2); if (Input.pressed('tool4')) this.select(3);
        if (Input.pressed('tool5')) this.select(4); if (Input.pressed('tool6')) this.select(5);
        if (Input.pressed('tool7')) this.select(6); if (Input.pressed('tool8')) this.select(7);
        // Q — быстрая смена на предыдущий инструмент и обратно
        if (Input.pressed('toolNext')) this._swapPrev();
        if (Input.pressed('toolPrev')) this._cycle(-1);
        const wheel = Input.consumeWheel ? Input.consumeWheel() : 0;
        if (wheel && !this.held) this._cycle(wheel > 0 ? 1 : -1);
        else if (wheel && this.held) this.held.dist = Math.max(1.2, Math.min(5.5, this.held.dist - Math.sign(wheel) * 0.35));
        if (Input.pressed('interact') && this.current !== 5) {
            // E — быстрый захват любым инструментом
            if (this.held) this._release(false); else this._tryGrab();
        }
        this.cool = Math.max(0, this.cool - dt);
        if (this.cool <= 0) { const wh = this._warhead(); if (wh && !wh.isEnabled()) wh.setEnabled(true); }
        this.switchT = Math.max(0, this.switchT - dt);
        const id = this.tool.id;
        const fire = Input.down('attack'), firePressed = Input.pressed('attack'), alt = Input.pressed('aim');
        if (this.switchT <= 0) {
            if (id === 'hammer') { if (fire && this.cool <= 0) { this.swing = 0; this._swingHit = false; this.cool = 0.46; if (typeof GameAudio !== 'undefined') GameAudio.swing(false); } }
            else if (id === 'rifle') { if (fire && this.cool <= 0) { this._rifle(); this.cool = 0.13; } }
            else if (id === 'shotgun') { if (firePressed && this.cool <= 0) { this._shotgun(); this.cool = 0.8; } }
            else if (id === 'launcher') {
                if (firePressed && this.cool <= 0) { this._launch(); this.cool = 1.0; }
                if ((alt || Input.pressed('ammo')) && typeof GameShop !== 'undefined') GameShop.cycle('rocket');
            }
            else if (id === 'bomb') {
                if (firePressed && this.cool <= 0) { this._throwBomb(); this.cool = 0.55; }
                if (alt && this.remoteCount()) this._detonateRemote();
                else if ((alt || Input.pressed('ammo')) && typeof GameShop !== 'undefined') GameShop.cycle('bomb');
            }
            else if (id === 'grab') {
                if (firePressed && !this.held) this._tryGrab();
                if (!fire && this.held && !this.held.e) this._release(false);
                if (alt && this.held) this._release(true);
            }
            else if (id === 'spawner') {
                if (firePressed && this.cool <= 0) { this._spawn(); this.cool = 0.25; }
                if (alt) { this.spawnKind = (this.spawnKind + 1) % this.spawnKinds.length; this.emit({ type: 'kind', kind: this.spawnKinds[this.spawnKind] }); if (typeof GameAudio !== 'undefined') GameAudio.ui('toggle'); }
            }
            else if (id === 'torch') this._torch(fire, dt);
        }
        if (id !== 'torch' && this._torchLoop) this._torchLoop.set(0);
        if (this.held && this.held.e && !Input.down('interact') && Input.pressed('attack')) this._release(true);
        // кувалда: удар в середине замаха
        if (this.swing >= 0) {
            this.swing += dt;
            if (!this._swingHit && this.swing > 0.11) { this._swingHit = true; this._hammer(); }
            if (this.swing > 0.42) this.swing = -1;
        }
        // захват: цель перед глазами
        if (this.held) {
            const b = this.held.body;
            if (b.dead) { this._release(false); }
            else {
                const e = p.eye, d = p.dir();
                const t = this.held.joint.target;
                t[0] = e.x + d.x * this.held.dist; t[1] = e.y + d.y * this.held.dist; t[2] = e.z + d.z * this.held.dist;
            }
        }
        this._updateRockets(sdt);
        this._updateBombs(sdt);
        this._updatePickups(dt);
        // прицел для HUD
        const r = this._eyeRay(6);
        this.aim = r.hit ? { t: r.hit.t, mat: VoxMat.of(r.hit.v).key, body: r.hit.body, mass: r.hit.body ? r.hit.body.mass : 0,
            grabbable: !!(r.hit.body && r.hit.body.mass <= this._grabMax() && r.hit.t < 4.2) } : null;
        this._animate(dt);
    },

    _grabMax() { return typeof RL_GRAB_MAX_MASS !== 'undefined' ? RL_GRAB_MAX_MASS : 450; },

    // ------------------------------------------------------------------ инструменты

    _hammer() {
        const { e, d, hit } = this._eyeRay(2.8);
        const p = this.game.player;
        if (!hit) return;
        const m = VoxMat.of(hit.v);
        const cx = hit.x - hit.nx * 0.1, cy = hit.y - hit.ny * 0.1, cz = hit.z - hit.nz * 0.1;
        // Playables: удар шире по площади и во столько же раз сильнее толкает; бетон и металл ломаются как кирпич (all)
        const B = this._boost, area = B ? (typeof RL_PL_HAMMER_AREA !== 'undefined' ? RL_PL_HAMMER_AREA : 3) : 1;
        const kick = 420 * area;
        let res = VoxDestruction.carve(cx, cy, cz, 0.3 * Math.sqrt(area), { power: 2, all: B, jitter: 0.45, speed: B ? 4 : 2.6 });
        if (!res.count && m.hard === 3) res = VoxDestruction.carve(cx, cy, cz, 0.13, { power: 3, jitter: 0.6, speed: 2 });
        if (hit.body && !hit.body.dead) VoxPhysics.applyImpulse(hit.body, hit.x, hit.y, hit.z, d.x * kick, d.y * kick, d.z * kick);
        VoxDestruction.detach(null);
        VoxFX.dust(hit.x, hit.y, hit.z, hit.v & 127, res.count ? Math.min(1.5, res.count / 40) : 0.2, hit.nx, hit.ny, hit.nz);
        if (m.sound === 'metal' || !res.count) VoxFX.sparks(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, m.sound === 'metal' ? 12 : 3, 0.8);
        if (typeof GameAudio !== 'undefined') {
            GameAudio.swing(true);
            if (res.count) GameAudio.breakVoxels(VoxMat.of(res.mat || hit.v).sound, res.count, hit.x, hit.y, hit.z);
            else GameAudio.impact(m.sound, 0.7, hit.x, hit.y, hit.z);
        }
        p.addTrauma(0.18);
        this.recoil = 0.6;
        this.emit({ type: 'hit', tool: 'hammer', count: res.count });
    },

    _bullet(e, d, power, radius, impulse, pen) {
        let ox = e.x, oy = e.y, oz = e.z, left = 160, last = null, first = null, total = 0;
        for (let k = 0; k < pen; k++) {
            const hit = this.ray(ox, oy, oz, d.x, d.y, d.z, left);
            if (!hit) break;
            last = hit;
            if (!first) first = hit;
            const m = VoxMat.of(hit.v);
            const res = VoxDestruction.carve(hit.x + d.x * 0.04, hit.y + d.y * 0.04, hit.z + d.z * 0.04, radius, { power, all: this._boost, jitter: 0.5, speed: 4.5 });
            total += res.count;
            if (hit.body && !hit.body.dead) VoxPhysics.applyImpulse(hit.body, hit.x, hit.y, hit.z, d.x * impulse, d.y * impulse, d.z * impulse);
            if (hit.body && hit.body.explosive) VoxDestruction.queueExplosion(hit.body.x[0], hit.body.x[1], hit.body.x[2], 2.8, 0.05);
            if (m.sound === 'metal' || m.hard >= 3) VoxFX.sparks(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, m.sound === 'metal' ? 9 : 4, 0.9);
            VoxFX.dust(hit.x, hit.y, hit.z, hit.v & 127, res.count ? 0.5 : 0.25, hit.nx, hit.ny, hit.nz);
            if (typeof GameAudio !== 'undefined') {
                if (res.count) GameAudio.breakVoxels(m.sound, res.count, hit.x, hit.y, hit.z);
                else GameAudio.impact(m.sound, 0.45, hit.x, hit.y, hit.z);
            }
            // мягкое прошивается насквозь (Playables — и твёрдое, теряя силу на каждом слое)
            if ((m.hard >= 3 && !this._boost) || power < 2) break;
            power = Math.max(1, power - (m.hard >= 2 && k >= 1 ? 1 : 0));   // первый плотный слой — без потери силы
            ox = hit.x + d.x * 0.12; oy = hit.y + d.y * 0.12; oz = hit.z + d.z * 0.12;
            left -= hit.t + 0.12;
        }
        if (total) VoxDestruction.detach(null);
        return { last, first, total };
    },

    /** Множитель урона винтовки и дробовика (по объёму): в Playables — RL_PL_DAMAGE, иначе 1. */
    _gunMul() { return this._boost ? Math.max(1, typeof RL_PL_DAMAGE !== 'undefined' ? RL_PL_DAMAGE : 2.5) : 1; },

    _muzzlePos() {
        const n = this.vm[this.tool.id];
        if (n && n.metadata && n.metadata.muzzle) {
            n.computeWorldMatrix(true);
            const mz = n.metadata.muzzle;
            const v = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(mz[0], mz[1], mz[2]), n.getWorldMatrix());
            return { x: v.x, y: v.y, z: v.z };
        }
        const p = this.game.player, e = p.eye, d = p.dir();
        const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
        return { x: e.x + d.x * 0.7 + cy * 0.16, y: e.y + d.y * 0.7 - 0.12, z: e.z + d.z * 0.7 - sy * 0.16 };
    },

    _rifle() {
        const p = this.game.player, e = p.eye, d0 = p.dir();
        const s = 0.004;
        const d = this._norm(d0.x + (Math.random() - 0.5) * s, d0.y + (Math.random() - 0.5) * s, d0.z + (Math.random() - 0.5) * s);
        const G = this._gunMul();
        const r = this._bullet(e, d, 3, 0.16 * Math.cbrt(G), 260 * G, 6);
        const mz = this._muzzlePos();
        VoxFX.muzzle(mz.x, mz.y, mz.z, d.x, d.y, d.z, 1);
        const end = r.last ? r.last : { x: e.x + d.x * 120, y: e.y + d.y * 120, z: e.z + d.z * 120 };
        VoxFX.tracer(mz.x, mz.y, mz.z, end.x, end.y, end.z);
        p.kick += 0.028; p.kickYaw += (Math.random() - 0.5) * 0.012; p.addTrauma(0.06);
        this.recoil = 1;
        if (typeof GameAudio !== 'undefined') GameAudio.shot('rifle');
        this.emit({ type: 'hit', tool: 'rifle', count: r.total });
    },

    _shotgun() {
        const p = this.game.player, e = p.eye, d0 = p.dir();
        let total = 0;
        const mz = this._muzzlePos();
        const G = this._gunMul();
        // Playables: объём дроби и пролома × G по любому материалу (бетон и металл — как кирпич)
        const sg = Math.cbrt(G);
        let hx = 0, hy = 0, hz = 0, hn = 0, near = 1e9;
        for (let i = 0; i < 12; i++) {
            const s = 0.09;
            const d = this._norm(d0.x + (Math.random() - 0.5) * s, d0.y + (Math.random() - 0.5) * s, d0.z + (Math.random() - 0.5) * s);
            const r = this._bullet(e, d, 2, 0.13 * sg, 140 * G, 3);
            total += r.total;
            // пролом — по месту ПЕРВОГО попадания: дробь прошивает мягкое, и последнее попадание бывает уже за стеной
            if (r.first) { hx += r.first.x; hy += r.first.y; hz += r.first.z; hn++; near = Math.min(near, r.first.t); }
            if (r.last && i % 3 === 0) VoxFX.tracer(mz.x, mz.y, mz.z, r.last.x, r.last.y, r.last.z);
        }
        // вблизи заряд дроби выносит кусок целиком: пролом в среднем месте попаданий (мягкое и кирпич, бетон — сколом)
        if (hn && near < 5) {
            const k = 1 - near / 5;
            const cx = hx / hn + d0.x * 0.1, cy = hy / hn + d0.y * 0.1, cz = hz / hn + d0.z * 0.1;
            const big = VoxDestruction.carve(cx, cy, cz, (0.18 + 0.32 * k) * sg, { power: 2, all: G > 1, jitter: 0.55, speed: 5 });
            const chip = VoxDestruction.carve(cx, cy, cz, 0.1 + 0.14 * k, { power: 3, jitter: 0.6, speed: 4 });
            total += big.count + chip.count;
            if (big.count + chip.count) { VoxDestruction.detach(null); VoxFX.dust(cx, cy, cz, (big.mat || chip.mat || 9) & 127, 1.2, -d0.x, -d0.y, -d0.z); }
        }
        VoxFX.muzzle(mz.x, mz.y, mz.z, d0.x, d0.y, d0.z, 1.8);
        p.kick += 0.09; p.addTrauma(0.22);
        p.push(-d0.x * 1.2, 0, -d0.z * 1.2);
        this.recoil = 1.6;
        if (typeof GameAudio !== 'undefined') GameAudio.shot('shotgun');
        this.emit({ type: 'hit', tool: 'shotgun', count: total });
    },

    _launch() {
        const p = this.game.player, d = p.dir(), mz = this._muzzlePos();
        // модель ракеты из Blender, если есть (GameWeapons.rocket(scene) — узел носом вдоль −z)
        let node = null;
        const GW = typeof GameWeapons !== 'undefined' ? /** @type {any} */ (GameWeapons) : null;
        if (GW && typeof GW.rocket === 'function') { try { node = GW.rocket(VoxRender.scene); } catch (e) { node = null; } }
        if (node) { node.rotationQuaternion = node.rotationQuaternion || new BABYLON.Quaternion(); node.position.set(mz.x, mz.y, mz.z); }
        const kind = typeof GameShop !== 'undefined' && GameShop.game ? GameShop.variant('rocket') : 'normal';
        const spd = GameTools.ROCKETS[kind] ? GameTools.ROCKETS[kind].speed : 40;
        if (node && kind !== 'normal') node.scaling.setAll(kind === 'nuke' ? 1.6 : (kind === 'big' ? 1.35 : 1.1));
        this.rockets.push({ x: mz.x, y: mz.y, z: mz.z, vx: d.x * spd + p.vel.x, vy: d.y * spd + p.vel.y, vz: d.z * spd + p.vel.z, t: 0, node, kind });
        VoxFX.muzzle(mz.x, mz.y, mz.z, d.x, d.y, d.z, 1.5);
        for (let i = 0; i < 6; i++) VoxFX.puff(mz.x - d.x * 0.8, mz.y - d.y * 0.8, mz.z - d.z * 0.8, { size: 0.4, grow: 1.5, life: 2, alpha: 0.5, vx: -d.x * 3 + (Math.random() - 0.5), vy: -d.y * 3 + 0.4, vz: -d.z * 3 + (Math.random() - 0.5), drag: 3, buoy: 0.2, r: 0.75, g: 0.75, b: 0.74 });
        p.kick += 0.05; p.addTrauma(0.2);
        this.recoil = 1.3;
        const wh = this._warhead();
        if (wh) wh.setEnabled(false);
        if (typeof GameAudio !== 'undefined') GameAudio.shot('launcher');
    },

    /** Боеголовка в модели ракетомёта (GameWeapons.models.launcher.parts.warhead) или null. */
    _warhead() {
        const GW = typeof GameWeapons !== 'undefined' ? /** @type {any} */ (GameWeapons) : null;
        const m = GW && GW.models && GW.models.launcher;
        return (m && m.parts && m.parts.warhead) || null;
    },

    _updateRockets(dt) {
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const r = this.rockets[i];
            r.t += dt;
            r.vy -= 1.6 * dt;
            const sp = Math.hypot(r.vx, r.vy, r.vz), step = sp * dt;
            const dx = r.vx / sp, dy = r.vy / sp, dz = r.vz / sp;
            const hit = this.ray(r.x, r.y, r.z, dx, dy, dz, step + 0.1);
            if (hit || r.t > 7 || r.y < 0) {
                const hx = hit ? hit.x - dx * 0.15 : r.x, hy = hit ? hit.y - dy * 0.15 : r.y, hz = hit ? hit.z - dz * 0.15 : r.z;
                this.rockets.splice(i, 1);
                if (r.node) r.node.dispose();
                this._rocketBlast(r.kind || 'normal', hx, hy, hz, dx, dy, dz);
                this.emit({ type: 'explode', tool: 'launcher' });
                continue;
            }
            // след каждые ~12 см
            const n = Math.max(1, Math.round(step / 0.12));
            for (let k = 0; k < n; k++) VoxFX.trail(r.x + dx * step * k / n, r.y + dy * step * k / n, r.z + dz * step * k / n);
            r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
            if (r.node) {
                r.node.position.set(r.x, r.y, r.z);
                // нос (−z) по скорости: yaw вокруг Y, pitch вокруг X
                const yaw = Math.atan2(-dx, -dz), pitch = Math.asin(Math.max(-1, Math.min(1, dy)));
                BABYLON.Quaternion.RotationYawPitchRollToRef(yaw, pitch, r.t * 8, r.node.rotationQuaternion);
            }
        }
    },

    _throwBomb() {
        const p = this.game.player, e = p.eye, d = p.dir();
        // тело бомбы — 2×2×4 вокселя (0.2 × 0.2 × 0.4 м); видна модель из Blender (_attachBombModel), сетка — только для физики
        const sx = 2, sy = 2, sz = 4;
        const grid = new Uint8Array(sx * sy * sz);
        for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) grid[x + sx * (z + sz * y)] = (z === 0 || z === sz - 1) ? M.metal : M.hazard;
        const k = 1 / VoxPhysics.vs;
        const kind = typeof GameShop !== 'undefined' && GameShop.game ? GameShop.variant('bomb') : 'pipe';
        const B = GameTools.BOMBS[kind] || GameTools.BOMBS.pipe;
        const tv = B.throwV;
        const b = VoxPhysics.createBody(grid, sx, sy, sz, Math.floor((e.x + d.x * 0.6) * k), Math.floor((e.y + d.y * 0.6 - 0.15) * k), Math.floor((e.z + d.z * 0.6) * k), {
            minCount: 1, v: [d.x * tv + p.vel.x, d.y * tv + 2.5 + p.vel.y * 0.5, d.z * tv + p.vel.z], w: [(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 12],
        });
        if (!b) return;
        b.x[0] = e.x + d.x * 0.6; b.x[1] = e.y + d.y * 0.6 - 0.15; b.x[2] = e.z + d.z * 0.6;
        b.px.set(b.x);
        // бомба не должна быть тяжёлой как сталь — 2.4 кг
        const s = B.mass / Math.max(1e-6, b.mass);
        b.mass = B.mass; b.invMass = 1 / B.mass;
        for (let i = 0; i < 9; i++) b.Il[i] /= s;
        VoxPhysics._syncR(b);
        this._attachBombModel(b);
        this.bombs.push({ body: b, fuse: B.fuse, kind, holder: null, stuck: null, local: null });
        if (typeof GameAudio !== 'undefined') GameAudio.grab('throw');
    },

    /** Модель бомбы из Blender (GameWeapons.models.bomb) на летящем теле: копия по размеру тела, воксельный вид скрыт. */
    _attachBombModel(b) {
        const GW = typeof GameWeapons !== 'undefined' ? /** @type {any} */ (GameWeapons) : null;
        const m = GW && GW.models && GW.models.bomb;
        if (!m || !m.node || !b.node) return;
        const root = /** @type {BABYLON.TransformNode} */ (m.node.clone('bombWorld', null));
        if (!root) return;
        root.setEnabled(true);
        root.rotationQuaternion = null;
        root.position.setAll(0); root.rotation.setAll(0); root.scaling.setAll(1);
        root.computeWorldMatrix(true);
        const meshes = root.getChildMeshes(false);
        for (const ms of meshes) { ms.renderingGroupId = 0; ms.isPickable = false; ms.receiveShadows = true; ms.computeWorldMatrix(true); }
        const bb = root.getHierarchyBoundingVectors(true);
        const size = bb.max.subtract(bb.min), c = bb.min.add(bb.max).scale(0.5);
        const long = Math.max(size.x, size.y, size.z) || 1;
        const k = 0.4 / long;                                     // длина модели = длине тела (0.4 м)
        // длинная ось модели — вдоль оси z сетки тела
        const pivot = new BABYLON.TransformNode('bombPivot', VoxRender.scene);
        pivot.parent = b.node;
        if (size.x >= size.y && size.x >= size.z) pivot.rotation.y = Math.PI / 2;
        else if (size.y >= size.z) pivot.rotation.x = Math.PI / 2;
        root.parent = pivot;
        root.scaling.setAll(k);
        root.position.set(-c.x * k, -c.y * k, -c.z * k);
        if (b.meshO) b.meshO.setEnabled(false);
        if (b.meshG) b.meshG.setEnabled(false);
    },

    /** Виды снарядов ракетомёта: скорость и радиус взрыва. */
    ROCKETS: {
        normal: { speed: 40, r: 2.4 },
        big: { speed: 30, r: 3.8 },
        cluster: { speed: 36, r: 1.4 },
        nuke: { speed: 26, r: 6.5 },
        gold: { speed: 44, r: 3.2 },
    },
    /** Виды бомб: запал (с), масса (кг), скорость броска, радиус. */
    BOMBS: {
        pipe: { fuse: 2.6, mass: 2.4, throwV: 12, r: 2.8 },
        sticky: { fuse: 3.0, mass: 2.0, throwV: 13, r: 2.8 },
        fire: { fuse: 2.6, mass: 2.4, throwV: 12, r: 1.6 },
        remote: { fuse: Infinity, mass: 2.4, throwV: 12, r: 3.0 },
        cluster: { fuse: 2.4, mass: 3.0, throwV: 11, r: 1.5 },
        demo: { fuse: 3.5, mass: 6.0, throwV: 8, r: 4.4 },
        gold: { fuse: 2.6, mass: 2.4, throwV: 12, r: 3.6 },
    },
    /** @type {{ x: number, y: number, z: number, vx: number, vy: number, vz: number, t: number, life: number, r: number }[]} */
    bomblets: [],

    /** Взрыв снаряда по виду: кластер рассыпается, ядерный — свой взрыв с грибом. */
    _rocketBlast(kind, x, y, z, dx, dy, dz) {
        const R = this.ROCKETS[kind] ? this.ROCKETS[kind].r : 2.4;
        if (kind === 'nuke') { VoxDestruction.explode(x, y, z, R, { nuke: true }); return; }
        VoxDestruction.explode(x, y, z, R);
        if (kind === 'cluster') this._scatter(x - dx * 0.3, y - dy * 0.3 + 0.3, z - dz * 0.3, 8, 7, 1.5);
        if (kind === 'gold') { VoxDestruction.igniteSphere(x, y, z, 2.2); VoxFX.sparks(x, y, z, 0, 1, 0, 40, 1.4); }
    },

    /** Разлёт n мелких зарядов (кассетные бомба и ракета). */
    _scatter(x, y, z, n, speed, r) {
        for (let i = 0; i < n; i++) {
            const a = i / n * Math.PI * 2 + Math.random() * 0.6, up = 0.35 + Math.random() * 0.6;
            const sp = speed * (0.6 + Math.random() * 0.6);
            this.bomblets.push({ x, y, z, vx: Math.cos(a) * sp, vy: up * sp, vz: Math.sin(a) * sp, t: 0, life: 0.7 + Math.random() * 0.9, r });
        }
    },

    _updateBomblets(dt) {
        for (let i = this.bomblets.length - 1; i >= 0; i--) {
            const q = this.bomblets[i];
            q.t += dt;
            q.vy -= 9.8 * dt;
            const sp = Math.hypot(q.vx, q.vy, q.vz) || 1, step = sp * dt;
            const hit = this.ray(q.x, q.y, q.z, q.vx / sp, q.vy / sp, q.vz / sp, step + 0.05);
            if (hit || q.t > q.life || q.y < 0.5) {
                this.bomblets.splice(i, 1);
                VoxDestruction.explode(hit ? hit.x - q.vx / sp * 0.1 : q.x, hit ? hit.y - q.vy / sp * 0.1 : q.y, hit ? hit.z - q.vz / sp * 0.1 : q.z, q.r);
                continue;
            }
            q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
            if (Math.random() < 0.6) VoxFX.sparks(q.x, q.y, q.z, 0, 1, 0, 1, 0.9);
        }
    },

    /** Сколько дистанционных зарядов ждут подрыва. */
    remoteCount() { let n = 0; for (const bm of this.bombs) if (bm.kind === 'remote') n++; return n; },
    _detonateRemote() {
        let k = 0;
        for (const bm of this.bombs) if (bm.kind === 'remote') bm.fuse = 0.05 + (k++) * 0.09;
        if (typeof GameAudio !== 'undefined') GameAudio.ui('click');
    },

    /** Липкая бомба: при касании переходит в «держатель» (узел без физики), прилипший к миру или к телу. */
    _stick(bm) {
        const b = bm.body;
        let other = null;
        for (const m of VoxPhysics.manifolds) if (m.a === b && m.other) { other = m.other; break; }
        const holder = new BABYLON.TransformNode('stickyBomb', VoxRender.scene);
        holder.position.set(b.x[0], b.x[1], b.x[2]);
        holder.rotationQuaternion = new BABYLON.Quaternion(b.q[0], b.q[1], b.q[2], b.q[3]);
        // модель (дети узла тела) переходит к держателю с тем же положением в мире
        if (b.node) for (const ch of b.node.getChildren().slice()) /** @type {BABYLON.TransformNode} */ (ch).setParent(holder);
        if (other && other.node) {
            holder.setParent(other.node);
            bm.stuck = other;
        }
        bm.holder = holder;
        VoxPhysics.remove(b);
        if (typeof GameAudio !== 'undefined') GameAudio.impact('metal', 0.35, b.x[0], b.x[1], b.x[2]);
    },

    _updateBombs(dt) {
        this._updateBomblets(dt);
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const bm = this.bombs[i];
            const b = bm.body;
            bm.fuse -= dt;
            if (bm.kind === 'sticky' && !bm.holder && !b.dead && b._touch && b.age > 0.05) this._stick(bm);
            // положение бомбы: тело или держатель
            let x, y, z;
            if (bm.holder) {
                if (bm.stuck && bm.stuck.dead) { const p = bm.holder.getAbsolutePosition(); bm.holder.setParent(null); bm.holder.position.copyFrom(p); bm.stuck = null; }
                const p = bm.holder.getAbsolutePosition(); x = p.x; y = p.y; z = p.z;
            } else { x = b.x[0]; y = b.x[1]; z = b.x[2]; }
            if (Math.random() < (bm.kind === 'remote' ? 0.15 : 0.7)) VoxFX.sparks(x, y + 0.1, z, 0, 1, 0, 1, bm.kind === 'remote' ? 0.4 : 0.8);
            if (bm.fuse <= 0 || (!bm.holder && b.dead)) {
                this.bombs.splice(i, 1);
                if (bm.holder) bm.holder.dispose(); else VoxPhysics.remove(b);
                const B = this.BOMBS[bm.kind] || this.BOMBS.pipe;
                VoxDestruction.explode(x, y, z, B.r);
                if (bm.kind === 'fire') {
                    VoxDestruction.igniteSphere(x, y, z, 3.0);
                    for (let k = 0; k < 24; k++) VoxFX.fire(x + (Math.random() - 0.5) * 3, y + Math.random() * 0.8, z + (Math.random() - 0.5) * 3, 1);
                }
                if (bm.kind === 'cluster') this._scatter(x, y + 0.2, z, 6, 6, 1.6);
                if (bm.kind === 'gold') { VoxFX.sparks(x, y, z, 0, 1, 0, 60, 1.5); VoxRender.flash(x, y + 1, z, [1, 0.85, 0.35], 30, 22, 0.6, 0.2); }
                this.emit({ type: 'explode', tool: 'bomb' });
            }
        }
    },

    _tryGrab() {
        const { hit } = this._eyeRay(4.2);
        if (!hit || !hit.body || hit.body.mass > this._grabMax()) { if (typeof GameAudio !== 'undefined') GameAudio.ui('click'); return false; }
        const b = hit.body;
        const R = b.R;
        const ldx = hit.x - b.x[0], ldy = hit.y - b.x[1], ldz = hit.z - b.x[2];
        const local = [R[0] * ldx + R[3] * ldy + R[6] * ldz, R[1] * ldx + R[4] * ldy + R[7] * ldz, R[2] * ldx + R[5] * ldy + R[8] * ldz];
        const g = typeof RL_GRAVITY !== 'undefined' ? RL_GRAVITY : 9.81;
        const joint = VoxPhysics.grab(b, local, [hit.x, hit.y, hit.z], b.mass * g * 2.5 + 900);
        this.held = { joint, body: b, dist: Math.max(1.4, Math.min(3.2, hit.t)), e: this.current !== 5 };
        if (typeof GameAudio !== 'undefined') GameAudio.grab('grab');
        this.emit({ type: 'grab' });
        return true;
    },

    _release(throwIt) {
        const h = this.held;
        if (!h) return;
        this.held = null;
        VoxPhysics.release(h.joint);
        if (throwIt && !h.body.dead) {
            const d = this.game.player.dir();
            const J = Math.min(h.body.mass * 14, 2600);
            VoxPhysics.applyImpulse(h.body, h.body.x[0], h.body.x[1], h.body.x[2], d.x * J, d.y * J + J * 0.1, d.z * J);
            if (typeof GameAudio !== 'undefined') GameAudio.grab('throw');
            this.emit({ type: 'throw' });
        } else if (typeof GameAudio !== 'undefined') GameAudio.grab('drop');
    },

    /** Сетка предмета спавнера: { grid, sx, sy, sz }. */
    makeProp(kind) {
        const mk = (sx, sy, sz, fn) => {
            const grid = new Uint8Array(sx * sy * sz);
            for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) grid[x + sx * (z + sz * y)] = fn(x, y, z) || 0;
            return { grid, sx, sy, sz };
        };
        if (kind === 'crate') return mk(7, 7, 7, (x, y, z) => {
            const ex = (x === 0 || x === 6) ? 1 : 0, ey = (y === 0 || y === 6) ? 1 : 0, ez = (z === 0 || z === 6) ? 1 : 0;
            return (ex + ey + ez >= 2) ? M.darkwood : M.crate;
        });
        if (kind === 'barrel') return mk(7, 9, 7, (x, y, z) => {
            const dx = x - 3, dz = z - 3;
            if (dx * dx + dz * dz > 10) return 0;
            return (y === 0 || y === 8 || y === 3 || y === 6) ? M.metal : M.barrel;
        });
        if (kind === 'block') return mk(6, 12, 6, (x, y, z) => ((x + y + z) % 7 === 0 ? M.concrete2 : M.concrete));
        if (kind === 'plank') return mk(3, 2, 26, () => M.plank);
        if (kind === 'ball') return mk(9, 9, 9, (x, y, z) => ((x - 4) ** 2 + (y - 4) ** 2 + (z - 4) ** 2 <= 17 ? M.rock : 0));
        return mk(14, 10, 3, (x, y) => (y % 3 === 2 ? M.mortar : ((x + (((y / 3) | 0) % 2) * 2) % 4 === 0 ? M.mortar : M.brick)));
    },

    _spawn() {
        const { e, d, hit } = this._eyeRay(12);
        const kind = this.spawnKinds[this.spawnKind];
        const pr = this.makeProp(kind);
        const vs = VoxPhysics.vs;
        let px, py, pz;
        if (hit) { px = hit.x + hit.nx * 0.6; py = hit.y + hit.ny * 0.6 + pr.sy * vs * 0.5; pz = hit.z + hit.nz * 0.6; }
        else { px = e.x + d.x * 5; py = e.y + d.y * 5; pz = e.z + d.z * 5; }
        const k = 1 / vs;
        const b = VoxPhysics.createBody(pr.grid, pr.sx, pr.sy, pr.sz, Math.floor(px * k), Math.floor(py * k), Math.floor(pz * k), { minCount: 1 });
        if (!b) return;
        b.x[0] = px; b.x[1] = py; b.x[2] = pz;
        const yaw = this.game.player.yaw + (Math.random() - 0.5) * 0.3;
        b.q[0] = 0; b.q[1] = Math.sin(yaw / 2); b.q[2] = 0; b.q[3] = Math.cos(yaw / 2);
        VoxPhysics._syncR(b);
        b.px.set(b.x); b.pq.set(b.q);
        VoxFX.dust(px, py - pr.sy * vs * 0.5, pz, M.foam, 0.4);
        if (typeof GameAudio !== 'undefined') GameAudio.ui('click');
        this.emit({ type: 'spawn', kind });
    },

    _torch(on, dt) {
        if (typeof GameAudio !== 'undefined' && !this._torchLoop && GameAudio.fireLoop) this._torchLoop = GameAudio.fireLoop();
        if (this._torchLoop) this._torchLoop.set(on ? 0.9 : 0);
        if (!on) return;
        const p = this.game.player, d = p.dir(), mz = this._muzzlePos();
        for (let i = 0; i < 4; i++) {
            const s = 0.12, sp = 9 + Math.random() * 4;
            VoxFX.puff(mz.x, mz.y, mz.z, { add: true, fire: true, size: 0.12, grow: 1.6, life: 0.45 + Math.random() * 0.2,
                vx: (d.x + (Math.random() - 0.5) * s) * sp + p.vel.x, vy: (d.y + (Math.random() - 0.5) * s) * sp + 0.5, vz: (d.z + (Math.random() - 0.5) * s) * sp + p.vel.z, drag: 2.2, buoy: 2.5, fadeIn: 0.02 });
        }
        this._torchT -= dt;
        if (this._torchT <= 0) {
            this._torchT = 0.08;
            const { hit } = this._eyeRay(5.5);
            if (hit) {
                const n = VoxDestruction.igniteSphere(hit.x - hit.nx * 0.05, hit.y - hit.ny * 0.05, hit.z - hit.nz * 0.05, 0.25);
                VoxRender.flash(hit.x + hit.nx * 0.3, hit.y + hit.ny * 0.3, hit.z + hit.nz * 0.3, [1, 0.55, 0.2], 5, 7, 0.15, 0.6);
                if (hit.body && !hit.body.dead) VoxPhysics.applyImpulse(hit.body, hit.x, hit.y, hit.z, d.x * 6, d.y * 6, d.z * 6);
                if (hit.body && hit.body.explosive && Math.random() < 0.08) VoxDestruction.queueExplosion(hit.body.x[0], hit.body.x[1], hit.body.x[2], 2.8, 0.1);
                if (n) this.emit({ type: 'hit', tool: 'torch', count: n });
            }
        }
        VoxRender.flash(mz.x + d.x * 1.5, mz.y + d.y * 1.5, mz.z + d.z * 1.5, [1, 0.6, 0.25], 3, 6, 0.1, 0.5);
    },

    // ------------------------------------------------------------------ находки (Playables)

    /** @type {{ id: string, node: BABYLON.TransformNode, beam: BABYLON.Mesh | null, x: number, y: number, z: number, t: number }[]} */
    pickups: [],
    _pkInit: false,

    /**
     * Playables: закрытые ракетомёт и бомбы лежат на земле недалеко от старта, впереди слева и справа —
     * вращаются над столбом света. Подошёл — инструмент твой до конца уровня (GameShop.found), в руках сразу.
     */
    _spawnPickups() {
        this._pkInit = true;
        if (!this.playables || (typeof RL_PL_PICKUPS !== 'undefined' ? RL_PL_PICKUPS : 1) <= 0) return;
        if (typeof GameShop === 'undefined' || !GameShop.game) return;
        const p = this.game.player, w = this.game.world, vs = w.vs;
        const f = p.dir(), fl = Math.hypot(f.x, f.z) || 1, fx = f.x / fl, fz = f.z / fl;
        const top = /** @type {any} */ (w).groundTop || 20;
        // свободное место: столб над землёй пуст (3×3 клетки по 0.3 м), не за краем карты
        const free = (x, z) => {
            if (x < 1 || z < 1 || x > w.sx * vs - 1 || z > w.sz * vs - 1) return -1;
            let gy = -1;
            for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
                const ix = Math.floor((x + ox * 0.3) / vs), iz = Math.floor((z + oz * 0.3) / vs);
                for (let iy = Math.min(w.sy - 1, top + 30); iy >= top; iy--) if (w.get(ix, iy, iz)) return -1;
                let y = top - 1;
                while (y > 0 && !w.get(ix, y, iz)) y--;
                gy = Math.max(gy, y);
            }
            return (gy + 1) * vs;
        };
        const spots = [];
        for (const { id, side } of [{ id: 'launcher', side: 1 }, { id: 'bomb', side: -1 }]) {
            if (!GameShop.toolLocked(id)) continue;
            let at = null;
            for (let r = 6; r <= 18 && !at; r += 1.5) for (const a of [0.45, 0.25, 0.7, 0.95, 1.25]) {
                const ang = a * side, c = Math.cos(ang), s = Math.sin(ang);
                const x = p.pos.x + (fx * c - fz * s) * r, z = p.pos.z + (fx * s + fz * c) * r;
                if (spots.some(q => Math.hypot(q.x - x, q.z - z) < 3)) continue;
                const y = free(x, z);
                if (y >= 0) { at = { x, y, z }; break; }
            }
            if (at) { spots.push(at); this._addPickup(id, at.x, at.y, at.z); }
        }
    },

    _addPickup(id, x, y, z) {
        const scene = VoxRender.scene;
        const node = new BABYLON.TransformNode('pickup-' + id, scene);
        node.position.set(x, y + 1.1, z);
        const GW = typeof GameWeapons !== 'undefined' ? /** @type {any} */ (GameWeapons) : null;
        const m = GW && GW.models && GW.models[id];
        const len = id === 'launcher' ? 1.5 : 0.8;
        const src = m && m.node ? /** @type {BABYLON.TransformNode} */ (m.node.clone('pickupModel', null)) : null;
        if (src) {
            src.setEnabled(true);
            src.rotationQuaternion = null;
            src.position.setAll(0); src.rotation.setAll(0); src.scaling.setAll(1);
            src.computeWorldMatrix(true);
            for (const ms of src.getChildMeshes(false)) {
                ms.renderingGroupId = 0; ms.isPickable = false; ms.alwaysSelectAsActiveMesh = false; ms.computeWorldMatrix(true);
                // свой материал с подсветкой: находка читается издалека (материал модели в руках не трогаем)
                if (ms.material) { const mc = /** @type {BABYLON.StandardMaterial} */ (ms.material.clone(ms.material.name + '-pickup')); mc.emissiveColor = new BABYLON.Color3(0.5, 0.42, 0.18); ms.material = mc; }
            }
            const bb = src.getHierarchyBoundingVectors(true);
            const size = bb.max.subtract(bb.min), c = bb.min.add(bb.max).scale(0.5);
            const k = len / (Math.max(size.x, size.y, size.z) || 1);
            // наклон ствола вверх: при вращении модель не видна торцом
            const tilt = new BABYLON.TransformNode('pickupTilt', scene);
            tilt.parent = node;
            tilt.rotation.x = -0.6; tilt.rotation.z = 0.2;
            src.parent = tilt;
            src.scaling.setAll(k);
            src.position.set(-c.x * k, -c.y * k, -c.z * k);
        } else {
            const box = BABYLON.MeshBuilder.CreateBox('pickupBox', { width: 0.3, height: 0.3, depth: len }, scene);
            const bm = new BABYLON.StandardMaterial('pickupBoxMat', scene);
            bm.diffuseColor = new BABYLON.Color3(0.35, 0.4, 0.2); bm.emissiveColor = new BABYLON.Color3(0.2, 0.15, 0.02);
            box.material = bm; box.parent = node; box.isPickable = false;
        }
        // столб света: виден издалека, в нём лежит находка
        const beam = BABYLON.MeshBuilder.CreateCylinder('pickupBeam', { height: 7, diameterTop: 0.5, diameterBottom: 0.9, tessellation: 16, cap: BABYLON.Mesh.NO_CAP }, scene);
        const mat = new BABYLON.StandardMaterial('pickupBeamMat', scene);
        mat.disableLighting = true;
        mat.emissiveColor = new BABYLON.Color3(1, 0.78, 0.1);
        mat.alpha = 0.22;
        mat.backFaceCulling = false;
        mat.disableDepthWrite = true;
        beam.material = mat;
        beam.isPickable = false;
        beam.renderingGroupId = 1;
        beam.position.set(x, y + 3.5, z);
        this.pickups.push({ id, node, beam, x, y, z, t: Math.random() * 6 });
    },

    _updatePickups(dt) {
        if (!this._pkInit) { if (typeof GameShop !== 'undefined' && GameShop.game && this.game.player) this._spawnPickups(); return; }
        if (!this.pickups.length) return;
        const p = this.game.player;
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const k = this.pickups[i];
            k.t += dt;
            k.node.rotation.y = k.t * 1.6;
            k.node.position.y = k.y + 1.1 + Math.sin(k.t * 2.2) * 0.12;
            if (k.beam && k.beam.material) /** @type {BABYLON.StandardMaterial} */ (k.beam.material).alpha = 0.18 + Math.sin(k.t * 3) * 0.06;
            if (Math.random() < dt * 6) VoxFX.puff(k.x + (Math.random() - 0.5) * 0.6, k.y + 0.2, k.z + (Math.random() - 0.5) * 0.6, { add: true, mode: 5, size: 0.05, life: 1.2, alpha: 0.9,
                vy: 0.8 + Math.random() * 0.8, drag: 0.5, r: 3.6, g: 2.6, b: 0.6, fadeOut: 0.5 });
            const dx = p.pos.x - k.x, dz = p.pos.z - k.z;
            if (Math.hypot(dx, dz) > 1.3 || Math.abs(p.pos.y - k.y) > 2.2) continue;
            this._takePickup(k);
            this.pickups.splice(i, 1);
        }
    },

    _takePickup(k) {
        const key = 'tool:' + k.id;
        GameShop.found[key] = true;
        if (typeof GameShop._lockSlots === 'function') GameShop._lockSlots();
        const i = this.list.findIndex(t => t.id === k.id);
        if (i >= 0) this.select(i);
        // свои материалы — без текстур: текстуры общие с моделью в руках
        const mats = new Set(k.node.getChildMeshes(false).map(ms => ms.material).filter(Boolean));
        k.node.dispose(false, false);
        for (const mt of mats) mt.dispose(false, false);
        if (k.beam) k.beam.dispose(false, true);
        VoxFX.sparks(k.x, k.y + 0.9, k.z, 0, 1, 0, 24, 1.2);
        VoxRender.flash(k.x, k.y + 1, k.z, [1, 0.8, 0.3], 6, 8, 0.4);
        if (typeof GameAudio !== 'undefined') GameAudio.ui('select');
        if (typeof GameHud !== 'undefined' && GameHud.toast) GameHud.toast('rlp.found', { name: GameShop.name(key) });
        this.emit({ type: 'pickup', id: k.id });
    },

    _norm(x, y, z) { const l = Math.hypot(x, y, z) || 1; return { x: x / l, y: y / l, z: z / l }; },

    // ------------------------------------------------------------------ модели в руках

    _buildViewmodels() {
        const scene = VoxRender.scene, cam = VoxRender.camera;
        const root = this.vmRoot = new BABYLON.TransformNode('vm', scene);
        root.parent = cam;
        scene.setRenderingAutoClearDepthStencil(2, true, true, true);
        const vox = (sx, sy, sz, fn) => {
            const grid = new Uint8Array(sx * sy * sz);
            for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) grid[x + sx * (z + sz * y)] = fn(x, y, z) || 0;
            const pad = new Uint8Array((sx + 2) * (sy + 2) * (sz + 2));
            for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) pad[(x + 1) + (sx + 2) * ((z + 1) + (sz + 2) * (y + 1))] = grid[x + sx * (z + sz * y)];
            const r = VoxMesher.build(pad, sx, sy, sz, 0, 0, 0, 0.1);
            const m = new BABYLON.Mesh('vmPart', scene);
            VoxRender.applyBuffers(m, r.opaque);
            m.material = VoxRender.mat;
            m.renderingGroupId = 2;
            m.isPickable = false;
            m.position.set(-sx * 0.05, -sy * 0.05, -sz * 0.1);    // ствол вдоль −z (к взгляду)
            return m;
        };
        const make = (id, parts, pos, scale) => {
            const n = new BABYLON.TransformNode('vm-' + id, scene);
            n.parent = root;
            for (const p of parts) p.parent = n;
            n.position.set(pos[0], pos[1], pos[2]);
            n.scaling.setAll(scale);
            n.setEnabled(false);
            n.metadata = { base: pos.slice() };
            this.vm[id] = n;
        };
        // кувалда: рукоять + боёк
        const handle = vox(1, 1, 14, (x, y, z) => (z < 3 ? M.rust : M.darkwood));
        const head = vox(3, 3, 6, () => M.metal); head.position.set(-0.15, -0.15, -1.6); head.rotation.y = Math.PI / 2;
        make('hammer', [handle, head], [0.32, -0.34, -0.55], 0.42);
        // винтовка
        make('rifle', [
            vox(2, 3, 9, (x, y, z) => (z > 6 ? M.darkwood : M.metal)),
            (() => { const b = vox(1, 1, 12, () => M.metal); b.position.set(-0.05, 0.05, -2.0); return b; })(),
            (() => { const s = vox(1, 1, 5, () => M.metal); s.position.set(-0.05, 0.25, -0.9); return s; })(),
            (() => { const s = vox(2, 3, 2, () => M.darkwood); s.position.set(-0.1, -0.3, -0.2); return s; })(),
        ], [0.24, -0.24, -0.5], 0.36);
        make('shotgun', [
            vox(2, 2, 10, (x, y, z) => (z > 6 ? M.wood : M.metal)),
            (() => { const b = vox(2, 1, 12, () => M.metal); b.position.set(-0.1, 0.1, -2.0); return b; })(),
            (() => { const s = vox(2, 2, 4, () => M.darkwood); s.position.set(-0.1, -0.25, -1.4); return s; })(),
        ], [0.25, -0.25, -0.52], 0.38);
        make('launcher', [
            vox(3, 3, 18, (x, y, z) => ((x === 1 && y === 1 && z < 2) ? 0 : (z < 2 || z > 15 ? M.metal : M.hazard))),
            (() => { const s = vox(1, 3, 2, () => M.metal); s.position.set(-0.05, -0.35, -0.6); return s; })(),
        ], [0.3, -0.26, -0.45], 0.36);
        make('bomb', [vox(3, 3, 6, (x, y, z) => (z === 0 || z === 5 ? M.metal : M.hazard))], [0.3, -0.3, -0.55], 0.4);
        make('grab', [
            vox(3, 3, 7, (x, y, z) => (z < 1 ? (x === 1 && y === 1 ? M.lamp : M.metal) : M.blue)),
            (() => { const s = vox(1, 3, 2, () => M.metal); s.position.set(-0.05, -0.35, -0.2); return s; })(),
        ], [0.28, -0.28, -0.5], 0.38);
        make('spawner', [
            vox(5, 3, 7, (x, y, z) => (y === 2 && z > 1 && z < 6 && x > 0 && x < 4 ? M.lamp : (z === 0 ? M.hazard : M.metal))),
        ], [0.27, -0.3, -0.5], 0.36);
        make('torch', [
            vox(3, 4, 5, () => M.barrel),
            (() => { const s = vox(1, 1, 9, () => M.metal); s.position.set(0.05, 0.3, -1.0); return s; })(),
        ], [0.28, -0.32, -0.5], 0.36);
        // модели из Blender (GameWeapons.models[id] = { node, base: [x,y,z], scale?, muzzle?: [x,y,z] }) заменяют воксельные заготовки
        const W = typeof GameWeapons !== 'undefined' && GameWeapons.models ? GameWeapons.models : null;
        if (W) for (const id in W) {
            const m = W[id];
            if (!m || !m.node || !this.vm[id]) continue;
            this.vm[id].dispose(false, false);
            m.node.parent = root;
            if (m.scale) m.node.scaling.setAll(m.scale);
            m.node.position.set(m.base[0], m.base[1], m.base[2]);
            m.node.metadata = Object.assign({}, m.node.metadata || {}, { base: m.base.slice(), muzzle: m.muzzle || null, model: m });
            m.node.setEnabled(false);
            this.vm[id] = m.node;
        }
    },

    _animate(dt) {
        const n = this.vm[this.tool.id];
        if (!n) return;
        const p = this.game.player;
        const base = n.metadata.base;
        const look = this.game.lastLook || { dx: 0, dy: 0 };
        this._sway.x += ((-look.dx * 0.0006) - this._sway.x) * Math.min(1, dt * 10);
        this._sway.y += ((look.dy * 0.0006) - this._sway.y) * Math.min(1, dt * 10);
        this.recoil += (0 - this.recoil) * Math.min(1, dt * 12);
        const bob = p.bobAmp;
        const sw = this.switchT > 0 ? Math.sin(this.switchT / 0.28 * Math.PI) * 0.25 : 0;
        n.position.set(
            base[0] + this._sway.x + Math.cos(p.bob) * bob * 0.6,
            base[1] + this._sway.y - Math.abs(Math.sin(p.bob)) * bob * 0.5 - sw - p.landDip * 0.3,
            base[2] + this.recoil * 0.06);
        let rx = this.recoil * 0.12 + this._sway.y * 2, ry = this._sway.x * 2, rz = 0;
        if (this.tool.id === 'hammer' && this.swing >= 0) {
            // замах за спину -> удар вниз-вправо к моменту попадания (0.11 с) -> возврат
            const t = this.swing;
            const a = t < 0.11 ? 0.6 - t / 0.11 * 1.35 : -0.75 * (1 - (t - 0.11) / 0.31);
            const s = t < 0.11 ? t / 0.11 : 1 - (t - 0.11) / 0.31;
            rx += a; ry += 0.3 * s; rz += -0.3 * s;
        }
        if (this.tool.id === 'hammer') { rx += -0.55; ry += -0.25; }
        if (this.held) rx += -0.12;
        n.rotation.set(rx, ry, rz);
    },
};
