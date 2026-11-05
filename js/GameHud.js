// GameHud.js — интерфейс Rubble Lab: экран «Играть», HUD (прицел, панель инструментов, подсказки, тосты),
// пауза и настройки, обучение (Tutorial.js), отладка по F3, экранные кнопки для касаний.
// Вся разметка и CSS строятся здесь (стиль вставляется в <head>); слой HUD — на весь экран, pointer-events: none,
// кроме настоящих кнопок. Раскладка — HudLayout (блоки gh-*), ввод — Input, паузы — Pause, тексты — Lang (ключи gh.*).
//
// ВИЗУАЛЬНЫЙ ЯЗЫК — «промышленная физическая лаборатория». Токены лежат на :root, ими пользуются и другие экраны
// игры (js/GameScore.js: выбор карты, карточка уровня, раунд, итоги) — берите их, чтобы вид совпадал:
//   цвета    --gh-ink #15171a графит (самый тёмный) · --gh-char #1f2226 плита · --gh-char2 #2c3036 · --gh-line #3b4048
//            --gh-steel #8b929c · --gh-paper #f2ecdb тёплый белый · --gh-yel #ffc61a сигнальный жёлтый · --gh-yel2 #ffe07a
//            --gh-yeld #a97c00 тень жёлтого · --gh-red #ff5b2e опасность / урон
//   шрифт    --gh-font: 'Rubik' (assets/fonts/rubik.ttf, @font-face в index.html; OFL), жирные заглавные 700–900,
//            letter-spacing .04–.1em; цифры — font-variant-numeric: tabular-nums
//   панель   --gh-plate-bg, --gh-plate-edge, --gh-plate-shadow (жёсткая тень без размытия), --gh-out (контур текста
//            поверх 3D: text-shadow: var(--gh-out)), --gh-haz (полоса опасности: background: var(--gh-haz))
//   классы   .gh-plate (плита) · .gh-rivets (заклёпки в углах плиты) · .gh-btn / .gh-btn.alt (кнопка: жёлтая / тёмная)
//            .gh-haz (полоса опасности) · .gh-key (клавиша) · .gh-h (заголовок плиты: жёлтый, заглавные)
// Пауза и вход: GameScore.active — пока его экран открыт, мои экраны, HUD и пауза скрыты, клики за ним.

/** Графика 5×7 для логотипа из «вокселей» (X — воксель). */
const GH_GLYPH = {
    R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
    U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
    B: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'],
    L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
    E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
    A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
    M: ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
    S: ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'],
    T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
    O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
    F: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
    D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
    C: ['.XXXX', 'X....', 'X....', 'X....', 'X....', 'X....', '.XXXX'],
    I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
    N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
    // кириллица для логотипа сборки Пикабу (там название только по-русски)
    'М': ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
    'А': ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
    'С': ['.XXXX', 'X....', 'X....', 'X....', 'X....', 'X....', '.XXXX'],
    'Т': ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
    'Е': ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
    'Р': ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'],
    'З': ['XXXX.', '....X', '....X', '.XXX.', '....X', '....X', 'XXXX.'],
    'У': ['X...X', 'X...X', 'X...X', '.XXXX', '....X', '....X', 'XXXX.'],
    'Ш': ['X.X.X', 'X.X.X', 'X.X.X', 'X.X.X', 'X.X.X', 'X.X.X', 'XXXXX'],
    'Н': ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
    'И': ['X...X', 'X...X', 'X..XX', 'X.X.X', 'XX..X', 'X...X', 'X...X'],
    'Я': ['.XXXX', 'X...X', 'X...X', '.XXXX', '..X.X', '.X..X', 'X...X'],
};

/** Значки (SVG 32×32): заливка — currentColor, .ln — линия, .cut — «вырез» цветом подложки (--gh-cut). */
const GH_ICONS = {
    hammer: '<g transform="translate(-1.5 1.5) rotate(45 16 16)"><rect x="14.3" y="10" width="3.4" height="20" rx="1"/><rect x="7.5" y="3" width="17" height="8.5" rx="1.6"/><rect class="cut" x="9.6" y="5" width="2.6" height="4.5" rx=".6"/><rect class="cut" x="19.8" y="5" width="2.6" height="4.5" rx=".6"/></g>',
    rifle: '<path d="M1.5 15.2 4.5 12.8H11.5V11.3H17.5L19 12.8H30.5V15.4H19.5V17H16.2L15.2 22.8H11.6L12.4 17H9.2L5.5 21H1.5Z"/><rect x="11.5" y="8" width="6.5" height="2.4" rx="1.1"/><rect class="cut" x="21" y="13.7" width="8" height=".9"/>',
    shotgun: '<path d="M1.5 14.6 4.8 12.6H12V13H30.5V16.6H20.5V18.6H12.5L11.6 21.4H9.6L10.4 18.6H8.6L5.6 21.2H1.5Z"/><rect x="16" y="18" width="7.5" height="3.6" rx="1.2"/><rect class="cut" x="13" y="14.5" width="17.5" height=".9"/>',
    launcher: '<path d="M3 11H24L29.8 13.6V15.4L24 18H3Z"/><path d="M.8 9.8 4.2 11V18L.8 19.2Z"/><path d="M12 18H15.8L15 24.5H11.2Z"/><rect x="17" y="7.6" width="5" height="2.2" rx="1"/><rect class="cut" x="8" y="12.2" width="1.7" height="4.6"/><rect class="cut" x="18.5" y="12.2" width="1.7" height="4.6"/>',
    bomb: '<circle cx="14.5" cy="19" r="9.5"/><rect x="11.2" y="6" width="6.6" height="4" rx="1"/><path class="ln" d="M17.6 7.2C21 5.4 22.4 4.8 24.4 3.6"/><path d="M26.2 1.4 27.1 3.6 29.5 3.2 27.8 5 28.8 7.2 26.6 6 24.9 7.6 25.2 5.2 23 3.9 25.4 3.7Z"/><path class="cut" d="M7.6 17.6A7 7 0 0 1 13 12.5V14.6A5.2 5.2 0 0 0 9.7 18.4Z"/>',
    grab: '<path class="ln" d="M7 5.6C5.6 13 9.2 18.6 16 18.6S26.4 13 25 5.6"/><path class="ln" d="M16 18.6V27.6M11.4 27.6H20.6"/><rect x="11.2" y="7" width="9.6" height="7.4" rx="1.4"/><circle cx="7" cy="5.6" r="2.3"/><circle cx="25" cy="5.6" r="2.3"/>',
    spawner: '<rect class="ln" x="4.4" y="11.4" width="17.2" height="17.2" rx="1.2"/><path class="ln" d="M4.4 11.4 21.6 28.6M21.6 11.4 4.4 28.6" style="stroke-width:2"/><path d="M25 3.6h3v3.6h3.6v3H28v3.6h-3v-3.6h-3.6v-3H25Z"/>',
    torch: '<path d="M17.2 2.2C18.8 7.8 25.6 10.4 25.6 18.4A8.6 8.6 0 0 1 8.4 18.4C8.4 14.4 11 12.4 12 8.2 13.6 10.4 14.4 11.4 15.4 11.9 15.4 8.4 15.8 5.4 17.2 2.2Z"/><path class="cut" d="M17 26.4A4.5 4.5 0 0 1 12.5 21.9C12.5 18.8 15 17.8 15 14.8 16.6 16.6 21.5 18.6 21.5 21.9A4.5 4.5 0 0 1 17 26.4Z"/><rect x="3" y="28" width="26" height="3" rx="1.4"/>',
    jump: '<path class="ln" d="M7.5 19 16 10.5 24.5 19M7.5 26.5 16 18 24.5 26.5"/>',
    next: '<path class="ln" d="M5.5 11H21.5M16.5 6 22 11 16.5 16M26.5 21H10.5M15.5 16 10 21 15.5 26"/>',
    throw: '<path class="ln" d="M5.5 25C8 11 16 6.5 26 8M20.5 3.5 26.4 8 21.4 13.4"/><circle cx="6" cy="26" r="2.6"/>',
    cycle: '<path class="ln" d="M25.6 14A10 10 0 0 0 7.5 10.5M6.4 18A10 10 0 0 0 24.5 21.5"/><path d="M5.2 5.2 9.4 12.6 1.9 13.6ZM26.8 26.8 22.6 19.4 30.1 18.4Z"/>',
    pause: '<path d="M9 6h5.4v20H9zM17.6 6H23v20h-5.4z"/>',
    clock: '<circle class="ln" cx="16" cy="17" r="10.5"/><path class="ln" d="M16 10.5V17L20.5 19.5"/><path d="M12 2.5h8v3h-8z"/>',
    wing: '<path d="M2 20C7 8 14 6 22 8L30 6C27 14 22 22 14 24 10 25 6 23 2 20Z"/><path class="cut" d="M8 18C12 13 17 12 22 12.4 18 15 14 18 8 18Z"/>',
    play: '<path d="M7 4 28 16 7 28Z"/>',
};

