// GameShop.js — магазин Rubble Lab: кошелёк (заработанный ущерб, $), открытия за деньги и/или за рекламу.
// Бесплатно всегда: кувалда, винтовка, дробовик, захват. Ракетомёт, бомба, огнемёт — за деньги или рекламу,
// спавнер — только за рекламу. Снаряды ракетомёта и виды бомб — отдельные товары (нужен сам инструмент).
// Карты: полигон и ферма открыты, остальные — за 2–7 просмотров рекламы или за деньги.
// Реклама — только Platform.rewarded (награда лишь по true); общая пауза между rewarded — REWARDED_COOLDOWN_SEC,
// подпись «Через N с» — Platform.rewardedCooldownLabel(). Сохранение — поле Game.save.shop.
// API: init(game), update(dt), owns(id), toolLocked(toolId), buy(id), watchAd(id), open(tab?), offer(id), close(),
//      variant('rocket' | 'bomb'), cycle(kind), variantName(toolId), money, active.

/**
 * Товары. price — $ (0 — не продаётся за деньги), ads — сколько просмотров рекламы (0 — нельзя за рекламу),
 * free — открыт сразу, needs — что должно быть открыто раньше.
 * @type {{ id: string, tab: string, price?: number, ads?: number, free?: boolean, exclusive?: boolean, pack?: boolean, needs?: string, ru: string, en: string, dru: string, den: string }[]}
 */
