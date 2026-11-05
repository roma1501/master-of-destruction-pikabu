// GameRewards.js — ежедневный подарок и колесо фортуны Rubble Lab: логика — модули движка DailyGift.js и
// Wheel.js, приёмник наград — GameShop (кошелёк и открытия; 1 «монета» модулей = $100), окна — здесь.
// Подарок: 7 дней, «x2 за рекламу», день 7 — эксклюзив (золотая бомба, затем золотая ракета; их нет в
// магазине и на колесе). Колесо: бесплатно раз в день + вращения за рекламу (WHEEL_AD_SPINS_PER_DAY).
// Подарок предлагается сам на экране выбора карт (не поверх обучения и игры).
// API: init(game), update(dt), tickUi(dt), openDaily(), openWheel(), close(), active.

/** Награды дней 1–6 (монеты модуля: × $100), по нарастающей. */
const GR_DAILY = [{ coins: 50 }, { coins: 80 }, { coins: 120, randomItems: 1 }, { coins: 180 }, { coins: 260 }, { coins: 400, randomItems: 1 }];
/** Эксклюзивы дня 7 — по очереди. */
const GR_EXCLUSIVE = ['bomb:gold', 'rocket:gold'];
/** Секторы колеса: в основном деньги, реже случайное открытие из магазина. */
const GR_WHEEL = [
    { coins: 30, weight: 22 }, { coins: 60, weight: 18 }, { randomItem: true, weight: 9 }, { coins: 120, weight: 12 },
    { coins: 250, weight: 6 }, { randomItem: true, weight: 5 }, { coins: 500, weight: 3 }, { coins: 1500, weight: 1 },
];