const GH_CSS = `
:root{
--gh-ink:#15171a;--gh-char:#1f2226;--gh-char2:#2c3036;--gh-line:#3b4048;--gh-steel:#8b929c;
--gh-paper:#f2ecdb;--gh-yel:#ffc61a;--gh-yel2:#ffe07a;--gh-yeld:#a97c00;--gh-red:#ff5b2e;
--gh-font:'Rubik','Arial Narrow','Segoe UI',system-ui,sans-serif;
--gh-plate-bg:#1f2226;--gh-plate-edge:#15171a;
--gh-plate-shadow:inset 0 0 0 2px #3b4048,4px 4px 0 rgba(0,0,0,.5);
--gh-out:0 1px 0 #000,0 -1px 0 #000,1px 0 0 #000,-1px 0 0 #000,1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,0 3px 6px rgba(0,0,0,.5);
--gh-haz:repeating-linear-gradient(-45deg,#ffc61a 0 9px,#15171a 9px 18px);
--tut-bg:#1f2226;--tut-fg:#f2ecdb;--tut-accent:#ffc61a;--tut-border:#15171a;--tut-font:var(--gh-font);--tut-radius:4px;
--lory-input-fg:#fff3c8;--lory-input-bg:rgba(20,22,25,.42);--lory-input-accent:rgba(31,34,38,.92);
}
.gh-plate{background-color:var(--gh-plate-bg);border:2px solid var(--gh-plate-edge);border-radius:4px;box-shadow:var(--gh-plate-shadow);color:var(--gh-paper);font-family:var(--gh-font)}
.gh-rivets{--rv:radial-gradient(circle,#a3abb5 0 1.5px,#2a2e33 2.1px,transparent 2.7px);background-image:var(--rv),var(--rv),var(--rv),var(--rv);background-size:9px 9px;background-repeat:no-repeat;background-position:left 6px top 6px,right 6px top 6px,left 6px bottom 6px,right 6px bottom 6px}
.gh-haz{background:var(--gh-haz)}
.gh-out{text-shadow:var(--gh-out)}
.gh-h{margin:0;font:900 clamp(20px,3.4vh,28px)/1 var(--gh-font);letter-spacing:.1em;text-transform:uppercase;color:var(--gh-yel)}
.gh-key{display:inline-flex;align-items:center;justify-content:center;min-width:1.8em;height:1.7em;padding:0 .5em;margin:0 .15em;background:var(--gh-paper);color:var(--gh-ink);border-radius:.35em;font:800 .86em/1 var(--gh-font);text-transform:none;letter-spacing:0;box-shadow:0 2px 0 #8c866f,0 3px 0 rgba(0,0,0,.55);vertical-align:middle;white-space:nowrap}
.gh-btn{appearance:none;-webkit-appearance:none;border:0;margin:0;display:inline-flex;align-items:center;justify-content:center;gap:.6em;min-height:48px;padding:0 24px;border-radius:4px;background:var(--gh-yel);color:var(--gh-ink);font:800 clamp(15px,2.3vh,19px)/1.1 var(--gh-font);letter-spacing:.07em;text-transform:uppercase;text-align:center;cursor:pointer;box-shadow:0 5px 0 var(--gh-yeld),0 7px 0 rgba(0,0,0,.5);transition:transform .06s,box-shadow .06s,filter .12s;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.gh-btn svg{width:1.15em;height:1.15em;fill:currentColor;flex:none}
.gh-btn:hover{filter:brightness(1.08)}
.gh-btn:active,.gh-btn.down{transform:translateY(4px);box-shadow:0 1px 0 var(--gh-yeld),0 3px 0 rgba(0,0,0,.5)}
.gh-btn:focus-visible{outline:3px solid var(--gh-paper);outline-offset:3px}
.gh-btn.alt{background:var(--gh-char2);color:var(--gh-paper);box-shadow:inset 0 0 0 2px #4b525b,0 5px 0 #0e1012,0 7px 0 rgba(0,0,0,.5)}
.gh-btn.alt:active,.gh-btn.alt.down{box-shadow:inset 0 0 0 2px #4b525b,0 1px 0 #0e1012,0 3px 0 rgba(0,0,0,.5)}
.gh-btn.big{min-height:clamp(54px,9vh,70px);padding:0 clamp(26px,4vw,44px);font-size:clamp(20px,3.6vh,28px);letter-spacing:.09em}
.gh-btn.danger{background:var(--gh-red);color:#1a0a04;box-shadow:0 5px 0 #a8310f,0 7px 0 rgba(0,0,0,.5)}
.gh-ico{fill:currentColor;overflow:visible}
.gh-ico .ln{fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.gh-ico .cut{fill:var(--gh-cut,#1f2226)}

#gh-root{position:fixed;inset:0;z-index:40;pointer-events:none;font-family:var(--gh-font);color:var(--gh-paper);-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}
#gh-root *,.gh-screen,.gh-screen *{box-sizing:border-box}
#gh-root [hidden],.gh-screen[hidden],.gh-screen [hidden]{display:none!important}

.gh-xhair{position:fixed;left:50%;top:50%;width:clamp(34px,calc(56px*var(--hl-k,1)),64px);aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none}
.gh-xsvg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 1.2px #000) drop-shadow(0 0 1.2px #000)}
.gh-xsvg path,.gh-xsvg circle{fill:none;stroke:var(--gh-s,var(--gh-paper));stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;transition:stroke .1s,opacity .12s}
.gh-xsvg .xh-dot{fill:var(--gh-s,var(--gh-paper));stroke:none}
.gh-xsvg .xh-ring,.gh-xsvg .xh-brk,.gh-xsvg .xh-hold{opacity:0}
.gh-xhair[data-tool=shotgun] .xh-ring{opacity:.85;stroke-width:2}
.gh-xhair[data-tool=torch] .xh-ring{opacity:.7;stroke-width:2;stroke-dasharray:3 5}
.gh-xhair.reach .xh-tick,.gh-xhair.reach .xh-dot{--gh-s:var(--gh-yel)}
.gh-xhair[data-s=grab] .xh-brk{opacity:1}
.gh-xhair[data-s=grab] .xh-brk,.gh-xhair[data-s=grab] .xh-dot,.gh-xhair[data-s=hold] .xh-hold,.gh-xhair[data-s=hold] .xh-dot{--gh-s:var(--gh-yel)}
.gh-xhair[data-s=grab] .xh-tick,.gh-xhair[data-s=hold] .xh-tick{opacity:0}
.gh-xhair[data-s=hold] .xh-hold{opacity:1;fill:rgba(255,198,26,.28)}
.gh-xhair.hit .xh-tick{--gh-s:var(--gh-red);animation:gh-xhit .2s ease-out}
@keyframes gh-xhit{0%{transform:scale(1.45)}100%{transform:scale(1)}}
.gh-xsvg g{transform-origin:0 0}
.gh-xkey{position:absolute;left:50%;top:100%;transform:translate(-50%,4px);font-size:calc(11px * var(--hl-k,1) + 2px);pointer-events:none}

.gh-tools{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:calc(5px*var(--hl-k,1));pointer-events:none}
.gh-slot{position:relative;appearance:none;-webkit-appearance:none;border:0;padding:0;margin:0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(3px*var(--hl-k,1));overflow:hidden;background:rgba(25,27,31,.86);color:var(--gh-paper);--gh-cut:#191b1f;border-radius:4px;box-shadow:inset 0 0 0 2px #3b4048,0 3px 0 rgba(0,0,0,.45);font-family:var(--gh-font);pointer-events:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.gh-slot .gh-ico{width:52%;height:auto;aspect-ratio:1;max-height:54%;opacity:.92}
.gh-slot-key{position:absolute;left:0;top:0;min-width:1.7em;padding:.12em .4em .14em;font:800 calc(10px*var(--hl-k,1))/1.1 var(--gh-font);text-align:center;background:#3b4048;color:var(--gh-paper);border-bottom-right-radius:4px}
.gh-slot-name{display:none;max-width:100%;padding:0 2px;font:700 calc(9.5px*var(--hl-k,1))/1 var(--gh-font);text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;overflow:hidden}
.gh-names .gh-slot-name{display:block}
.gh-slot.cur{background:var(--gh-yel);color:var(--gh-ink);--gh-cut:#ffc61a;box-shadow:inset 0 0 0 2px #fff3b0,0 3px 0 var(--gh-yeld),0 0 0 2px var(--gh-ink);animation:gh-pop .22s ease-out}
.gh-slot.cur .gh-ico{opacity:1}
.gh-slot.cur .gh-slot-key{background:var(--gh-ink);color:var(--gh-yel)}
@keyframes gh-pop{0%{transform:translateY(5px) scale(.92)}60%{transform:translateY(-3px) scale(1.06)}100%{transform:none}}
.gh-touch .gh-slot{pointer-events:auto}
.gh-nudge{outline:4px solid var(--gh-yel);outline-offset:3px;animation:gh-glow .75s ease-in-out infinite alternate}
@keyframes gh-glow{from{outline-color:var(--gh-yel)}to{outline-color:#fff}}

.gh-hint{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:4px 16px;padding:7px 14px;font:600 calc(var(--hl-fs,16px)*.84)/1.25 var(--gh-font);background-color:rgba(25,27,31,.86);position:fixed}
.gh-seg{display:inline-flex;align-items:center;gap:.15em;white-space:nowrap}
.gh-seg .t{margin-left:.35em}
.gh-seg b{margin-left:.3em;color:var(--gh-yel);font-weight:800;text-transform:uppercase;letter-spacing:.04em}
.gh-tchip{display:inline-block;width:1.2em;height:1.2em;border-radius:50%;vertical-align:middle;border:2px solid var(--gh-paper)}
.gh-tchip.use{background:var(--gh-yel);border-color:var(--gh-ink)}
.gh-tchip.ctx{background:var(--gh-char2)}
.gh-hl-opt .opt{display:none}
.hl-low .gh-seg.opt,.hl-tall .gh-seg.opt{display:none}
.gh-name{position:absolute;left:0;right:0;bottom:calc(100% + 12px);text-align:center;font:900 clamp(20px,calc(30px*var(--hl-k,1)),38px)/1 var(--gh-font);text-transform:uppercase;letter-spacing:.09em;color:var(--gh-yel);text-shadow:var(--gh-out);opacity:0;transform:translateY(8px) scale(.94);transition:opacity .25s,transform .25s;pointer-events:none;white-space:nowrap}
.gh-name.on{opacity:1;transform:none}

.gh-status{display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.gh-chip{position:relative;display:inline-flex;align-items:center;gap:.5em;padding:.4em .75em .4em 1.15em;font:800 calc(var(--hl-fs,16px)*.78)/1 var(--gh-font);text-transform:uppercase;letter-spacing:.09em;background:var(--gh-ink);color:var(--gh-yel);border:2px solid var(--gh-yel);border-radius:3px;box-shadow:3px 3px 0 rgba(0,0,0,.5);overflow:hidden}
.gh-chip::before{content:'';position:absolute;left:0;top:0;bottom:0;width:.5em;background:var(--gh-haz)}
.gh-chip svg{width:1.25em;height:1.25em;fill:currentColor}
.gh-chip.slow{animation:gh-pulse 1.4s ease-in-out infinite}
.gh-chip.fly{color:var(--gh-paper);border-color:var(--gh-steel)}
@keyframes gh-pulse{50%{box-shadow:3px 3px 0 rgba(0,0,0,.5),0 0 0 3px rgba(255,198,26,.35)}}

.gh-menuchip{display:inline-flex;align-items:center;gap:.5em;padding:.3em .7em;font:700 calc(var(--hl-fs,16px)*.72)/1 var(--gh-font);letter-spacing:.1em;text-transform:uppercase;color:var(--gh-paper);background:rgba(25,27,31,.7);border:2px solid #3b4048;border-radius:3px;pointer-events:none;appearance:none;-webkit-appearance:none;margin:0;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.gh-menuchip svg{display:none;width:60%;height:60%;fill:currentColor}
.gh-touch .gh-menuchip{pointer-events:auto;justify-content:center;padding:0;background:rgba(31,34,38,.82);border-color:var(--lory-input-fg);border-width:3px;border-radius:50%}
.gh-touch .gh-menuchip svg{display:block}
.gh-touch .gh-menuchip span{display:none}
.hl-low .gh-menuchip span[data-t]{display:none}
.hl-low .gh-touch .gh-menuchip span{display:none}

.gh-toast{padding:9px 16px;text-align:center;font:800 calc(var(--hl-fs,16px)*.95)/1.2 var(--gh-font);letter-spacing:.05em;text-transform:uppercase;color:var(--gh-yel);background-color:rgba(21,23,26,.92);animation:gh-toast .22s ease-out}
@keyframes gh-toast{from{opacity:0;transform:translateY(-8px)}}
.gh-capture{padding:8px 16px;text-align:center;font:800 calc(var(--hl-fs,16px)*.92)/1.2 var(--gh-font);letter-spacing:.06em;text-transform:uppercase;color:var(--gh-ink);background:var(--gh-yel);border-color:var(--gh-ink);animation:gh-blink 1.3s ease-in-out infinite}
@keyframes gh-blink{50%{opacity:.72}}

.gh-pad{pointer-events:none}
.gh-tb{position:absolute;aspect-ratio:1;margin:0;padding:0;display:flex;align-items:center;justify-content:center;border:3px solid var(--lory-input-fg);border-radius:50%;background:rgba(31,34,38,.8);color:var(--gh-paper);--gh-cut:#1f2226;box-shadow:0 4px 0 rgba(0,0,0,.45);pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;appearance:none;-webkit-appearance:none;outline:none}
.gh-tb .gh-ico{width:54%;height:54%}
.gh-tb.on{transform:scale(.92);filter:brightness(1.18)}
.gh-tb.use{width:56%;right:0;bottom:0;background:var(--gh-yel);color:var(--gh-ink);border-color:var(--gh-ink);--gh-cut:#ffc61a;box-shadow:0 4px 0 var(--gh-yeld),0 6px 0 rgba(0,0,0,.4)}
.gh-tb.alt{width:37%;right:0;bottom:61.6%}
.gh-tb.jump{width:37%;right:61.6%;bottom:0}
.gh-tb.next{width:30%;right:41.9%;bottom:59.3%}
.gh-tb.off{opacity:.38}
.gh-tb .a2{display:none}
.gh-tb.alt.t-grab .a1,.gh-tb.alt.t-spawner .a1{display:none}
.gh-tb.alt.t-grab .a2.throw{display:block}
.gh-tb.alt.t-spawner .a2.cycle{display:block}

.gh-dbg{padding:8px 12px 9px;font:600 calc(var(--hl-fs,16px)*.7)/1.35 var(--gh-font);background-color:rgba(21,23,26,.86);font-variant-numeric:tabular-nums;pointer-events:none}
.gh-dbg-h{margin-bottom:4px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--gh-yel)}
.gh-dbg-g{display:grid;grid-template-columns:1fr auto;gap:0 14px}
.gh-dbg-g span{color:#b7bdc6;white-space:nowrap}
.gh-dbg-g b{text-align:right;color:var(--gh-paper);font-weight:700}
.hl-low .gh-dbg-g{grid-template-columns:1fr auto 1fr auto}

.gh-screen{position:fixed;inset:0;z-index:90;display:flex;pointer-events:auto;overflow-x:hidden;overflow-y:auto;font-family:var(--gh-font);color:var(--gh-paper);-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none;overscroll-behavior:contain}
.gh-scrim{position:fixed;inset:0;pointer-events:none}
.gh-start .gh-scrim{background:linear-gradient(90deg,rgba(14,15,17,.95) 0,rgba(14,15,17,.9) 40%,rgba(14,15,17,.5) 66%,rgba(14,15,17,.04) 100%)}
.gh-start-main{position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:clamp(10px,2.6vh,24px);width:min(100%,660px);min-height:100%;padding:clamp(24px,6vh,64px) clamp(22px,4.5vw,68px)}
.gh-start-main::after{content:'';position:absolute;top:0;bottom:0;right:0;width:12px;background:var(--gh-haz)}
.gh-tag{display:inline-flex;align-items:center;gap:.7em;font:700 clamp(10px,1.7vh,13px)/1 var(--gh-font);letter-spacing:.17em;text-transform:uppercase;color:var(--gh-yel)}
.gh-tag::before{content:'';width:.85em;height:.85em;background:var(--gh-yel)}
.gh-title{display:flex;width:100%}
.gh-title svg{display:block;width:min(100%,calc(34vh * 2.178));aspect-ratio:36.6 / 16.8;height:auto;overflow:visible}
.gh-sub{display:flex;align-items:center;gap:.9em;font:800 clamp(14px,3vh,25px)/1.1 var(--gh-font);letter-spacing:.17em;text-transform:uppercase;color:var(--gh-paper)}
.gh-sub::before{content:'';flex:none;width:clamp(26px,6vw,60px);height:.55em;background:var(--gh-haz)}
.gh-btns{display:flex;flex-wrap:wrap;gap:clamp(12px,2vh,18px) 16px;margin-top:clamp(4px,1.4vh,14px);padding-bottom:7px}
.gh-keys{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:clamp(2px,1.6vh,18px);font:600 clamp(11px,1.8vh,14px)/1.2 var(--gh-font);color:#c4c9d1}
.gh-keys span{display:inline-flex;align-items:center;gap:.3em;white-space:nowrap}
.hl-low .gh-keys,.gh-touch .gh-keys{display:none}
@media (max-width:700px){.gh-start .gh-scrim{background:linear-gradient(180deg,rgba(14,15,17,.9),rgba(14,15,17,.82))}.gh-start-main{width:100%;align-items:center;text-align:center}.gh-start-main::after{top:0;bottom:auto;left:0;right:0;width:auto;height:12px;position:fixed}.gh-btns{justify-content:center}.gh-keys{justify-content:center}.gh-title{justify-content:center}.gh-sub{justify-content:center;text-align:center}.gh-sub::before{display:none}}
.gh-fall{transform-box:fill-box;transform-origin:50% 50%;animation:gh-drop var(--d,7s) linear var(--w,0s) infinite}
@keyframes gh-drop{0%{opacity:0;transform:none}5%,26%{opacity:1;transform:none}27%{opacity:1;transform:translate(.04px,.05px)}30%{opacity:1;transform:translate(0,0);animation-timing-function:cubic-bezier(.5,0,1,.62)}100%{opacity:0;transform:translate(var(--dx,2px),19px) rotate(var(--rot,200deg))}}
@media (prefers-reduced-motion:reduce){.gh-fall,.gh-chip.slow,.gh-capture,.gh-slot.cur,.gh-nudge{animation:none}.gh-fall{opacity:1}}

.gh-menu{align-items:center;justify-content:center;padding:clamp(6px,2vh,20px)}
.gh-menu .gh-scrim{background:radial-gradient(ellipse at center,rgba(14,15,17,.58),rgba(14,15,17,.86))}
.gh-panel{position:relative;z-index:1;width:min(100%,500px);max-height:100%;overflow-x:hidden;overflow-y:auto;margin:auto;padding:0 0 clamp(12px,2.4vh,22px);scrollbar-width:thin}
.gh-panel-head{display:flex;align-items:center;gap:14px;padding:clamp(18px,3vh,24px) 22px 10px;position:relative}
.gh-panel-head::before{content:'';position:absolute;left:0;right:0;top:0;height:9px;background:var(--gh-haz)}
.gh-view{display:flex;flex-direction:column;gap:clamp(8px,1.6vh,12px);padding:6px 22px 4px}
.gh-back{margin-left:auto;min-height:38px;padding:0 14px;font-size:13px;box-shadow:inset 0 0 0 2px #4b525b,0 3px 0 #0e1012}
.hl-low .gh-view[data-view=main]{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}
.hl-low .gh-view[data-view=main] .gh-btn{min-height:44px;padding:0 10px;font-size:14px}
.gh-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);align-items:center;gap:8px 16px;padding:4px 0}
.gh-lab{font:800 14px/1.15 var(--gh-font);text-transform:uppercase;letter-spacing:.07em;color:var(--gh-paper)}
.gh-sens{display:flex;align-items:center;gap:12px}
.gh-sens output{min-width:3.6em;text-align:right;font:800 15px/1 var(--gh-font);color:var(--gh-yel);font-variant-numeric:tabular-nums}
.gh-range{-webkit-appearance:none;appearance:none;flex:1;min-width:90px;height:30px;margin:0;background:transparent;cursor:pointer;pointer-events:auto;touch-action:pan-y}
.gh-range::-webkit-slider-runnable-track{height:10px;background:linear-gradient(90deg,var(--gh-yel) var(--p,50%),#0c0d0f var(--p,50%));border:2px solid var(--gh-paper);border-radius:2px}
.gh-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:28px;margin-top:-11px;background:var(--gh-paper);border:3px solid var(--gh-ink);border-radius:3px;box-shadow:0 3px 0 #000}
.gh-range::-moz-range-track{height:10px;background:linear-gradient(90deg,var(--gh-yel) var(--p,50%),#0c0d0f var(--p,50%));border:2px solid var(--gh-paper);border-radius:2px}
.gh-range::-moz-range-thumb{width:14px;height:22px;background:var(--gh-paper);border:3px solid var(--gh-ink);border-radius:3px;box-shadow:0 3px 0 #000}
.gh-range:focus-visible{outline:3px solid var(--gh-paper);outline-offset:2px}
.gh-opts{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}
.gh-opt{appearance:none;-webkit-appearance:none;margin:0;min-height:40px;padding:0 6px;border:0;border-radius:3px;background:#0c0d0f;color:var(--gh-steel);font:800 13px/1 var(--gh-font);letter-spacing:.05em;text-transform:uppercase;cursor:pointer;box-shadow:inset 0 0 0 2px #3b4048;pointer-events:auto;touch-action:manipulation}
.gh-opt[aria-checked=true]{background:var(--gh-yel);color:var(--gh-ink);box-shadow:0 3px 0 var(--gh-yeld)}
.gh-opt:focus-visible{outline:3px solid var(--gh-paper);outline-offset:2px}
.gh-clist{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.gh-clist li{display:grid;grid-template-columns:minmax(96px,34%) 1fr;gap:12px;align-items:center;font:600 14px/1.25 var(--gh-font);color:#d3d7de}
.gh-clist li>span:first-child{display:flex;flex-wrap:wrap;gap:4px 2px;font-size:14px}
.hl-low .gh-panel{width:min(100%,720px)}
.hl-low .gh-clist{grid-template-columns:1fr 1fr;gap:6px 22px}
.hl-low .gh-clist li{grid-template-columns:auto 1fr;gap:10px;font-size:13px}
.gh-sep{height:2px;margin:2px 0;background:repeating-linear-gradient(90deg,#3b4048 0 8px,transparent 8px 14px)}

.lory-tut .lory-tut-card{padding-top:17px;background:rgba(25,27,31,.95);border:2px solid #0b0c0d;border-radius:4px;box-shadow:inset 0 0 0 2px #3b4048,4px 4px 0 rgba(0,0,0,.5)}
.lory-tut .lory-tut-card::before{content:'';position:absolute;left:0;right:0;top:0;height:7px;background:var(--gh-haz)}
.lory-tut .lory-tut-title{color:var(--gh-yel);text-transform:uppercase;letter-spacing:.08em;font-weight:900}
.lory-tut .lory-tut-hint{color:var(--gh-paper);font-weight:600}
.lory-tut .lory-tut-key{background:var(--gh-paper);color:var(--gh-ink);border-radius:.3em}
.lory-tut .lory-tut-skip{background:var(--gh-yel);color:var(--gh-ink);border:0;border-radius:4px;box-shadow:0 3px 0 var(--gh-yeld);text-transform:uppercase;letter-spacing:.06em;font-weight:800}
.lory-tut .lory-tut-skip kbd{background:var(--gh-ink);color:var(--gh-yel)}
.lory-tut .lory-tut-final{border-radius:4px;color:var(--gh-yel);text-transform:uppercase;letter-spacing:.07em}
.lory-tut .lory-tut-bar i{background:var(--gh-yel)}
.lory-tut .lory-tut-dots i.done{background:var(--gh-yel)}
.lory-tut-hl{outline-color:var(--gh-yel)}
.hl-low .lory-tut .lory-tut-main{flex:1 1 120px;min-width:0}
.hl-low .lory-tut .lory-tut-card{gap:6px 10px;padding-top:15px}
.hl-low .lory-tut .lory-tut-skip{min-height:34px;padding:5px 12px;font-size:13px}
.hl-low .lory-tut .lory-tut-title{font-size:16px}
.hl-low .lory-tut .lory-tut-hint{font-size:13px;line-height:1.7}
@media (max-height:420px){.gh-panel-head{padding-top:16px}.gh-btn{min-height:42px}}
`;