const SHOP_ITEMS = [
    { id: 'pack:arsenal', tab: 'tools', price: 0, ads: 16, pack: true, ru: 'Весь арсенал', en: 'Full arsenal', dru: 'Все инструменты, снаряды и бомбы сразу', den: 'Every tool, rocket and bomb at once' },
    { id: 'tool:launcher', tab: 'tools', price: 10000, ads: 1, ru: 'Ракетомёт', en: 'Rocket launcher', dru: 'Ракеты, взрыв при ударе', den: 'Rockets that explode on impact' },
    { id: 'tool:bomb', tab: 'tools', price: 20000, ads: 2, ru: 'Бомба', en: 'Bomb', dru: 'Бросок, взрыв по запалу', den: 'Throw it, it blows on a fuse' },
    { id: 'tool:torch', tab: 'tools', price: 25000, ads: 2, ru: 'Огнемёт', en: 'Flamethrower', dru: 'Поджигает дерево и листву', den: 'Sets wood and foliage on fire' },
    { id: 'mode:fly', tab: 'tools', price: 0, ads: 5, ru: 'Режим полёта', en: 'Fly mode', dru: 'Клавиша V: свободный полёт над картой', den: 'V key: fly freely over the map' },
    { id: 'tool:spawner', tab: 'tools', price: 0, ads: 4, ru: 'Спавнер', en: 'Spawner', dru: 'Ставит ящики, бочки, блоки', den: 'Spawns crates, barrels, blocks' },

    { id: 'rocket:normal', tab: 'rockets', free: true, needs: 'tool:launcher', ru: 'Обычный снаряд', en: 'Standard rocket', dru: 'Взрыв 2,4 м', den: '2.4 m blast' },
    { id: 'rocket:big', tab: 'rockets', price: 600000, ads: 5, needs: 'tool:launcher', ru: 'Большой снаряд', en: 'Heavy rocket', dru: 'Взрыв 3,8 м, медленнее', den: '3.8 m blast, slower' },
    { id: 'rocket:cluster', tab: 'rockets', price: 1500000, ads: 8, needs: 'tool:launcher', ru: 'Кластерный заряд', en: 'Cluster rocket', dru: 'Рассыпается на 8 зарядов', den: 'Splits into 8 bomblets' },
    { id: 'rocket:nuke', tab: 'rockets', price: 5000000, ads: 12, needs: 'tool:launcher', ru: 'Ядерный заряд', en: 'Nuclear rocket', dru: 'Сносит всё вокруг', den: 'Levels everything around' },

    { id: 'bomb:pipe', tab: 'bombs', free: true, needs: 'tool:bomb', ru: 'Трубчатая бомба', en: 'Pipe bomb', dru: 'Запал 2,6 с', den: '2.6 s fuse' },
    { id: 'bomb:sticky', tab: 'bombs', price: 300000, ads: 3, needs: 'tool:bomb', ru: 'Липкая бомба', en: 'Sticky bomb', dru: 'Прилипает к стене и телам', den: 'Sticks to walls and objects' },
    { id: 'bomb:fire', tab: 'bombs', price: 400000, ads: 4, needs: 'tool:bomb', ru: 'Зажигательная', en: 'Incendiary', dru: 'Огонь вокруг на 3 м', den: 'Fire spreads 3 m around' },
    { id: 'bomb:remote', tab: 'bombs', price: 500000, ads: 4, needs: 'tool:bomb', ru: 'Дистанционный заряд', en: 'Remote charge', dru: 'Взрыв по правой кнопке', den: 'Detonate with right click' },
    { id: 'bomb:cluster', tab: 'bombs', price: 900000, ads: 6, needs: 'tool:bomb', ru: 'Кассетная бомба', en: 'Cluster bomb', dru: 'Разбрасывает 6 зарядов', den: 'Scatters 6 bomblets' },
    { id: 'bomb:gold', tab: 'bombs', exclusive: true, needs: 'tool:bomb', ru: 'Золотая бомба', en: 'Golden bomb', dru: 'Взрыв 3,6 м, золотые искры', den: '3.6 m blast, golden sparks' },
    { id: 'rocket:gold', tab: 'rockets', exclusive: true, needs: 'tool:launcher', ru: 'Золотая ракета', en: 'Golden rocket', dru: 'Взрыв 3,2 м и пожар', den: '3.2 m blast and fire' },
    { id: 'bomb:demo', tab: 'bombs', price: 2000000, ads: 8, needs: 'tool:bomb', ru: 'Подрывной заряд', en: 'Demolition charge', dru: 'Взрыв 4,4 м, тяжёлый', den: '4.4 m blast, heavy' },

    { id: 'map:test-lab', tab: 'maps', free: true, ru: 'Полигон', en: 'Test lab', dru: 'Песочница', den: 'Sandbox' },
    { id: 'map:farm', tab: 'maps', free: true, ru: 'Ферма', en: 'Farm', dru: '', den: '' },
    { id: 'map:suburb', tab: 'maps', price: 300000, ads: 2, ru: 'Пригород', en: 'Suburb', dru: '', den: '' },
    { id: 'map:gas-station', tab: 'maps', price: 500000, ads: 3, ru: 'Заправка', en: 'Gas station', dru: '', den: '' },
    { id: 'map:construction', tab: 'maps', price: 700000, ads: 3, ru: 'Стройка', en: 'Construction site', dru: '', den: '' },
    { id: 'map:factory', tab: 'maps', price: 1000000, ads: 4, ru: 'Завод', en: 'Factory', dru: '', den: '' },
    { id: 'map:docks', tab: 'maps', price: 1300000, ads: 5, ru: 'Порт', en: 'Docks', dru: '', den: '' },
    { id: 'map:downtown', tab: 'maps', price: 1800000, ads: 6, ru: 'Центр города', en: 'Downtown', dru: '', den: '' },
    { id: 'map:village', tab: 'maps', price: 2200000, ads: 6, ru: 'Горная деревня', en: 'Mountain village', dru: '', den: '' },
    { id: 'map:desert', tab: 'maps', price: 2600000, ads: 7, ru: 'Пустыня', en: 'Desert outpost', dru: '', den: '' },
];
const SHOP_TABS = ['tools', 'rockets', 'bombs', 'maps'];

