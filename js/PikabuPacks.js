// @ts-nocheck
// PikabuPacks.js — наборы за рубли в сборке Пикабу Игр (js/PikabuShop.js). Цены и названия товаров — в Студии
// (каталог CSV: coins_s 19 ₽, coins_m 49 ₽, coins_l 99 ₽, starter 29 ₽, no_ads 59 ₽), здесь — что игрок получает.
// Деньги — GameShop.st.money ($), открытия набора — режим полёта и спавнер (иначе только за рекламу).
const PIKABU_ADD_MONEY = (n) => { GameShop.st.money += n; Game.persist(); };
PikabuShop.setup({
    colors: ['#ff8f00', '#d84315'],
    ready: () => !!(typeof GameShop !== 'undefined' && GameShop.st && typeof Game !== 'undefined' && Game.save),
    visible: () => !GameShop.active && !document.pointerLockElement,
    persist: () => Game.persist(),
    button: { corner: 'tr', x: 12, y: 74 },
    packs: [
        { id: 'coins_s', type: 'consumable', icon: '💵', name: 'Пачка денег', desc: '$250 000 на снаряды и бомбы', grant: () => PIKABU_ADD_MONEY(250000) },
        { id: 'coins_m', type: 'consumable', icon: '💰', name: 'Мешок денег', desc: '$1 000 000', grant: () => PIKABU_ADD_MONEY(1000000) },
        { id: 'coins_l', type: 'consumable', icon: '🏦', name: 'Сейф с деньгами', desc: '$3 000 000 — почти весь арсенал', best: true, grant: () => PIKABU_ADD_MONEY(3000000) },
        {
            id: 'starter', type: 'non_consumable', icon: '🛩️', name: 'Набор испытателя', best: 'Один раз',
            desc: '$300 000, режим полёта и спавнер ящиков и бочек',
            grant: () => PIKABU_ADD_MONEY(300000),
            apply: () => ['mode:fly', 'tool:spawner'].forEach((id) => { if (!GameShop.owns(id)) GameShop.grant(id); }),
        },
        { id: 'no_ads', type: 'non_consumable', icon: '🚫', name: 'Без рекламы', desc: 'Убирает межстраничную рекламу навсегда. Награды за рекламу остаются', noAds: true },
    ],
});