/** @satisfies {Record<string, any>} */
const GameHud = {
    /** @type {any} */
    game: null,
    ready: false,
    /** 'start' (экран «Играть») | 'play' | 'pause' (меню). */
    mode: 'start',
    view: 'main',
    debugOn: false,
    touch: false,
    /** @type {Record<string, any>} */
    el: {},
    /** @type {any[]} */
    _slots: [],
    _sig: '',
    _toolSig: -1,
    _tallTools: false,
    _nameT: 0,
    _toastT: 0,
    _hitT: 0,
    _dbgT: 0,
    _resetT: 0,
    _gsA: false,
    /** Обучение ждёт, пока игра пойдёт: '' | 'auto' (первый запуск) | 'replay' («Как играть»). */
    _tutPending: '',
    _selfSelect: false,
    _wasSlow: false,
    _wasFly: false,
    _lastKind: -1,
    /** @type {{ x: number, z: number, top: number }[] | null} */
    _buildings: null,

    // =====================================================================================
    // Запуск
    // =====================================================================================

    /** Game.init зовёт после Input и GameTools. */
    init(game) {
        if (this.ready) return;
        this.game = game;
        this._injectStyle();
        this._build();
        HudLayout.init({ app: game.app });
        this._blocks();
        this._bind();
        this._initTutorial();
        this._wasSlow = !!game.slowmo;
        this._wasFly = !!(game.player && game.player.fly);
        this.ready = true;
        // ?go=1 — игрок только что выбрал уровень: заставка не нужна, карточку уровня покажет GameScore
        const go = typeof location !== 'undefined' && new URLSearchParams(location.search).has('go');
        if (go) {
            this._tutPending = 'auto';
            this._setMode('play');
        } else {
            Pause.set('manual', true);
            Input.configure({ controls: false });
            this._setMode('start');
        }
        this._syncAll(true);
    },

    /** Экран выбора уровней (GameScore.js, если подключён). */
    _gs() {
        // @ts-ignore GameScore объявляет js/GameScore.js (может отсутствовать)
        return /** @type {any} */ (typeof GameScore !== 'undefined' ? GameScore : null);
    },
    _gsActive() { const g = this._gs(); return !!(g && g.active); },
    _hasLevels() { const g = this._gs(); return !!(g && typeof g.openLevels === 'function'); },

    /** Элемент: h('div', 'класс', 'текст'). */
    h(tag, cls, text) {
        const el = document.createElement(tag);
        if (cls) el.className = cls;
        if (text !== undefined) el.textContent = text;
        return el;
    },

    /** SVG-значок по имени. */
    ico(name, cls) {
        return '<svg class="gh-ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' + (GH_ICONS[name] || '') + '</svg>';
    },

    t(key, params) { return Lang.t(key, params); },

    _injectStyle() {
        if (document.getElementById('gh-style')) return;
        const st = document.createElement('style');
        st.id = 'gh-style';
        st.textContent = GH_CSS;
        document.head.appendChild(st);
    },

    // =====================================================================================
    // Разметка
    // =====================================================================================

    _build() {
        const E = this.el;
        const root = E.root = this.h('div');
        root.id = 'gh-root';
        document.body.appendChild(root);
        this._buildHud(root);
        this._buildStart();
        this._buildMenu();
    },

    _buildHud(root) {
        const E = this.el, h = this.h.bind(this);
        const hud = E.hud = h('div', 'gh-hud');
        hud.hidden = true;
        root.appendChild(hud);

        // прицел (центр экрана остаётся чистым: только тонкие метки)
        const xh = E.xhair = h('div', 'gh-xhair');
        xh.dataset.s = 'norm'; xh.dataset.tool = 'hammer';
        xh.innerHTML = '<svg class="gh-xsvg" viewBox="-32 -32 64 64" aria-hidden="true"><circle class="xh-ring" r="19"/><g class="xh-tick"><path d="M0-15V-7M0 15V7M-15 0H-7M15 0H7"/></g><g class="xh-brk"><path d="M-19-10V-19H-10M10-19H19V-10M19 10V19H10M-10 19H-19V10"/></g><circle class="xh-hold" r="10"/><circle class="xh-dot" r="1.7"/></svg>';
        E.xkey = h('kbd', 'gh-key gh-xkey');
        E.xkey.hidden = true;
        xh.appendChild(E.xkey);
        hud.appendChild(xh);

        // слева сверху: кнопка меню и значки режимов
        E.menuchip = h('button', 'gh-menuchip');
        E.menuchip.type = 'button';
        E.menuchip.tabIndex = -1;
        E.menuchip.innerHTML = this.ico('pause') + '<span class="gh-key">P</span><span data-t="gh.menuHint"></span>';
        hud.appendChild(E.menuchip);
        E.status = h('div', 'gh-status');
        E.status.hidden = true;
        E.slow = h('div', 'gh-chip slow');
        E.slow.innerHTML = this.ico('clock') + '<span data-t="gh.slowmo"></span>';
        E.fly = h('div', 'gh-chip fly');
        E.fly.innerHTML = this.ico('wing') + '<span data-t="gh.fly"></span>';
        E.slow.hidden = true; E.fly.hidden = true;
        E.status.append(E.slow, E.fly);
        hud.appendChild(E.status);

        // сверху по центру: тост и «нажмите, чтобы управлять»
        E.toast = h('div', 'gh-toast gh-plate');
        E.toast.hidden = true;
        hud.appendChild(E.toast);
        E.capture = h('div', 'gh-capture gh-plate');
        E.capture.hidden = true;
        E.capture.setAttribute('data-t', 'input.capture');
        hud.appendChild(E.capture);

        // снизу по центру: подсказка и панель инструментов
        E.hint = h('div', 'gh-hint gh-plate');
        E.name = h('div', 'gh-name');
        E.hintLine = h('div');
        E.hintLine.style.display = 'contents';
        E.hint.append(E.name, E.hintLine);
        hud.appendChild(E.hint);
        E.tools = h('div', 'gh-tools');
        E.tools.id = 'gh-tools';
        E.tools.setAttribute('role', 'toolbar');
        GameTools.list.forEach((tool, i) => {
            const b = h('button', 'gh-slot');
            b.type = 'button';
            b.id = 'gh-slot-' + i;
            b.tabIndex = -1;
            b.innerHTML = '<span class="gh-slot-key">' + tool.key + '</span>' + this.ico(tool.id) + '<span class="gh-slot-name"></span>';
            b.addEventListener('pointerdown', e => { if (!this.touch) return; e.preventDefault(); e.stopPropagation(); GameTools.select(i); });
            this._slots.push({ b, name: b.querySelector('.gh-slot-name') });
            E.tools.appendChild(b);
        });
        hud.appendChild(E.tools);

        this._buildTouch(hud);
        this._buildDebug(hud);
    },

    // Экранные кнопки: Применить (ЛКМ), Альт (ПКМ), Прыжок, Следующий инструмент. «Взять» — контекстная кнопка Input.
    _buildTouch(hud) {
        const E = this.el, h = this.h.bind(this);
        const pad = E.pad = h('div', 'gh-pad');
        pad.hidden = true;
        /** @param {string} cls @param {string} action @param {string} html @param {string} label */
        const mk = (cls, action, html, label) => {
            const b = h('button', 'gh-tb ' + cls);
            b.type = 'button';
            b.tabIndex = -1;
            b.innerHTML = html;
            b.setAttribute('aria-label', label);
            let pid = -1;
            b.addEventListener('pointerdown', e => {
                if (pid !== -1) return;
                pid = e.pointerId;
                e.preventDefault(); e.stopPropagation();
                try { b.setPointerCapture(pid); } catch (err) { /* синтетическое событие */ }
                b.classList.add('on');
                Input.setVirtual(action, true);
            });
            const up = e => {
                if (e.pointerId !== pid) return;
                pid = -1;
                b.classList.remove('on');
                Input.setVirtual(action, false);
            };
            for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up);
            b.addEventListener('contextmenu', e => e.preventDefault());
            pad.appendChild(b);
            return b;
        };
        E.use = mk('use', 'attack', '', 'Use');
        E.use.id = 'gh-use';
        E.alt = mk('alt', 'aim', this.ico('cycle', 'a2 cycle') + this.ico('throw', 'a2 throw') + this.ico('cycle', 'a1'), 'Alt');
        E.jump = mk('jump', 'jump', this.ico('jump'), 'Jump');
        E.next = mk('next', 'toolNext', this.ico('next'), 'Next tool');
        E.next.id = 'gh-next';
        hud.appendChild(pad);
    },

    _buildDebug(hud) {
        const E = this.el, h = this.h.bind(this);
        const d = E.debug = h('div', 'gh-dbg gh-plate');
        d.id = 'gh-debug';
        d.hidden = true;
        const head = h('div', 'gh-dbg-h');
        head.setAttribute('data-t', 'gh.dbg.title');
        const grid = h('div', 'gh-dbg-g');
        /** @type {Record<string, any>} */
        this._dbg = {};
        for (const key of ['fps', 'frame', 'phys', 'bodies', 'contacts', 'debris', 'fire', 'carved', 'made', 'boom', 'pos', 'gfx']) {
            const l = h('span');
            l.setAttribute('data-t', 'gh.dbg.' + key);
            const v = h('b', '', '—');
            this._dbg[key] = v;
            grid.append(l, v);
        }
        d.append(head, grid);
        hud.appendChild(d);
    },

    // Экран «Играть»: слева — графитовая панель с логотипом из вокселей, справа виден мир.
    _buildStart() {
        const E = this.el, h = this.h.bind(this);
        const s = E.start = h('section', 'gh-screen gh-start');
        s.setAttribute('role', 'dialog');
        s.setAttribute('aria-modal', 'true');
        s.setAttribute('aria-label', typeof GAME_TITLE !== 'undefined' ? GAME_TITLE : 'Master of Destruction');
        s.appendChild(h('div', 'gh-scrim'));
        const main = h('div', 'gh-start-main');
        const tag = h('div', 'gh-tag'); tag.setAttribute('data-t', 'gh.tag');
        const title = h('div', 'gh-title');
        title.innerHTML = this._titleSvg();
        const sub = h('div', 'gh-sub'); sub.setAttribute('data-t', 'gh.subtitle');
        const btns = h('div', 'gh-btns');
        E.play = h('button', 'gh-btn big');
        E.play.type = 'button';
        E.play.innerHTML = this.ico('play') + '<span data-t="gh.play"></span>';
        E.howto = h('button', 'gh-btn alt big');
        E.howto.type = 'button';
        E.howto.innerHTML = '<span data-t="gh.howto"></span>';
        E.play.addEventListener('click', () => this._onPlay());
        E.howto.addEventListener('click', () => this.play(true));
        btns.append(E.play, E.howto);
        E.keys = h('div', 'gh-keys');
        main.append(tag, title, sub, btns, E.keys);
        s.appendChild(main);
        this.el.root.appendChild(s);
    },

    // Меню паузы: Продолжить / Карты / Как играть / Настройки / Управление / Сбросить; настройки и управление — отдельные виды панели.
    _buildMenu() {
        const E = this.el, h = this.h.bind(this);
        const m = E.menu = h('section', 'gh-screen gh-menu');
        m.hidden = true;
        m.setAttribute('role', 'dialog');
        m.setAttribute('aria-modal', 'true');
        m.appendChild(h('div', 'gh-scrim'));
        const panel = h('div', 'gh-panel gh-plate gh-rivets');
        const head = h('div', 'gh-panel-head');
        E.menuTitle = h('h2', 'gh-h');
        E.back = h('button', 'gh-btn alt gh-back');
        E.back.type = 'button';
        E.back.setAttribute('data-t', 'gh.back');
        E.back.hidden = true;
        E.back.addEventListener('click', () => this.showView('main'));
        head.append(E.menuTitle, E.back);
        panel.appendChild(head);

        // главный вид
        const main = E.vMain = h('div', 'gh-view');
        main.dataset.view = 'main';
        const btn = (key, alt, fn, id) => {
            const b = h('button', 'gh-btn' + (alt ? ' alt' : ''));
            b.type = 'button';
            b.setAttribute('data-t', key);
            b.addEventListener('click', fn);
            if (id) E[id] = b;
            main.appendChild(b);
            return b;
        };
        btn('gh.resume', false, () => this.resume(), 'bResume');
        btn('gh.levels', true, () => { const g = this._gs(); if (g && g.openLevels) g.openLevels(); }, 'bLevels');
        btn('gh.shop', true, () => { if (typeof GameShop !== 'undefined') GameShop.open(); }, 'bShop');
        btn('gh.howto', true, () => { this.resume(); this._tutPending = 'replay'; }, 'bHowto');
        btn('gh.settings', true, () => this.showView('settings'), 'bSettings');
        btn('gh.controls', true, () => this.showView('controls'), 'bControls');
        btn('gh.reset', true, () => this.reset(false), 'bReset');
        panel.appendChild(main);

        // настройки
        const set = E.vSet = h('div', 'gh-view');
        set.dataset.view = 'settings';
        set.hidden = true;
        const row = (labelKey) => {
            const r = h('div', 'gh-row');
            const l = h('div', 'gh-lab'); l.setAttribute('data-t', labelKey);
            r.appendChild(l);
            set.appendChild(r);
            return r;
        };
        // чувствительность мыши 0.3–2.5 -> Game.save.sens
        const rs = row('gh.sens');
        const sw = h('div', 'gh-sens');
        const range = E.sens = /** @type {HTMLInputElement} */ (h('input', 'gh-range'));
        range.type = 'range'; range.min = '0.3'; range.max = '2.5'; range.step = '0.05';
        range.setAttribute('aria-label', 'sensitivity');
        E.sensOut = h('output');
        range.addEventListener('input', () => this._setSens(parseFloat(range.value), false));
        range.addEventListener('change', () => this._setSens(parseFloat(range.value), true));
        sw.append(range, E.sensOut);
        rs.appendChild(sw);
        // качество графики
        const rq = row('gh.quality');
        const opts = h('div', 'gh-opts');
        opts.setAttribute('role', 'radiogroup');
        E.q = {};
        for (const q of ['low', 'medium', 'high']) {
            const b = h('button', 'gh-opt');
            b.type = 'button';
            b.setAttribute('role', 'radio');
            b.setAttribute('data-t', 'gh.q.' + q);
            b.addEventListener('click', () => this._setQuality(q));
            E.q[q] = b;
            opts.appendChild(b);
        }
        rq.appendChild(opts);
        // звук
        const ra = row('gh.sound');
        const so = h('div', 'gh-opts');
        E.snd = h('button', 'gh-opt');
        E.snd.type = 'button';
        E.snd.setAttribute('role', 'switch');
        E.snd.addEventListener('click', () => { Sound.toggleMuted(); this._syncSettings(); });
        so.appendChild(E.snd);
        ra.appendChild(so);
        panel.appendChild(set);

        // управление
        const ctl = E.vCtl = h('div', 'gh-view');
        ctl.dataset.view = 'controls';
        ctl.hidden = true;
        E.clist = h('ul', 'gh-clist');
        ctl.appendChild(E.clist);
        panel.appendChild(ctl);

        m.appendChild(panel);
        E.panel = panel;
        this.el.root.appendChild(m);
    },

    // Логотип «MASTER OF / DESTRUCTION» из вокселей: тень-экструзия, фаски на каждом кубике, часть кубиков откалывается и падает по циклу.
    _titleSvg() {
        /** @type {Record<string, number[][]>} */
        const vox = { y: [], w: [] };
        const rows = String(GAME_PLATFORM) === 'pikabu'   // Пикабу: название только по-русски
            ? [{ word: 'МАСТЕР', y: 0, c: 'y' }, { word: 'РАЗРУШЕНИЯ', y: 9, c: 'w' }]
            : [{ word: 'MASTER OF', y: 0, c: 'y' }, { word: 'DESTRUCTION', y: 9, c: 'w' }];
        for (const r of rows) {
            let ox = 0;
            for (const ch of r.word) {
                if (GH_GLYPH[ch]) GH_GLYPH[ch].forEach((line, gy) => { for (let gx = 0; gx < 5; gx++) if (line[gx] === 'X') vox[r.c].push([ox + gx, r.y + gy]); });
                ox += 6;
            }
        }
        // откалываются: [x, y, цвет, смещение по x, поворот°, период с, задержка с] — нижние кубики букв, вразброс
        /** @type {[number, number, string, number, number, number, number][]} */
        const loose = [];
        const pickLoose = (c, y, n, seed) => {
            const row = vox[c].filter(p => p[1] === y);
            for (let k = 0; k < n && row.length; k++) {
                const p = row[Math.floor((k + 0.5) / n * row.length)];
                const sg = (k + seed) % 2 ? 1 : -1;
                loose.push([p[0], p[1], c, sg * (1.4 + (k % 3) * 0.6), sg * (170 + k * 30), 7.5 + (k * 1.3) % 3, (k * 1.7 + seed) % 7]);
            }
        };
        pickLoose('y', 6, 4, 0); pickLoose('w', 15, 4, 1);
        for (const l of loose) { const list = vox[l[2]]; const i = list.findIndex(p => p[0] === l[0] && p[1] === l[1]); if (i >= 0) list.splice(i, 1); }
        const pal = { y: ['#ffc61a', '#fff1ad', '#c38f00'], w: ['#f2ecdb', '#ffffff', '#b8b198'] };
        /** @param {number[][]} list @param {string} c */
        const paint = (list, c) => {
            let base = '', hi = '', lo = '';
            for (const [x, y] of list) { base += 'M' + x + ' ' + y + 'h1v1h-1z'; hi += 'M' + (x + .1) + ' ' + (y + .1) + 'h.8v.2h-.8z'; lo += 'M' + (x + .1) + ' ' + (y + .72) + 'h.8v.18h-.8z'; }
            const p = pal[c];
            return '<path d="' + base + '" fill="' + p[0] + '" stroke="#15171a" stroke-opacity=".55" stroke-width=".1"/><path d="' + hi + '" fill="' + p[1] + '"/><path d="' + lo + '" fill="' + p[2] + '"/>';
        };
        const shadow = (list) => { let d = ''; for (const [x, y] of list) d += 'M' + (x + .3) + ' ' + (y + .34) + 'h1v1h-1z'; return d; };
        let s = '<svg viewBox="-.2 -.2 66.6 16.8" preserveAspectRatio="xMinYMid meet" role="img" aria-label="' + (typeof GAME_TITLE !== 'undefined' ? GAME_TITLE : 'Master of Destruction') + '">';
        s += '<path d="' + shadow(vox.y) + shadow(vox.w) + '" fill="#07080a" opacity=".85"/>';
        // полоса опасности справа от «MASTER OF»
        s += '<defs><pattern id="ghHaz" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="1.3" height="2.6" fill="#ffc61a"/><rect x="1.3" width="1.3" height="2.6" fill="#15171a"/></pattern></defs>';
        const hx = rows[0].word.length * 6 + 1.2, hw = 66 - hx;   // полоса от конца первой строки до правого края
        s += '<rect x="' + hx + '" y="0.3" width="' + hw + '" height="6.6" fill="#07080a" opacity=".85" transform="translate(.3 .34)"/><rect x="' + hx + '" y="0.3" width="' + hw + '" height="6.6" fill="url(#ghHaz)" stroke="#15171a" stroke-width=".18"/>';
        s += paint(vox.y, 'y') + paint(vox.w, 'w');
        for (const l of loose) {
            const sh = '<path d="' + shadow([[l[0], l[1]]]) + '" fill="#07080a" opacity=".85"/>';
            s += '<g class="gh-fall" style="--dx:' + l[3] + 'px;--rot:' + l[4] + 'deg;--d:' + l[5] + 's;--w:' + l[6] + 's">' + sh + paint([[l[0], l[1]]], l[2]) + '</g>';
        }
        return s + '</svg>';
    },

    // =====================================================================================
    // Раскладка HUD (HudLayout) и события
    // =====================================================================================

    _blocks() {
        const E = this.el, HL = HudLayout;
        HL.block('gh-menu', { dock: 'tl', w: 'auto', h: 34, el: E.menuchip, order: -3 });
        HL.block('gh-status', { dock: 'tl', w: 210, h: 'auto', el: E.status, order: -2 });
        HL.block('gh-debug', { dock: 'tl', w: 300, h: 'auto', el: E.debug, order: 10 });
        HL.block('gh-toast', { dock: 'tc', w: 420, h: 'auto', el: E.toast, order: 5, fill: true, maxW: 520, minW: 200 });
        HL.block('gh-capture', { dock: 'tc', w: 380, h: 'auto', el: E.capture, order: 4, fill: true, maxW: 440, minW: 200 });
        HL.block('gh-tools', { dock: 'bc', w: 644, h: 70, el: E.tools, order: 0 });
        HL.block('gh-hint', { dock: 'bc', w: 644, h: 'auto', el: E.hint, order: 1, fill: true, maxW: 644, minW: 240 });
        HL.block('gh-pad', { dock: 'br', w: 172, h: 172, min: 140, el: E.pad, order: -11, touchOnly: true });
        HL.onChange(() => this._onLayout());
    },

    _onLayout() {
        // названия в ячейках — пока они помещаются (ячейка не уже 60 px)
        const r = HudLayout.rect('gh-tools');
        this.el.tools.classList.toggle('gh-names', !!r && r.w / 8 >= 60 && HudLayout.k >= 0.8);
        // в портрете панель берёт всю ширину над колонками стика и кнопок, а не втискивается между ними
        const tall = HudLayout.mode === 'tall';
        if (tall !== this._tallTools) { this._tallTools = tall; HudLayout.block('gh-tools', { minW: tall ? 644 : 0 }); }
    },

    _bind() {
        const E = this.el;
        GameTools.on(e => this._onTool(e));
        Input.on('unlock', () => {
            // дать GameScore секунду: он мог сам отпустить курсор ради своего экрана
            setTimeout(() => { if (this.mode === 'play' && !this._gsActive() && !Input.locked) this.openPause(); }, 30);
        });
        window.addEventListener('keydown', e => this._onKey(e));
        window.addEventListener('lory-language', () => this._langApply());
        window.addEventListener('lory-input-device', () => { this._sig = ''; this._syncAll(true); });
        E.menuchip.addEventListener('click', () => { if (this.touch) this.openPause(); });
    },

    _onKey(e) {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const code = e.code;
        if (code === 'F3' && Input.hasKey('debug', 'F3')) { e.preventDefault(); if (this.mode === 'play' && !this._gsActive()) this._toggleDebug(); return; }
        if (code === 'F9' && Input.hasKey('reset', 'F9')) { e.preventDefault(); return; }   // сам сброс — Game.update (Input 'reset')
        if (this._gsActive()) return;
        if (Input.hasKey('pause', code) || code === 'KeyP') {
            if (this.mode === 'play') this.openPause();
            else if (this.mode === 'pause' && this.view === 'main') this.resume();
            else if (this.mode === 'pause') this.showView('main');
        } else if (code === 'Escape' && this.mode === 'pause' && this.view !== 'main') {
            this.showView('main');
        }
    },

    // =====================================================================================
    // Режимы: заставка, игра, пауза
    // =====================================================================================

    _setMode(m) {
        this.mode = m;
        if (m === 'pause') this.showView('main');
        if (m === 'start') this._renderKeys();
        this._applyVis();
        this._langApply();
        if (m === 'start') { try { this.el.play.focus({ preventScroll: true }); } catch (e) { /* нет фокуса */ } }
    },

    // Что видно сейчас: экраны GameScore (.active) перекрывают всё моё.
    _applyVis() {
        const E = this.el, gs = this._gsActive(), m = this.mode;
        E.start.hidden = !(m === 'start' && !gs);
        E.menu.hidden = !(m === 'pause' && !gs);
        document.documentElement.classList.toggle('gh-paused', m === 'pause' && !gs);
        E.hud.hidden = !(m === 'play' && !gs);
        HudLayout.refresh();
        if (!E.menu.hidden) { try { E.bResume.focus({ preventScroll: true }); } catch (e) { /* нет фокуса */ } }
    },

    // «Играть»: есть выбор уровней — открыть его (старт игры — перезагрузка с ?go=1), иначе начать сразу.
    _onPlay() {
        const g = this._gs();
        if (g && typeof g.openLevels === 'function') { g.openLevels(); return; }
        this.play(false);
    },

    /** Начать игру с заставки; replay — «Как играть»: обучение запускается всегда. */
    play(replay) {
        if (this.mode !== 'start') return;
        this._setMode('play');
        this._unpause();
        this._tutPending = replay ? 'replay' : 'auto';
        if (typeof Platform !== 'undefined' && typeof Platform.gameplay === 'function') Platform.gameplay(true);
    },

    _unpause() {
        Pause.set('manual', false);
        Input.configure({ controls: true });
        Input.capture();       // по жесту игрока (клик, клавиша); без него тихо ничего
    },

    openPause() {
        if (this.mode !== 'play' || this._gsActive()) return;
        this._setMode('pause');
        Pause.set('manual', true);
        Input.configure({ controls: false });
        Input.release();
        if (typeof Platform !== 'undefined' && typeof Platform.gameplay === 'function') Platform.gameplay(false);
    },

    resume() {
        if (this.mode !== 'pause') return;
        this._setMode('play');
        this._unpause();
        if (typeof Platform !== 'undefined' && typeof Platform.gameplay === 'function') Platform.gameplay(true);
    },

    /** Вид меню: main | settings | controls. */
    showView(name) {
        const E = this.el;
        this.view = name;
        E.vMain.hidden = name !== 'main';
        E.vSet.hidden = name !== 'settings';
        E.vCtl.hidden = name !== 'controls';
        E.back.hidden = name === 'main';
        E.menuTitle.textContent = this.t(name === 'main' ? 'gh.pause' : name === 'settings' ? 'gh.settings' : 'gh.controls');
        E.bLevels.hidden = !this._hasLevels();
        this._resetT = 0;
        E.bReset.textContent = this.t('gh.reset');
        E.bReset.classList.remove('danger');
        if (name === 'settings') this._syncSettings();
        if (name === 'controls') this._renderControls();
        E.panel.scrollTop = 0;
    },

    /** Сбросить лабораторию: страница перезагружается. Из меню — с подтверждением (второй щелчок за 3 с). */
    reset(now) {
        if (!now && this._resetT <= 0) {
            this._resetT = 3;
            this.el.bReset.textContent = this.t('gh.reset.sure');
            this.el.bReset.classList.add('danger');
            return;
        }
        this.toast('gh.resetting');
        setTimeout(() => location.reload(), 220);
    },

    // =====================================================================================
    // Настройки
    // =====================================================================================

    _setSens(v, persist) {
        if (!(v > 0)) return;
        v = Math.max(0.3, Math.min(2.5, v));
        this.game.save.sens = Math.round(v * 100) / 100;
        this._syncSens();
        if (persist) this.game.persist();
    },

    _setQuality(q) {
        if (typeof VoxRender !== 'undefined' && VoxRender.setQuality) VoxRender.setQuality(q);
        this.game.save.quality = q;
        this.game.persist();
        this._syncSettings();
    },

    _syncSens() {
        const E = this.el, v = this.game.save.sens || 1;
        E.sens.value = String(v);
        E.sens.style.setProperty('--p', ((v - 0.3) / 2.2 * 100).toFixed(1) + '%');
        E.sensOut.textContent = '×' + v.toFixed(2);
    },

    _syncSettings() {
        const E = this.el;
        this._syncSens();
        const q = this.game.save.quality || (typeof VoxRender !== 'undefined' ? VoxRender.quality : 'high');
        for (const k of Object.keys(E.q)) E.q[k].setAttribute('aria-checked', String(k === q));
        const on = !Sound.muted;
        E.snd.setAttribute('aria-checked', String(on));
        E.snd.textContent = this.t(on ? 'gh.on' : 'gh.off');
    },

    // =====================================================================================
    // Тексты и справочник управления
    // =====================================================================================

    _langApply() {
        Lang.apply(this.el.root);
        this._sig = '';
        this._toolSig = -1;
        this._renderKeys();
        if (this.mode === 'pause') this.showView(this.view);
        this._syncTools(true);
        this._syncHint();
    },

    /** Название клавиши действия под текущее устройство. */
    _cap(action) {
        return Input.device === 'pad' ? (Input.labelOf(action, 'pad') || '') : Input.labelOf(action, 'keyboard');
    },

    _renderKeys() {
        const E = this.el;
        if (!E.keys) return;
        E.keys.textContent = '';
        E.keys.hidden = Input.device === 'touch' || !!Input.mouseTouch;
        const items = [
            [['forward', 'left', 'back', 'right'].map(a => Input.labelOf(a, 'keyboard')), 'gh.k.move'],
            [[this.t('gh.k.mouse')], 'gh.k.look'],
            [[Input.label('Mouse0')], 'gh.k.use'],
            [['1–8'], 'gh.k.tools'],
            [[Input.labelOf('interact', 'keyboard')], 'gh.k.grab'],
        ];
        for (const [caps, key] of items) {
            const s = this.h('span');
            for (const c of caps) s.appendChild(this.h('kbd', 'gh-key', c));
            s.appendChild(this.h('span', '', this.t(key)));
            E.keys.appendChild(s);
        }
    },

    _renderControls() {
        const L = this.el.clist;
        L.textContent = '';
        /** @param {string[]} caps @param {string} key */
        const row = (caps, key) => {
            const li = this.h('li'), k = this.h('span');
            for (const c of caps) k.appendChild(this.h('kbd', 'gh-key', c));
            li.append(k, this.h('span', '', this.t(key)));
            L.appendChild(li);
        };
        const bt = a => Input.bindingsText(a).split(' / ').filter(Boolean).slice(0, 2);
        if (this.touch) {
            row([this.t('gh.tc.left')], 'gh.tc.move');
            row([this.t('gh.tc.right')], 'gh.tc.look');
            row([this.t('gh.tc.use')], 'gh.tc.useT');
            row([this.t('gh.tc.alt')], 'gh.tc.altT');
            row([this.t('gh.tc.jump')], 'gh.tc.jumpT');
            row([this.t('gh.tc.ctx')], 'gh.tc.ctxT');
            row([this.t('gh.tc.next')], 'gh.tc.nextT');
            row([this.t('gh.tc.bar')], 'gh.tc.barT');
            return;
        }
        row(['forward', 'left', 'back', 'right'].map(a => Input.labelOf(a, 'keyboard')), 'gh.c.move');
        row([this.t('gh.k.mouse')], 'gh.c.look');
        row(bt('jump'), 'gh.c.jump');
        row(bt('sprint').slice(0, 1), 'gh.c.sprint');
        row(bt('crouch'), 'gh.c.crouch');
        row(bt('attack'), 'gh.c.use');
        row(bt('aim'), 'gh.c.alt');
        row(bt('interact'), 'gh.c.grab');
        row(['1–8', Input.labelOf('toolNext', 'keyboard'), this.t('gh.k.wheel')], 'gh.c.tool');
        row(bt('slowmo'), 'gh.c.slow');
        row(bt('fly'), 'gh.c.fly');
        row(bt('debug'), 'gh.c.debug');
        row(bt('pause').concat(['Esc']), 'gh.c.pause');
        row(bt('reset'), 'gh.c.reset');
    },

    // =====================================================================================
    // Инструменты, подсказки, прицел
    // =====================================================================================

    _onTool(e) {
        if (e.type === 'select') {
            this._toolSig = -1;
            if (!this._selfSelect) {
                this._nameT = 1.5;
                Tutorial.complete('tools');
            }
        } else if (e.type === 'hit') {
            if (e.tool === 'hammer' && e.count > 0) Tutorial.complete('hammer');
            if (e.count > 0) this._hitT = 0.2;
        } else if (e.type === 'explode') {
            this._hitT = 0.25;
            Tutorial.complete('boom');
        } else if (e.type === 'grab') {
            Tutorial.complete('grab');
        } else if (e.type === 'kind') {
            this._sig = '';
        }
    },

    // Подсветка текущей ячейки, подписи и значок на кнопке «Применить».
    _syncTools(force) {
        const T = GameTools, i = T.current;
        if (!force && i === this._toolSig) return;
        this._toolSig = i;
        const E = this.el;
        this._slots.forEach((s, k) => {
            s.b.classList.toggle('cur', k === i);
            s.b.setAttribute('aria-pressed', String(k === i));
            const nm = this.t('gh.tool.' + T.list[k].id);
            s.name.textContent = nm;
            s.b.setAttribute('aria-label', nm);
        });
        const tool = T.list[i];
        E.use.innerHTML = this.ico(tool.id);
        E.use.setAttribute('aria-label', this.t('gh.tool.' + tool.id));
        E.alt.classList.remove('t-grab', 't-spawner');
        E.alt.classList.toggle('t-grab', tool.id === 'grab');
        E.alt.classList.toggle('t-spawner', tool.id === 'spawner');
        E.alt.classList.toggle('off', tool.id !== 'grab' && tool.id !== 'spawner');
        E.name.textContent = this.t('gh.tool.' + tool.id);
        E.xhair.dataset.tool = tool.id;
        this._sig = '';
    },

    // Строка подсказки: что делают кнопки текущего инструмента (под ПК, геймпад или касания).
    _syncHint() {
        const T = GameTools, tool = T.tool.id, held = !!T.held;
        const dev = Input.device === 'pad' ? 'pad' : (this.touch ? 'touch' : 'kb');
        const kind = T.spawnKind;
        const SH = typeof GameShop !== 'undefined' && GameShop.game ? GameShop : null;
        const variant = SH && (tool === 'launcher' || tool === 'bomb') ? SH.variantName(tool) + '/' + (T.remoteCount ? T.remoteCount() : 0) : '';
        const sig = [tool, held ? (/** @type {any} */ (T.held).e ? 'e' : 'g') : '', dev, kind, Lang.code, Input.bindingsText('attack'), variant].join('|');
        if (sig === this._sig) return;
        this._sig = sig;
        /** @type {{ cap?: string, icon?: string, text: string, strong?: string, opt?: boolean }[]} */
        const parts = [];
        const use = (text, strong) => parts.push(dev === 'touch' ? { icon: 'use', text, strong } : { cap: this._cap('attack'), text, strong });
        const alt = (text) => parts.push(dev === 'touch' ? { icon: 'alt', text } : { cap: this._cap('aim'), text });
        const grab = (text, opt) => parts.push(dev === 'touch' ? { icon: 'ctx', text, opt } : { cap: this._cap('interact'), text, opt });
        if (held) {
            if (tool === 'grab') { use(this.t('gh.hint.hold')); alt(this.t('gh.hint.throw')); }
            else { use(this.t('gh.hint.throw')); grab(this.t('gh.hint.drop')); }
            if (dev === 'kb') parts.push({ cap: this.t('gh.k.wheel'), text: this.t('gh.hint.dist'), opt: true });
        } else if (tool === 'spawner') {
            use(this.t('gh.hint.spawner.use'), this.t('gh.kind.' + T.spawnKinds[kind]) + ' ' + (kind + 1) + '/' + T.spawnKinds.length);
            alt(this.t('gh.hint.spawner.alt'));
            grab(this.t('gh.hint.take'), true);
        } else if (SH && (tool === 'launcher' || tool === 'bomb')) {
            use(this.t('gh.hint.' + tool + '.use'), SH.variantName(tool));
            alt(tool === 'bomb' && T.remoteCount && T.remoteCount() ? this.t('rls.hint.detonate') : this.t('rls.hint.cycle'));
            grab(this.t('gh.hint.take'), true);
        } else if (tool === 'grab') {
            use(this.t('gh.hint.grab.use'));
            alt(this.t('gh.hint.grab.alt'));
        } else {
            use(this.t('gh.hint.' + tool + '.use'));
            grab(this.t('gh.hint.take'), true);
        }
        const L = this.el.hintLine;
        L.textContent = '';
        for (const p of parts) {
            const s = this.h('span', 'gh-seg' + (p.opt ? ' opt' : ''));
            if (p.cap) s.appendChild(this.h('kbd', 'gh-key', p.cap));
            else if (p.icon) s.appendChild(this.h('i', 'gh-tchip ' + p.icon));
            s.appendChild(this.h('span', 't', p.text));
            if (p.strong) s.appendChild(this.h('b', '', p.strong));
            L.appendChild(s);
        }
    },

    _syncCross(dt) {
        const E = this.el, T = GameTools, aim = T.aim, held = !!T.held, id = T.tool.id;
        const s = held ? 'hold' : (aim && aim.grabbable ? 'grab' : 'norm');
        if (E.xhair.dataset.s !== s) E.xhair.dataset.s = s;
        const reach = !!aim && aim.t <= (id === 'hammer' ? 2.8 : id === 'torch' ? 5.5 : 0);
        E.xhair.classList.toggle('reach', reach);
        if (this._hitT > 0) this._hitT -= dt;
        E.xhair.classList.toggle('hit', this._hitT > 0);
        const showKey = s === 'grab' && !this.touch;
        E.xkey.hidden = !showKey;
        if (showKey) { const c = this._cap(id === 'grab' ? 'attack' : 'interact'); if (E.xkey.textContent !== c) E.xkey.textContent = c; }
    },

    // =====================================================================================
    // Тосты и значки режимов
    // =====================================================================================

    /** Короткое сообщение сверху по центру. */
    toast(key, params) {
        const E = this.el;
        E.toast.textContent = this.t(key, params);
        E.toast.hidden = false;
        E.toast.style.animation = 'none';
        void E.toast.offsetWidth;
        E.toast.style.animation = '';
        this._toastT = 1.8;
        HudLayout.schedule();
    },

    _syncModes() {
        const E = this.el, g = this.game, slow = !!g.slowmo, fly = !!(g.player && g.player.fly);
        if (slow !== this._wasSlow) { this._wasSlow = slow; this.toast(slow ? 'gh.slow.on' : 'gh.slow.off'); }
        if (fly !== this._wasFly) { this._wasFly = fly; this.toast(fly ? 'gh.fly.on' : 'gh.fly.off'); }
        const sh = !slow, fh = !fly;
        if (E.slow.hidden !== sh || E.fly.hidden !== fh) {
            E.slow.hidden = sh; E.fly.hidden = fh;
            E.status.hidden = sh && fh;
            HudLayout.schedule();
        }
    },

    // =====================================================================================
    // Касания
    // =====================================================================================

    _syncTouch() {
        const E = this.el;
        const touch = !!(Input.mouseTouch || (Input.touchSeen && Input.device === 'touch'));
        if (touch !== this.touch) {
            this.touch = touch;
            E.root.classList.toggle('gh-touch', touch);
            document.documentElement.classList.toggle('gh-touch', touch);
            E.pad.hidden = !touch;
            HudLayout.block('gh-menu', touch ? { w: 48, h: 48, min: 44 } : { w: 'auto', h: 34, min: 1 });
            this._sig = '';
            this._renderKeys();
            HudLayout.refresh();
        }
    },

    _syncTouchContext() {
        if (!this.touch) { Input.clearContext('gh-grab'); return; }
        // контекстная кнопка Input = клавиша E: «Взять» у предмета в прицеле, «Отпустить» в руках
        const T = GameTools;
        if (T.held) Input.setContext({ id: 'gh-grab', label: 'gh.ctx.drop', icon: '⤓' });
        else if (T.aim && T.aim.grabbable && T.tool.id !== 'grab') Input.setContext({ id: 'gh-grab', label: 'gh.ctx.grab', icon: '⤒' });
        else Input.clearContext('gh-grab');
    },

    // =====================================================================================
    // Отладка (F3)
    // =====================================================================================

    _toggleDebug() {
        this.debugOn = !this.debugOn;
        this.el.debug.hidden = !this.debugOn;
        this._dbgT = 0;
        HudLayout.refresh();
    },

    _syncDebug(dt) {
        if (!this.debugOn) return;
        this._dbgT -= dt;
        if (this._dbgT > 0) return;
        this._dbgT = 0.25;
        const D = this._dbg, g = this.game, S = g.stats;
        const P = typeof VoxPhysics !== 'undefined' ? VoxPhysics.stats : { bodies: 0, awake: 0, manifolds: 0, points: 0, ms: 0 };
        const V = typeof VoxDestruction !== 'undefined' ? VoxDestruction : null;
        const set = (k, v) => { if (D[k].textContent !== v) D[k].textContent = v; };
        set('fps', S.fps.toFixed(0));
        set('frame', S.frameMs.toFixed(1));
        set('phys', S.physMs.toFixed(1) + ' / ' + P.ms.toFixed(1));
        set('bodies', P.awake + ' / ' + P.bodies);
        set('contacts', P.manifolds + ' / ' + P.points);
        set('debris', String(typeof VoxFX !== 'undefined' ? VoxFX.debris.length : 0));
        set('fire', String(V ? V.fire.size : 0));
        set('carved', V ? String(V.stats.carved) : '0');
        set('made', V ? String(V.stats.bodiesMade) : '0');
        set('boom', V ? String(V.stats.explosions) : '0');
        const p = g.player;
        set('pos', p ? p.pos.x.toFixed(1) + ' ' + p.pos.y.toFixed(1) + ' ' + p.pos.z.toFixed(1) : '—');
        set('gfx', VoxRender.quality + ' · ' + VoxRender.stats.tris);
    },

    // =====================================================================================
    // Кадр
    // =====================================================================================

    /** Game.frame зовёт каждый кадр (в том числе на паузе). */
    update(dt) {
        if (!this.ready) return;
        const gs = this._gsActive();
        if (gs !== this._gsA) { this._gsA = gs; this._applyVis(); }
        if (this._resetT > 0) {
            this._resetT -= dt;
            if (this._resetT <= 0 && this.view === 'main') { this.el.bReset.textContent = this.t('gh.reset'); this.el.bReset.classList.remove('danger'); }
        }
        this._syncTouch();
        if (this.mode !== 'play') return;
        // после ?go=1 обучение стартует, когда игра пошла (карточку уровня закрыли)
        if (this._tutPending && !gs && !Pause.active) {
            const how = this._tutPending;
            this._tutPending = '';
            if (how === 'replay') Tutorial.start({ replay: true }); else Tutorial.autoStart();
        }
        if (gs) return;
        this._syncTouchContext();
        this._syncTools(false);
        this._syncHint();
        this._syncCross(dt);
        this._syncModes();
        this._syncDebug(dt);
        const E = this.el;
        if (this._nameT > 0) { this._nameT -= dt; E.name.classList.toggle('on', this._nameT > 0); }
        if (this._toastT > 0) { this._toastT -= dt; if (this._toastT <= 0) { E.toast.hidden = true; HudLayout.schedule(); } }
        const cap = Input.needsCapture && !Pause.active;
        if (E.capture.hidden === cap) { E.capture.hidden = !cap; HudLayout.schedule(); }
    },

    _syncAll(force) {
        this._syncTools(true);
        this._syncHint();
        this._syncSens();
        this._renderKeys();
        this._langApply();
        if (force) HudLayout.refresh();
    },

    // =====================================================================================
    // Обучение
    // =====================================================================================

    _initTutorial() {
        const T = Tutorial;
        const self = this;
        T.init({
            app: this.game.app,
            state: () => this.game.save, field: 'tutorialDone',
            persist: () => this.game.persist(),
            project: (x, z, y) => this._project(x, z, y),
            steps: [
                T.preset('move'),
                T.preset('look'),
                {
                    id: 'hammer', title: 'gh.tut.hammer.t',
                    hint: { keyboard: 'gh.tut.hammer.k', touch: 'gh.tut.hammer.m', pad: 'gh.tut.hammer.k' },
                    keys: { keyboard: ['attack'], pad: ['attack'] },
                    icons: { touch: ['tap'] },
                    target: { touch: '#gh-use' },
                    world: () => self._wallTarget(),
                    onEnter: () => self._pick(0),
                },
                {
                    id: 'tools', title: 'gh.tut.tools.t',
                    hint: { keyboard: 'gh.tut.tools.k', touch: 'gh.tut.tools.m', pad: 'gh.tut.tools.k' },
                    keys: { keyboard: ['=1–8'], pad: ['toolNext'] },
                    target: { touch: '#gh-next' },
                    onEnter: () => self._nudge('#gh-tools'),
                    onExit: () => self._nudge(null),
                },
                {
                    id: 'boom', title: 'gh.tut.boom.t',
                    hint: { keyboard: 'gh.tut.boom.k', touch: 'gh.tut.boom.m', pad: 'gh.tut.boom.k' },
                    keys: { keyboard: ['attack'], pad: ['attack'] },
                    target: { touch: '#gh-use' },
                    onEnter: () => { const id = GameTools.tool.id; if (id !== 'launcher' && id !== 'bomb') self._pick(3); self._nudge('#gh-slot-3'); },
                    onExit: () => self._nudge(null),
                },
                {
                    id: 'grab', title: 'gh.tut.grab.t',
                    hint: { keyboard: 'gh.tut.grab.k', touch: 'gh.tut.grab.m', pad: 'gh.tut.grab.k' },
                    keys: { keyboard: ['interact'], pad: ['interact'] },
                    target: { touch: '@context' },
                    onEnter: () => self._dropCrate(),
                },
            ],
            onFinish: () => { this._sig = ''; this._nudge(null); },
        });
    },

    // Подсветить элемент HUD (рамка мигает) без стрелки: стрелка обучения легла бы на строку подсказки. null — снять.
    _nudge(sel) {
        for (const el of document.querySelectorAll('.gh-nudge')) el.classList.remove('gh-nudge');
        const el = sel ? document.querySelector(sel) : null;
        if (el) el.classList.add('gh-nudge');
    },

    // Сменить инструмент от имени обучения: событие 'select' не считается «действием игрока».
    _pick(i) {
        this._selfSelect = true;
        try { GameTools.select(i); } finally { this._selfSelect = false; }
    },

    // Шаг «Схвати предмет»: поставить ящик перед игроком, чтобы было что хватать.
    _dropCrate() {
        const T = GameTools;
        if (typeof T._spawn !== 'function') return;
        const k = T.spawnKind;
        try {
            T.spawnKind = Math.max(0, T.spawnKinds.indexOf('crate'));
            T._spawn();
        } catch (e) { console.warn('GameHud: ящик для обучения', e); }
        T.spawnKind = k;
    },

    // Проекция точки мира (метры; y вверх) на экран — для стрелок обучения: (x, z, высота).
    _project(x, z, y) {
        const cam = VoxRender.camera, eng = VoxRender.engine, scene = VoxRender.scene;
        const p = cam.position, f = this.game.player.dir();
        const behind = ((x - p.x) * f.x + (y - p.y) * f.y + (z - p.z) * f.z) <= 0.05;
        const rw = eng.getRenderWidth(), rh = eng.getRenderHeight();
        const v = BABYLON.Vector3.Project(new BABYLON.Vector3(x, y, z), BABYLON.Matrix.IdentityReadOnly, scene.getTransformMatrix(), cam.viewport.toGlobal(rw, rh));
        const sx = window.innerWidth / rw, sy = window.innerHeight / rh;
        return { x: v.x * sx, y: v.y * sy, behind, visible: !behind && v.x >= 0 && v.y >= 0 && v.x <= rw && v.y <= rh };
    },

    // Ближайшая постройка (маркер карты, для которого есть сборщик) — стрелка «иди сюда»; рядом с ней стрелка не нужна.
    _wallTarget() {
        const g = this.game, p = g.player;
        if (!p) return null;
        if (!this._buildings) this._buildings = this._scanBuildings();
        let best = null, bd = Infinity;
        for (const b of this._buildings) { const d = Math.hypot(b.x - p.pos.x, b.z - p.pos.z); if (d < bd) { bd = d; best = b; } }
        if (!best || bd < 4) return null;
        const g0 = (this.game.world.groundTop || 20) * this.game.world.vs;
        return { x: best.x, y: best.z, h: g0 + Math.min(2.2, Math.max(0.8, (best.top - g0) * 0.5)) };
    },

    // Центр и высота построек: колонки вокселей вокруг маркера, шаг 3 (один раз за обучение).
    _scanBuildings() {
        /** @type {{ x: number, z: number, top: number }[]} */
        const out = [];
        const g = this.game, w = g.world;
        try {
            const names = typeof GameMapBuild !== 'undefined' ? Object.keys(GameMapBuild.builders || {}) : [];
            const vs = w.vs, G = w.groundTop || 20, sp = g.marker('spawn');
            const marks = (g.map.objects || []).filter(o => o.kind === 'marker' && names.indexOf(String(o.name).replace(/-\d+$/, '')) >= 0);
            if (sp) marks.sort((a, b) => Math.hypot(a.x - sp.x, a.y - sp.y) - Math.hypot(b.x - sp.x, b.y - sp.y));
            // верх колонки вокселей (выше 0.8 м над землёй) или -1; шаг сетки 3 вокселя
            /** @type {Map<number, number>} */
            const memo = new Map();
            const colTop = (x, z) => {
                if (x < 0 || z < 0 || x >= w.sx || z >= w.sz) return -1;
                const key = x * 8192 + z;
                let t = memo.get(key);
                if (t === undefined) {
                    t = -1;
                    for (let y = Math.min(w.sy - 1, G + 90); y >= G + 8; y -= 3) if (w.get(x, y, z)) { t = y; break; }
                    memo.set(key, t);
                }
                return t;
            };
            for (const mk of marks.slice(0, 12)) {
                // связная постройка: от колонок у маркера (его угол) вширь по высоким колонкам
                const cx = Math.round(mk.x / 10), cz = Math.round(mk.y / 10);
                /** @type {number[][]} */
                const queue = [];
                const seen = new Set();
                for (let dz = -6; dz <= 6; dz += 3) for (let dx = -6; dx <= 6; dx += 3) {
                    const x = cx + dx, z = cz + dz;
                    if (colTop(x, z) >= 0 && !seen.has(x * 8192 + z)) { seen.add(x * 8192 + z); queue.push([x, z]); }
                }
                let sx = 0, sz = 0, n = 0, top = 0;
                while (queue.length && n < 4000) {
                    const [x, z] = /** @type {number[]} */ (queue.pop());
                    sx += x; sz += z; n++; top = Math.max(top, colTop(x, z));
                    for (const [ox, oz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
                        const nx = x + ox, nz = z + oz, key = nx * 8192 + nz;
                        if (seen.has(key) || Math.abs(nx - cx) > 220 || Math.abs(nz - cz) > 220 || colTop(nx, nz) < 0) continue;
                        seen.add(key); queue.push([nx, nz]);
                    }
                }
                if (n > 2) out.push({ x: (sx / n + 0.5) * vs, z: (sz / n + 0.5) * vs, top: top * vs });
                else out.push({ x: (cx + 0.5) * vs, z: (cz + 0.5) * vs, top: (G + 20) * vs });
            }
        } catch (e) { console.warn('GameHud: постройки для обучения', e); }
        return out;
    },
};