/** @satisfies {Record<string, any>} */
const GameShop = {
    /** @type {any} */
    game: null,
    /** @type {{ money: number, owned: Record<string, boolean>, ads: Record<string, number>, rocket: string, bomb: string }} */
    st: { money: 0, owned: {}, ads: {}, rocket: 'normal', bomb: 'pipe' },
    active: false,
    tab: 'tools',
    _busy: false,
    _all: false,
    _lastDamage: 0,
    _tick: 0,
    _focus: '',
    /** @type {HTMLElement | null} */
    _root: null,
    /** @type {((e: any) => void)[]} */
    _ls: [],

    on(fn) { this._ls.push(fn); },
    _emit(e) { for (const fn of this._ls) { try { fn(e); } catch (err) { console.warn(err); } } },

    init(game) {
        this.game = game;
        const s = game.save.shop = game.save.shop || {};
        s.money = +s.money || 0; s.owned = s.owned || {}; s.ads = s.ads || {};
        s.rocket = s.rocket || 'normal'; s.bomb = s.bomb || 'pipe';
        this.st = /** @type {any} */ (s);
        this._all = new URLSearchParams(location.search).get('unlock') === '1';
        this._lastDamage = this._damage();
        this._css();
    },

    item(id) { return SHOP_ITEMS.find(i => i.id === id) || null; },
    /** Товары набора «Весь арсенал». */
    packItems() { return SHOP_ITEMS.filter(i => !i.free && !i.exclusive && !i.pack && /^(tool|rocket|bomb):/.test(i.id)); },
    name(it) { if (typeof it === 'string') it = this.item(it); return it ? (Lang.code === 'en' ? it.en : it.ru) : ''; },

    // ---- приёмник наград DailyGift / Wheel (1 «монета» модулей = $100) ----
    addCoins(n) { this.st.money += Math.max(0, n) * 100; if (this.game) this.game.persist(); return true; },
    grant(id) { if (!this.item(id) || this.owns(id)) return false; this._grant(id); return true; },
    isExclusive(id) { const it = this.item(id); return !!(it && it.exclusive); },
    /** Случайное закрытое открытие (не эксклюзив; нужное для него уже открыто). */
    randomItem(o) {
        const rng = (o && o.rng) || Math.random;
        const pool = SHOP_ITEMS.filter(i => !i.free && !i.exclusive && !this.owns(i.id) && (!i.needs || this.owns(i.needs)));
        return pool.length ? pool[Math.floor(rng() * pool.length) % pool.length].id : null;
    },
    get money() { return this.st.money; },

    /** Открыт ли товар (или нет такого товара — тогда бесплатный). */
    owns(id) {
        const it = this.item(id);
        if (it && it.pack) return this._all || !!this.st.owned[id] || this.packItems().every(i => !!this.st.owned[i.id]);
        if (!it || it.free || this._all) return !it || !it.needs || this.owns(it.needs) || this._all;
        return !!this.st.owned[id];
    },
    toolLocked(tool) { const it = this.item('tool:' + tool); return !!it && !this.found[it.id] && !this.owns(it.id); },
    /** Найдено на уровне (Playables): инструмент открыт до конца уровня, в магазине не покупается. @type {Record<string, boolean>} */
    found: {},

    /** Текущий вид снаряда / бомбы (открытый). */
    variant(kind) {
        const v = kind === 'rocket' ? this.st.rocket : this.st.bomb;
        return this.owns(kind + ':' + v) ? v : (kind === 'rocket' ? 'normal' : 'pipe');
    },
    variantName(tool) {
        const kind = tool === 'launcher' ? 'rocket' : 'bomb';
        return this.name(this.item(kind + ':' + this.variant(kind)));
    },
    /** Следующий открытый вид. */
    cycle(kind) {
        const list = SHOP_ITEMS.filter(i => i.id.startsWith(kind + ':') && this.owns(i.id)).map(i => i.id.split(':')[1]);
        if (list.length < 2) { if (SHOP_ITEMS.some(i => i.id.startsWith(kind + ':') && !this.owns(i.id))) this.open(kind === 'rocket' ? 'rockets' : 'bombs'); return; }
        const cur = this.variant(kind);
        const next = list[(list.indexOf(cur) + 1) % list.length];
        if (kind === 'rocket') this.st.rocket = next; else this.st.bomb = next;
        this.game.persist();
        if (typeof GameAudio !== 'undefined') GameAudio.ui('toggle');
        if (typeof GameHud !== 'undefined' && GameHud.toast) GameHud.toast('rls.picked', { n: this.name(this.item(kind + ':' + next)) });
    },

    /** Купить за деньги. */
    buy(id) {
        const it = this.item(id);
        if (!it || this.owns(id) || !it.price || this.st.money < it.price || (it.needs && !this.owns(it.needs))) return false;
        this.st.money -= it.price;
        this._grant(id);
        return true;
    },

    /** Просмотр рекламы засчитывается только по подтверждению площадки. */
    async watchAd(id) {
        const it = this.item(id);
        if (!it || this.owns(id) || !it.ads || this._busy || (it.needs && !this.owns(it.needs))) return false;
        if (!Platform.rewardedSupported() || !Platform.rewardedReady()) return false;
        this._busy = true;
        this._render();
        let ok = false;
        try { ok = await Platform.rewarded('shop-' + id); } catch (e) { ok = false; }
        this._busy = false;
        if (ok) {
            this.st.ads[id] = (this.st.ads[id] || 0) + 1;
            if (this.st.ads[id] >= it.ads) this._grant(id);
            else { this.game.persist(); if (typeof GameAudio !== 'undefined') GameAudio.ui('click'); }
        }
        this._render();
        return ok;
    },

    _grant(id) {
        this.st.owned[id] = true;
        const pk = this.item(id);
        if (pk && pk.pack) for (const i of this.packItems()) this.st.owned[i.id] = true;
        const [kind, v] = id.split(':');
        if (kind === 'rocket') this.st.rocket = v;
        if (kind === 'bomb') this.st.bomb = v;
        this.game.persist();
        if (typeof GameAudio !== 'undefined') GameAudio.ui('select');
        if (typeof GameHud !== 'undefined' && GameHud.toast) GameHud.toast('rls.unlocked', { n: this.name(this.item(id)) });
        this._emit({ type: 'unlock', id });
        this._render();
    },

    _damage() { return typeof GameScore !== 'undefined' && /** @type {any} */ (GameScore).damage ? /** @type {any} */ (GameScore).damage : 0; },

    update(dt) {
        // заработок: прирост ущерба раунда идёт в кошелёк (новый раунд обнуляет счётчик — не вычитаем)
        const d = this._damage();
        if (d > this._lastDamage) { this.st.money += d - this._lastDamage; this._dirtyMoney = true; }
        this._lastDamage = d;
        this._tick += dt;
        if (this._tick > 1) {
            this._tick = 0;
            if (this._dirtyMoney) { this._dirtyMoney = false; this.game.persist(); }
        }
        this._lockSlots();
    },
    _uiT: 0,
    /** Каждый кадр, и на паузе: окно магазина перерисовывает «Через N с» раз в секунду. */
    tickUi(dt) {
        if (!this.active) return;
        this._uiT += dt;
        if (this._uiT > 0.5) { this._uiT = 0; this._render(); }
    },
    _dirtyMoney: false,

    /** Замки на ячейках панели инструментов. */
    _lockSlots() {
        if (typeof GameTools === 'undefined') return;
        GameTools.list.forEach((t, i) => {
            const el = document.getElementById('gh-slot-' + i);
            if (el) el.classList.toggle('rl-locked', this.toolLocked(t.id));
        });
    },

    // ------------------------------------------------------------------ интерфейс

    open(tab) {
        if (tab) this.tab = tab;
        this.active = true;
        Pause.set('manual', true);
        try { Input.release(); } catch (e) { /* нет захвата */ }
        if (!this._root) {
            const r = this._root = document.createElement('div');
            r.id = 'rl-shop';
            r.addEventListener('click', ev => this._onClick(ev));
            document.body.appendChild(r);
        }
        this._root.hidden = false;
        this._render();
        if (typeof GameAudio !== 'undefined') GameAudio.ui('click');
    },
    /** Открыть магазин на товаре (замок на инструменте, снаряде, карте). */
    offer(id) {
        const it = this.item(id);
        this._focus = id;
        this.open(it ? it.tab : this.tab);
    },
    close() {
        if (!this._root || !this.active) return;
        this.active = false;
        this._root.hidden = true;
        this._focus = '';
        const S = typeof GameScore !== 'undefined' ? /** @type {any} */ (GameScore) : null;
        const rw = typeof GameRewards !== 'undefined' && GameRewards.active;
        if (!(S && S.active) && !rw && !(typeof GameHud !== 'undefined' && /** @type {any} */ (GameHud).mode === 'pause')) {
            Pause.set('manual', false);
            try { Input.capture(); } catch (e) { /* без захвата */ }
        }
        if (S && S.state === 'levels' && S.openLevels) S.openLevels();   // карты могли открыться — перерисовать
    },

    // неразрывные пробелы: цена не переносится посреди числа
    _fmt(n) { return '$ ' + String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); },

    _render() {
        const r = this._root;
        if (!r || !this.active) return;
        const T = (k, p) => Lang.t(k, p);
        const en = Lang.code === 'en';
        const tabs = SHOP_TABS.map(t => '<button type="button" class="rl-sh-tab' + (t === this.tab ? ' on' : '') + '" data-tab="' + t + '">' + T('rls.tab.' + t) + '</button>').join('');
        const adsOk = Platform.rewardedSupported();
        const cd = Platform.rewardedCooldownLeft();
        let cards = '';
        for (const it of SHOP_ITEMS.filter(i => i.tab === this.tab)) {
            const own = this.owns(it.id);
            const need = it.needs && !this.owns(it.needs);
            const [kind, v] = it.id.split(':');
            const picked = own && ((kind === 'rocket' && this.variant('rocket') === v) || (kind === 'bomb' && this.variant('bomb') === v));
            let act = '';
            if (own) {
                if (kind === 'rocket' || kind === 'bomb') act = picked ? '<span class="rl-sh-on">' + T('rls.picked0') + '</span>' : '<button type="button" class="gh-btn alt rl-sh-pick" data-pick="' + it.id + '">' + T('rls.pick') + '</button>';
                else act = '<span class="rl-sh-on">' + T('rls.owned') + '</span>';
            } else if (it.exclusive) {
                act = '<span class="rl-sh-need">' + T('rls.exclusive') + '</span>';
            } else if (need) {
                act = '<span class="rl-sh-need">' + T('rls.needs', { n: this.name(this.item(it.needs)) }) + '</span>';
            } else {
                if (it.price) act += '<button type="button" class="gh-btn rl-sh-buy" data-buy="' + it.id + '"' + (this.st.money >= it.price ? '' : ' disabled') + '>' + T('rls.buy', { p: this._fmt(it.price) }) + '</button>';
                if (it.ads && adsOk) {
                    const n = this.st.ads[it.id] || 0;
                    const lbl = this._busy ? T('rls.wait') : (cd > 0 ? Platform.rewardedCooldownLabel() : T('rls.ad', { n, m: it.ads }));
                    act += '<button type="button" class="gh-btn alt rl-sh-ad" data-ad="' + it.id + '"' + (this._busy || cd > 0 ? ' disabled' : '') + '>' + lbl + '</button>';
                }
                if (!act) act = '<span class="rl-sh-need">' + T('rls.noads') + '</span>';
            }
            const desc = en ? it.den : it.dru;
            cards += '<div class="rl-sh-card' + (own ? ' own' : '') + (it.pack ? ' pack' : '') + (this._focus === it.id ? ' focus' : '') + '"><div class="rl-sh-name">' + this.name(it) + '</div>' +
                (desc ? '<div class="rl-sh-desc">' + desc + '</div>' : '') + '<div class="rl-sh-act">' + act + '</div></div>';
        }
        const html = '<div class="rl-sh-win gh-plate"><div class="rl-sh-head"><h2>' + T('rls.title') + '</h2><span class="rl-sh-money">' + this._fmt(this.st.money) + '</span>' +
            (typeof GameRewards !== 'undefined' ? '<button type="button" class="gh-btn alt rl-sh-daily">' + T('rlr.daily') + '</button><button type="button" class="gh-btn alt rl-sh-wheel">' + T('rlr.wheel') + '</button>' : '') +
            '<button type="button" class="gh-btn alt rl-sh-close">' + T('rls.close') + '</button></div><div class="rl-sh-tabs">' + tabs + '</div>' +
            '<div class="rl-sh-grid">' + cards + '</div><div class="rl-sh-note">' + T('rls.note') + '</div></div>';
        // перерисовка раз в 0.5 с (деньги, «Через N с»): без изменений — не трогать, иначе сохранить прокрутку карточек
        if (html === this._html && r.firstChild) return;
        const g = r.querySelector('.rl-sh-grid'), top = g && this._htmlTab === this.tab ? g.scrollTop : 0;
        r.innerHTML = html;
        this._html = html; this._htmlTab = this.tab;
        const g2 = r.querySelector('.rl-sh-grid');
        if (g2 && top) g2.scrollTop = top;
    },
    _html: '',
    _htmlTab: '',

    _onClick(ev) {
        const t = /** @type {HTMLElement} */ (ev.target);
        const b = /** @type {HTMLElement | null} */ (t.closest('button'));
        if (!b || b.hasAttribute('disabled')) { if (t === this._root) this.close(); return; }
        if (b.classList.contains('rl-sh-close')) { this.close(); return; }
        if (b.classList.contains('rl-sh-daily') && typeof GameRewards !== 'undefined') { GameRewards.openDaily(); return; }
        if (b.classList.contains('rl-sh-wheel') && typeof GameRewards !== 'undefined') { GameRewards.openWheel(); return; }
        const tab = b.getAttribute('data-tab');
        if (tab) { this.tab = tab; this._focus = ''; this._render(); if (typeof GameAudio !== 'undefined') GameAudio.ui('click'); return; }
        const buy = b.getAttribute('data-buy');
        if (buy) { this.buy(buy); return; }
        const ad = b.getAttribute('data-ad');
        if (ad) { this.watchAd(ad); return; }
        const pick = b.getAttribute('data-pick');
        if (pick) {
            const [kind, v] = pick.split(':');
            if (kind === 'rocket') this.st.rocket = v; else this.st.bomb = v;
            this.game.persist();
            if (typeof GameAudio !== 'undefined') GameAudio.ui('toggle');
            this._render();
        }
    },

    _css() {
        if (document.getElementById('rl-shop-css')) return;
        const s = document.createElement('style');
        s.id = 'rl-shop-css';
        s.textContent = `
#rl-shop{position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;background:rgba(10,11,13,.72);padding:12px;box-sizing:border-box;font-family:var(--gh-font,system-ui)}
#rl-shop[hidden]{display:none}
.rl-sh-win{width:min(980px,100%);max-height:100%;display:flex;flex-direction:column;gap:10px;padding:14px;box-sizing:border-box;background:var(--gh-char,#1c1e22);color:var(--gh-paper,#f2efe6);border-radius:6px;overflow:hidden}
.rl-sh-head{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap}
@media (max-width:720px){.rl-sh-head .gh-btn{flex:1 1 30%;min-width:0;min-height:38px;padding:0 8px;font-size:13px;letter-spacing:.03em}}
.rl-sh-head h2{margin:0;font:900 clamp(20px,3.4vh,30px)/1 var(--gh-font,system-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--gh-yel,#ffc61a)}
.rl-sh-money{margin-left:auto;font:900 clamp(16px,2.6vh,22px)/1 var(--gh-font,system-ui);color:var(--gh-yel,#ffc61a)}
.rl-sh-tabs{display:flex;gap:6px;flex-wrap:wrap}
.rl-sh-tab{appearance:none;border:0;padding:8px 14px;border-radius:4px;background:#2c3036;color:var(--gh-paper,#f2efe6);font:800 13px/1 var(--gh-font,system-ui);letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.rl-sh-tab.on{background:var(--gh-yel,#ffc61a);color:var(--gh-ink,#15161a)}
.rl-sh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;overflow:auto;padding:2px}
.rl-sh-card{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:4px;background:#25282d;box-shadow:inset 0 0 0 2px #3b4048}
.rl-sh-card.own{box-shadow:inset 0 0 0 2px #4d7a3f}
.rl-sh-card.pack{grid-column:1/-1;background:linear-gradient(120deg,#3a2f10,#25282d 60%);box-shadow:inset 0 0 0 3px var(--gh-yel,#ffc61a)}
.rl-sh-card.pack .rl-sh-name{font-size:20px;color:var(--gh-yel,#ffc61a)}
.rl-sh-card.pack .rl-sh-act{flex-direction:row;flex-wrap:wrap}
.rl-sh-card.pack .rl-sh-act .gh-btn{width:auto;flex:1 1 240px}
.rl-sh-card.focus{box-shadow:inset 0 0 0 3px var(--gh-yel,#ffc61a)}
.rl-sh-name{font:900 16px/1.1 var(--gh-font,system-ui);text-transform:uppercase;letter-spacing:.04em}
.rl-sh-desc{font:600 12px/1.3 var(--gh-font,system-ui);color:#b7bdc6}
.rl-sh-act{margin-top:auto;display:flex;flex-direction:column;gap:6px}
.rl-sh-act .gh-btn{width:100%;min-height:38px}
.rl-sh-on{font:800 12px/1 var(--gh-font,system-ui);letter-spacing:.1em;text-transform:uppercase;color:#8fd178}
.rl-sh-need{font:700 12px/1.25 var(--gh-font,system-ui);color:#b7bdc6}
.rl-sh-note{font:600 11px/1.3 var(--gh-font,system-ui);color:#8e959e}
.gh-slot.rl-locked .gh-ico{opacity:.35}
.gh-slot.rl-locked::after{content:'';position:absolute;right:4px;top:4px;width:12px;height:12px;background:no-repeat center/contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ffc61a' d='M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3z'/%3E%3C/svg%3E")}
`;
        document.head.appendChild(s);
    },
};