/** @satisfies {Record<string, any>} */
const GameRewards = {
    /** @type {any} */
    game: null,
    active: false,
    mode: '',
    angle: 0,
    spinning: false,
    _offered: false,
    _uiT: 0,
    /** @type {HTMLElement | null} */
    _root: null,

    init(game) {
        this.game = game;
        if (typeof GameShop === 'undefined' || typeof DailyGift === 'undefined' || typeof Wheel === 'undefined') return;
        const save = game.save, persist = () => game.persist();
        DailyGift.init({ rewards: GR_DAILY, exclusive: GR_EXCLUSIVE, rewardsSink: GameShop, state: save.daily, persist });
        save.daily = DailyGift.state;
        Wheel.init({ sectors: GR_WHEEL, rewardsSink: GameShop, state: save.wheel, persist });
        save.wheel = Wheel.state;
        Wheel.on(e => { if (e.type === 'prize' && e.recovered && typeof GameHud !== 'undefined') GameHud.toast('rlr.won', { p: this._prize(e.prize) }); });
        this._css();
    },

    update(dt) {
        // подарок дня — сам, на экране выбора карт, не поверх обучения
        if (this._offered || this.active || typeof DailyGift === 'undefined' || !DailyGift.state) return;
        const S = typeof GameScore !== 'undefined' ? /** @type {any} */ (GameScore) : null;
        if (S && S.state === 'levels' && DailyGift.shouldOffer()) {
            this._offered = true;
            DailyGift.markOffered();
            this.openDaily();
        }
    },
    /** Каждый кадр, и на паузе: таймеры «Через N с» и «Бесплатно через …». */
    tickUi(dt) {
        if (!this.active || this.spinning) return;
        this._uiT += dt;
        if (this._uiT > 0.5) { this._uiT = 0; this._render(); }
    },

    openDaily() { this._open('daily'); },
    openWheel() { this._open('wheel'); },

    _open(mode) {
        if (typeof DailyGift === 'undefined' || !DailyGift.state) return;
        this.mode = mode;
        this.active = true;
        Pause.set('manual', true);
        try { Input.release(); } catch (e) { /* нет захвата */ }
        if (!this._root) {
            const r = this._root = document.createElement('div');
            r.id = 'rl-rewards';
            r.addEventListener('click', ev => this._onClick(ev));
            document.body.appendChild(r);
        }
        this._root.hidden = false;
        this._render();
        if (typeof GameAudio !== 'undefined') GameAudio.ui('click');
    },

    close() {
        if (!this._root || !this.active || this.spinning) return;
        this.active = false;
        this._root.hidden = true;
        const S = typeof GameScore !== 'undefined' ? /** @type {any} */ (GameScore) : null;
        const shopOpen = typeof GameShop !== 'undefined' && GameShop.active;
        if (!(S && S.active) && !shopOpen && !(typeof GameHud !== 'undefined' && /** @type {any} */ (GameHud).mode === 'pause')) {
            Pause.set('manual', false);
            try { Input.capture(); } catch (e) { /* без захвата */ }
        }
        if (shopOpen) GameShop._render();
    },

    /** $ по «монетам» модулей (× 100), неразрывные пробелы. */
    _usd(coins) { return '$\u00a0' + String(Math.round(coins * 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); },
    /** Подпись награды дня (mult — x2). */
    _label(rw, mult = 1) {
        if (!rw) return '';
        const T = (k, p) => Lang.t(k, p), parts = [];
        if (rw.exclusive) parts.push(T('rlr.exclusive', { name: GameShop.name(rw.exclusive) }));
        if (rw.coins > 0) parts.push(rw.big ? T('rlr.big', { p: this._usd(rw.coins * mult) }) : this._usd(rw.coins * mult));
        if (rw.item) parts.push(T('rlr.item', { name: GameShop.name(rw.item) }));
        if (rw.randomItems > 0) { const n = rw.randomItems * mult; parts.push(n === 1 ? T('rlr.random') : T('rlr.randoms', { n })); }
        return parts.join(' + ');
    },
    /** Подпись приза колеса. */
    _prize(pz) {
        if (!pz) return '';
        if (pz.type === 'item') return Lang.t('rlr.item', { name: GameShop.name(pz.id) });
        return pz.converted ? Lang.t('rlr.dup', { p: this._usd(pz.amount) }) : this._usd(pz.amount);
    },

    _esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },

    _render() {
        const r = this._root;
        if (!r || !this.active) return;
        const T = (k, p) => Lang.t(k, p);
        let body = '';
        if (this.mode === 'daily') {
            const v = DailyGift.view();
            const days = v.days.map(d => '<div class="rl-gd ' + d.state + (d.exclusive ? ' ex' : '') + '"><div class="rl-gd-n">' + this._esc(d.dayLabel) + '</div>' +
                '<div class="rl-gd-r">' + this._esc(this._label(d.reward)) + '</div><div class="rl-gd-s">' + this._esc(d.stateLabel) + '</div></div>').join('');
            const x2 = v.x2.available && Platform.rewardedSupported()
                ? '<button type="button" class="gh-btn alt rl-gx2"' + (v.x2.enabled ? '' : ' disabled') + '>' + this._esc(v.x2.label) + (v.x2.available ? ' · ' + this._esc(this._label((v.days.find(d => d.state === 'today') || {}).reward, 2)) : '') + '</button>' : '';
            body = '<h2>' + T('rlr.daily') + '</h2><div class="rl-gdays">' + days + '</div><div class="rl-gact">' +
                '<button type="button" class="gh-btn rl-gclaim"' + (v.claim.enabled ? '' : ' disabled') + '>' + this._esc(v.claim.label) + '</button>' + x2 + '</div>' +
                '<div class="rl-ghint">' + this._esc((v.days.some(d => d.state === 'today' && d.exclusive) ? T('rlr.noX2') : v.x2.hint) || v.nextLabel || '') + '</div>';
        } else {
            const st = Wheel.status(), secs = Wheel.sectors();
            const n = secs.length, step = 360 / n;
            let paths = '', labels = '';
            secs.forEach((s, i) => {
                const a0 = (i * step - step / 2 - 90) * Math.PI / 180, a1 = (i * step + step / 2 - 90) * Math.PI / 180;
                const x0 = 100 + 96 * Math.cos(a0), y0 = 100 + 96 * Math.sin(a0), x1 = 100 + 96 * Math.cos(a1), y1 = 100 + 96 * Math.sin(a1);
                paths += '<path d="M100 100 L' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A96 96 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' Z" fill="' + (i % 2 ? '#25282d' : '#ffc61a') + '" stroke="#15161a" stroke-width="1.5"/>';
                const lbl = s.kind === 'coins' ? '$' + (s.coins * 100 >= 1000 ? Math.round(s.coins * 100 / 1000) + 'K' : s.coins * 100) : '?';
                labels += '<text x="100" y="30" transform="rotate(' + (i * step) + ' 100 100)" text-anchor="middle" fill="' + (i % 2 ? '#ffc61a' : '#15161a') + '" font-size="15" font-weight="900">' + lbl + '</text>';
            });
            const list = secs.map(s => '<li>' + this._esc(this._prize(s.prize)) + ' <b>' + s.chance.toFixed(0) + '%</b></li>').join('');
            body = '<h2>' + T('rlr.wheel') + '</h2><div class="rl-wrow"><div class="rl-wbox"><div class="rl-wptr"></div>' +
                '<svg class="rl-wdisk" viewBox="0 0 200 200" style="transform:rotate(' + this.angle + 'deg)">' + paths + labels + '<circle cx="100" cy="100" r="14" fill="#15161a" stroke="#ffc61a" stroke-width="3"/></svg></div>' +
                '<ul class="rl-wlist">' + list + '</ul></div><div class="rl-gact">' +
                '<button type="button" class="gh-btn rl-wfree"' + (st.canSpinFree && !this.spinning ? '' : ' disabled') + '>' + this._esc(st.freeLabel) + '</button>' +
                (Platform.rewardedSupported() ? '<button type="button" class="gh-btn alt rl-wad"' + (st.canSpinAd && !st.canSpinFree && !this.spinning ? '' : ' disabled') + '>' + this._esc(st.adLabel) + '</button>' : '') +
                '</div><div class="rl-ghint">' + this._esc(st.hint || '') + '</div>';
        }
        const tabs = '<div class="rl-gtabs"><button type="button" class="rl-sh-tab' + (this.mode === 'daily' ? ' on' : '') + '" data-mode="daily">' + T('rlr.daily') + '</button>' +
            '<button type="button" class="rl-sh-tab' + (this.mode === 'wheel' ? ' on' : '') + '" data-mode="wheel">' + T('rlr.wheel') + '</button>' +
            '<button type="button" class="gh-btn alt rl-gclose"' + (this.spinning ? ' disabled' : '') + '>' + T('rlr.close') + '</button></div>';
        const html = '<div class="rl-gwin gh-plate">' + tabs + body + '</div>';
        // перерисовка раз в 0.5 с: без изменений — не трогать, иначе сохранить прокрутку окна
        if (html === this._html && r.firstChild) return;
        const w = r.querySelector('.rl-gwin'), top = w && this._htmlMode === this.mode ? w.scrollTop : 0;
        r.innerHTML = html;
        this._html = html; this._htmlMode = this.mode;
        const w2 = r.querySelector('.rl-gwin');
        if (w2 && top) w2.scrollTop = top;
    },
    _html: '',
    _htmlMode: '',

    async _onClick(ev) {
        const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (ev.target).closest('button'));
        if (!b || b.hasAttribute('disabled')) { if (ev.target === this._root) this.close(); return; }
        const mode = b.getAttribute('data-mode');
        if (mode) { this.mode = mode; this._render(); return; }
        if (b.classList.contains('rl-gclose')) { this.close(); return; }
        if (b.classList.contains('rl-gclaim')) {
            const res = DailyGift.claim();
            if (res && res.ok) this._gotToast(res);
            this._render();
            return;
        }
        if (b.classList.contains('rl-gx2')) {
            b.setAttribute('disabled', '');
            const res = await DailyGift.claimX2();
            if (res && res.ok) this._gotToast(res);
            this._render();
            return;
        }
        if (b.classList.contains('rl-wfree')) { this._spin(Wheel.spinFree()); return; }
        if (b.classList.contains('rl-wad')) { b.setAttribute('disabled', ''); this._spin(await Wheel.spinAd()); }
    },

    _gotToast(res) {
        if (typeof GameAudio !== 'undefined') GameAudio.ui('select');
        const day = res.day && DailyGift.view().days[res.day - 1];
        if (day && typeof GameHud !== 'undefined') GameHud.toast('rlr.got', { p: this._label(day.reward, res.mult > 1 ? res.mult : 1) });
    },

    _spin(res) {
        if (!res || !res.ok) { this._render(); return; }
        this.spinning = true;
        // диск рисуется в прежнем положении и плавно доворачивается до выпавшего сектора (угол — от модуля)
        const target = Wheel.angleFrom(this.angle, res);
        const ms = res.durationMs || 4200;
        this._render();
        this.angle = target;
        const disk = /** @type {SVGElement | null} */ (this._root.querySelector('.rl-wdisk'));
        if (disk) {
            void disk.getBoundingClientRect();
            disk.style.transition = 'transform ' + ms + 'ms cubic-bezier(.12,.7,.08,1)';
            disk.style.transform = 'rotate(' + target + 'deg)';
        }
        if (typeof GameAudio !== 'undefined') GameAudio.ui('toggle');
        setTimeout(() => {
            const out = Wheel.finish();
            this.spinning = false;
            const prize = res.prize || (out && out.prize);
            if (prize && typeof GameHud !== 'undefined') GameHud.toast('rlr.won', { p: this._prize(prize) });
            if (typeof GameAudio !== 'undefined') GameAudio.ui('select');
            this._render();
        }, ms + 80);
    },

    _css() {
        if (document.getElementById('rl-rewards-css')) return;
        const s = document.createElement('style');
        s.id = 'rl-rewards-css';
        s.textContent = `
#rl-rewards{position:fixed;inset:0;z-index:910;display:flex;align-items:center;justify-content:center;background:rgba(10,11,13,.72);padding:12px;box-sizing:border-box;font-family:var(--gh-font,system-ui)}
#rl-rewards[hidden]{display:none}
.rl-gwin{width:min(860px,100%);max-height:100%;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:14px;box-sizing:border-box;background:var(--gh-char,#1c1e22);color:var(--gh-paper,#f2efe6);border-radius:6px}
.rl-gwin h2{margin:0;font:900 clamp(20px,3.4vh,28px)/1 var(--gh-font,system-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--gh-yel,#ffc61a)}
.rl-gtabs{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
@media (max-width:560px){.rl-gtabs .rl-sh-tab{flex:1 1 40%}.rl-gtabs .rl-gclose{flex:1 1 100%;margin-left:0;min-height:38px}}
.rl-gtabs .rl-gclose{margin-left:auto}
.rl-gdays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.rl-gd{display:flex;flex-direction:column;gap:4px;padding:8px 6px;border-radius:4px;background:#25282d;box-shadow:inset 0 0 0 2px #3b4048;min-height:92px}
.rl-gd.today{box-shadow:inset 0 0 0 3px var(--gh-yel,#ffc61a)}
.rl-gd.claimed{opacity:.55}
.rl-gd.ex{background:linear-gradient(160deg,#3a2f10,#25282d)}
.rl-gd-n{font:900 13px/1 var(--gh-font,system-ui);text-transform:uppercase;color:var(--gh-yel,#ffc61a)}
.rl-gd-r{font:700 12px/1.25 var(--gh-font,system-ui)}
.rl-gd-s{margin-top:auto;font:800 10px/1 var(--gh-font,system-ui);letter-spacing:.1em;text-transform:uppercase;color:#8fd178}
.rl-gact{display:flex;gap:8px;flex-wrap:wrap}
.rl-gact .gh-btn{flex:1 1 220px;min-height:42px}
.rl-ghint{min-height:1.2em;font:600 12px/1.3 var(--gh-font,system-ui);color:#b7bdc6}
.rl-wrow{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.rl-wbox{position:relative;width:min(300px,70vw);aspect-ratio:1}
.rl-wdisk{width:100%;height:100%;display:block}
.rl-wptr{position:absolute;left:50%;top:-6px;width:0;height:0;margin-left:-12px;border-left:12px solid transparent;border-right:12px solid transparent;border-top:22px solid #f2efe6;z-index:1;filter:drop-shadow(0 2px 0 #000)}
.rl-wlist{margin:0;padding-left:18px;font:600 13px/1.5 var(--gh-font,system-ui);flex:1 1 220px}
.rl-wlist b{color:var(--gh-yel,#ffc61a)}
@media (max-width:560px){.rl-gdays{grid-template-columns:repeat(4,minmax(0,1fr))}}
`;
        document.head.appendChild(s);
    },
};
