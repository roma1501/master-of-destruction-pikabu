// Game.js — Rubble Lab: песочница разрушения. Свой 3D-мир (Game.ownWorld — main.js не создаёт
// Location3D): воксельный мир из маркеров карты Maps.js, физика твёрдых тел, разрушение, огонь,
// эффекты, игрок от первого лица и инструменты. Логика — update (не на паузе), рендер — каждый кадр.

/** @satisfies {Record<string, any>} */
const Game = {
    ownWorld: true,
    /** @type {LoryApp | null} */
    app: null,
    /** @type {VoxWorld | null} */
    world: null,
    /** @type {GamePlayer | null} */
    player: null,
    /** @type {any} */
    map: null,
    timeScale: 1,
    slowmo: false,
    ready_: false,
    save: /** @type {Record<string, any>} */ ({}),
    stats: { fps: 60, physMs: 0, frameMs: 0 },
    _acc: 0,

    async init(app) {
        this.app = app;
        this.save = (await Platform.load()) || {};
        const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('world3d'));
        canvas.style.display = 'block';
        // карта: ?map=<id> в адресе, иначе последняя игранная (продолжение), иначе первая
        const maps = typeof GAME_MAPS !== 'undefined' ? GAME_MAPS : [];
        const want = new URLSearchParams(location.search).get('map') || this.save.lastMap;
        this.map = maps.find(m => m.id === want) || maps[0] || { id: 'none', objects: [] };
        if (this.save.lastMap !== this.map.id) { this.save.lastMap = this.map.id; this.persist(); }
        const world = this.world = new VoxWorld(512, 192, 512);
        GameMapBuild.build(world, this.map);
        world.recount();
        LoadingScreen.set(84);
        VoxRender.init(canvas, world);
        if (this.save.quality) VoxRender.setQuality(this.save.quality);
        else VoxRender.setQuality(this.detectQuality());
        await VoxRender.buildAll(p => LoadingScreen.set(84 + Math.round(12 * p)));
        if (typeof VoxPhysics !== 'undefined' && VoxPhysics.init) VoxPhysics.init(world);
        if (typeof VoxFX !== 'undefined' && VoxFX.init) {
            VoxFX.init(VoxRender.scene, world);
            // снежная земля карты (ground 2 в Maps.js) — идёт снег
            if (this.map.ground === 2 && /** @type {any} */ (VoxFX).snowfall) /** @type {any} */ (VoxFX).snowfall(true);
        }
        if (typeof VoxDestruction !== 'undefined' && VoxDestruction.init) VoxDestruction.init(world);
        if (typeof GameMapBuild.spawnBodies === 'function') GameMapBuild.spawnBodies(world, this.map);
        if (typeof GameAudio !== 'undefined' && GameAudio.init) {
            GameAudio.init();
            // фон карты (ветер, город, порт…) — тема по id карты
            const A = /** @type {any} */ (GameAudio);
            if (A.ambience) A.ambience(A.themeFor ? A.themeFor(this.map.id) : 'lab');
        }

        const sp = this.marker('spawn') || { x: 2560, y: 2560, rot: [0, -90, 0] };
        const vs = world.vs;
        // курс маркера: 0 — вдоль +x, 90 — вниз по карте (+z); yaw 0 смотрит вдоль −z
        const heading = ((sp.rot && sp.rot[1]) || 0) * Math.PI / 180;
        const yaw = Math.atan2(-Math.cos(heading), -Math.sin(heading)) ;
        this.player = new GamePlayer(world, { x: sp.x / 10 * vs, y: (world.groundTop || 20) * vs + 0.02, z: sp.y / 10 * vs }, yaw);

        Input.init({
            app, mouse: 'lock', actions: {
                ...Input.DEFAULTS,
                attack: { keys: ['Mouse0'], pad: [7] },
                aim: { keys: ['Mouse2'], pad: [6] },
                interact: { keys: ['KeyE'], pad: [2] },
                tool1: { keys: ['Digit1'] }, tool2: { keys: ['Digit2'] }, tool3: { keys: ['Digit3'] }, tool4: { keys: ['Digit4'] },
                tool5: { keys: ['Digit5'] }, tool6: { keys: ['Digit6'] }, tool7: { keys: ['Digit7'] }, tool8: { keys: ['Digit8'] },
                toolNext: { keys: ['KeyQ'], pad: [5] }, toolPrev: { keys: [], pad: [4] },
                slowmo: { keys: ['KeyT'], pad: [3] },
                fly: { keys: ['KeyV'] },
                debug: { keys: ['F3'] },
                spawn: { keys: ['KeyF'] },
                reset: { keys: ['F9'] },
                shop: { keys: ['KeyB'] },
                ammo: { keys: ['KeyX'] },
            },
        });
        if (typeof GameWeapons !== 'undefined' && GameWeapons.load) {
            try { await GameWeapons.load(VoxRender.scene); } catch (e) { console.warn('GameWeapons:', e); }
        }
        if (typeof GameTools !== 'undefined' && GameTools.init) GameTools.init(this);
        if (typeof GameShop !== 'undefined') GameShop.init(this);
        if (typeof GameRewards !== 'undefined') GameRewards.init(this);
        if (typeof GameScore !== 'undefined' && GameScore.init) GameScore.init(this);
        if (typeof GameHud !== 'undefined' && GameHud.init) GameHud.init(this);
        this._bindFreeLook();
        this._bindUiAds();
        app.onFrame(dt => this.frame(dt));
        this.ready_ = true;
    },

    /**
     * Уровень графики для первого запуска (игрок ещё не выбирал): оценка устройства движка Quality.detect —
     * ядра, память, видеокарта, телефон, программный рендер. Слабое железо — сразу минимальная графика;
     * дальше VoxRender сам понижает уровень, если кадры медленные.
     */
    detectQuality() {
        let lvl = 2;
        try { if (typeof Quality !== 'undefined') lvl = Quality.detect(Quality.environment()); } catch (e) { lvl = 2; }
        if (typeof IS_MOBILE !== 'undefined' && IS_MOBILE) lvl = Math.min(lvl, 1);
        return lvl <= 0 ? 'low' : (lvl === 1 ? 'medium' : 'high');
    },

    /** Маркер карты по имени (первый) или null. */
    marker(name) {
        return (this.map.objects || []).find(o => o.kind === 'marker' && o.name === name) || null;
    },
    /** Все маркеры с именем name или name-N. */
    markers(name) {
        const re = new RegExp('^' + name + '(-\\d+)?$');
        return (this.map.objects || []).filter(o => o.kind === 'marker' && re.test(o.name));
    },

    update(dt) {
        if (!this.ready_) return;
        const look = Input.consumeLook();
        this._freeLook(look, dt);
        const sens = this.save.sens || 1;
        look.dx *= sens; look.dy *= sens;
        this.lastLook = look;
        const mv = Input.move();
        const p = this.player;
        if (Input.pressed('fly')) {
            // полёт открывается в магазине (5 просмотров рекламы)
            if (typeof GameShop !== 'undefined' && GameShop.game && !GameShop.owns('mode:fly')) { if (typeof GameHud !== 'undefined' && GameHud.toast) GameHud.toast('rls.locked'); }
            else p.fly = !p.fly;
        }
        if (Input.pressed('slowmo')) { this.slowmo = !this.slowmo; }
        this.timeScale += ((this.slowmo ? 0.2 : 1) - this.timeScale) * Math.min(1, dt * 8);
        p.update(dt, look, mv, {
            jump: Input.down('jump'), jumpPressed: Input.pressed('jump'),
            sprint: Input.down('sprint'), crouch: Input.down('crouch'),
        });
        const sdt = dt * this.timeScale;
        const t0 = performance.now();
        if (typeof VoxPhysics !== 'undefined' && VoxPhysics.update) VoxPhysics.update(sdt);
        if (typeof VoxDestruction !== 'undefined' && VoxDestruction.update) VoxDestruction.update(sdt);
        this.stats.physMs += ((performance.now() - t0) - this.stats.physMs) * 0.1;
        if (typeof GameTools !== 'undefined' && GameTools.update) GameTools.update(dt, sdt);
        if (typeof GameScore !== 'undefined' && GameScore.update) GameScore.update(dt);
        if (typeof GameShop !== 'undefined') {
            GameShop.update(dt);
            if (Input.pressed('shop')) GameShop.open();
        }
        if (typeof VoxFX !== 'undefined' && VoxFX.update) VoxFX.update(sdt, dt);
        if (Input.pressed('reset')) this.loadLevel(this.map.id);
    },

    /** Перейти на карту id: перезагрузка страницы с ?map= (мир, тела и память — с нуля). */
    loadLevel(id) {
        this.save.lastMap = id;
        this.persist();
        const u = new URL(location.href);
        u.searchParams.set('map', id);
        u.searchParams.set('go', '1');          // сразу карточка раунда, без титульного экрана
        location.href = u.toString();
    },

    frame(dt) {
        if (!this.ready_) return;
        const t0 = performance.now();
        this.stats.fps += ((dt > 0 ? 1 / dt : 60) - this.stats.fps) * 0.05;
        const cam = VoxRender.camera;
        this.player.applyCamera(cam);
        if (typeof GameAudio !== 'undefined' && GameAudio.setListener) {
            const d = this.player.dir(), l = Math.hypot(d.x, d.z) || 1;
            GameAudio.setListener(cam.position.x, cam.position.y, cam.position.z, d.x / l, d.z / l);
        }
        this._music();
        if (typeof GameShop !== 'undefined') GameShop.tickUi(dt);
        // подарок дня предлагается и на паузе (экран выбора карт ставит паузу)
        if (typeof GameRewards !== 'undefined') { GameRewards.tickUi(dt); GameRewards.update(dt); }
        VoxRender.updateDirty(7);
        VoxRender.update(dt);
        if (typeof GameHud !== 'undefined' && GameHud.update) GameHud.update(dt);
        VoxRender.render();
        this.stats.frameMs += ((performance.now() - t0) - this.stats.frameMs) * 0.1;
    },

    // ---- запасной обзор без захвата курсора ----
    // Где pointer lock запрещён (встроенные панели, часть iframe), Input переходит на ПКМ-драг.
    // Тогда камера крутится просто от движения мыши, а у края окна — продолжает поворот (видно курсор).
    _free: { x: 0.5, y: 0.5, dx: 0, dy: 0, inside: false, told: false },

    /**
     * YouTube Playables: межстраничная реклама на каждый клик по кнопке интерфейса — только вне игрового
     * процесса (меню, пауза, магазин, награды, выбор карты, экраны раунда). Клик ждёт конца рекламы и
     * повторяется сам, поэтому переходы с перезагрузкой карты не обрывают показ. Кнопки «за рекламу»
     * (rewarded) рекламу перед собой не получают.
     */
    _bindUiAds() {
        if (typeof Platform === 'undefined' || Platform.name !== 'playables') return;
        /** @type {Element | null} */
        let pass = null;
        let busy = false;
        document.addEventListener('click', ev => {
            const t = /** @type {HTMLElement} */ (ev.target);
            const btn = t && t.closest ? t.closest('button,[role="button"]') : null;
            if (!btn || btn.hasAttribute('disabled')) return;
            if (btn === pass) { pass = null; return; }
            if (btn.matches('.rl-sh-ad,.rl-gx2,.rl-wad') || Platform.adActive || this._inPlay()) return;
            ev.preventDefault();
            ev.stopImmediatePropagation();
            if (busy) return;
            busy = true;
            // окно могло перерисоваться за время рекламы — та же кнопка по своему классу и data-атрибутам
            let sel = btn.tagName.toLowerCase();
            const own = Array.from(btn.classList).filter(c => /^(rl|gh)-/.test(c) && c !== 'rl-btn' && c !== 'gh-btn').pop() || btn.classList[0];
            if (own) sel += '.' + CSS.escape(own);
            for (const at of Array.from(btn.attributes)) if (at.name.startsWith('data-')) sel += '[' + at.name + '="' + CSS.escape(at.value) + '"]';
            // переход по кнопке после двух раундов (Platform.ads.next) второй раз рекламу не просит
            if (Platform.ads) Platform.ads.results = 0;
            Promise.resolve(Platform.interstitial()).catch(() => false).then(() => {
                busy = false;
                const el = btn.isConnected ? btn : document.querySelector(sel);
                if (!el || el.hasAttribute('disabled')) return;
                pass = el;
                /** @type {HTMLElement} */ (el).click();
            });
        }, true);
    },

    /** Идёт игровой процесс: раунд или песочница без экранов и без паузы. */
    _inPlay() {
        if (typeof Pause !== 'undefined' && Pause.active) return false;
        const st = typeof GameScore !== 'undefined' ? GameScore.state : 'playing';
        return st === 'playing' || st === 'free';
    },

    _bindFreeLook() {
        const f = this._free;
        window.addEventListener('mousemove', e => {
            f.x = e.clientX / Math.max(1, window.innerWidth);
            f.y = e.clientY / Math.max(1, window.innerHeight);
            f.inside = true;
            if (!this._freeLookOn() || Input._dragHeld()) return;      // ПКМ-драг Input считает сам
            if (f.x < 0.5) return;                                     // левая половина — свободный курсор
            const k = 160;
            f.dx += Math.max(-k, Math.min(k, e.movementX || 0));
            f.dy += Math.max(-k, Math.min(k, e.movementY || 0));
        });
        document.addEventListener('mouseleave', () => { f.inside = false; });
        window.addEventListener('blur', () => { f.inside = false; f.dx = f.dy = 0; });
    },

    _freeLookOn() {
        const S = typeof GameScore !== 'undefined' ? /** @type {any} */ (GameScore) : null;
        return Input.lockFailed && !Input.locked && Input.device !== 'touch' && !Pause.active && !(S && S.active);
    },

    _freeLook(look, dt) {
        const f = this._free;
        if (!this._freeLookOn()) { f.dx = f.dy = 0; return; }
        if (!f.told && typeof GameHud !== 'undefined' && GameHud.toast) {
            f.told = true;
            GameHud.toast('rl.freelook');
            /** @type {any} */ (GameHud)._toastT = 7;
        }
        look.dx += f.dx; look.dy += f.dy;
        f.dx = f.dy = 0;
        // у края окна — поворот продолжается (курсор не может уйти дальше края)
        if (f.inside && !Input._dragHeld()) {
            const ex = f.x < 0.07 ? -(0.07 - f.x) / 0.07 : (f.x > 0.93 ? (f.x - 0.93) / 0.07 : 0);
            const ey = f.y < 0.06 ? -(0.06 - f.y) / 0.06 : (f.y > 0.94 ? (f.y - 0.94) / 0.06 : 0);
            look.dx += ex * 1100 * dt;
            look.dy += ey * 600 * dt;
        }
    },

    _musicKind: '',
    /** Музыка по состоянию: меню и карточки — menu, раунд — play, последние 30 с — tense, итоги — results. */
    _music() {
        const A = typeof GameAudio !== 'undefined' ? /** @type {any} */ (GameAudio) : null;
        if (!A || !A.music) return;
        const S = typeof GameScore !== 'undefined' ? /** @type {any} */ (GameScore) : null;
        const st = S ? S.state : 'free';
        let kind = 'play';
        if (st === 'results' || st === 'ending') kind = 'results';
        else if (st === 'idle' || st === 'intro' || st === 'levels') kind = 'menu';
        else if (st === 'playing' && S.timeLeft <= 30) kind = 'tense';
        else if (Pause.has('manual') && st !== 'playing') kind = 'menu';      // титульный экран
        if (kind !== this._musicKind) { this._musicKind = kind; A.music(kind); }
    },

    persist() { Platform.save(this.save); },
};
