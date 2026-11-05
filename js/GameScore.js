// GameScore.js — Rubble Lab: цель «нанеси максимальный ущерб». Счёт ущерба по событиям VoxDestruction.on
// (цена материала × число вокселей × комбо), процент «снесено» от стоимости карты, таймер раунда, звёзды,
// карточка уровня, итоги, выбор карты и сохранение (Game.save.levels). Живой счётчик — блок HudLayout 'rl-score'.
//
// Публично: GameScore.active (true, пока открыт любой экран GameScore — HUD и пауза игры уступают им),
// openLevels() / closeLevels(), showIntro(), startRound(), info() (стоимость карты и пороги — для настройки); ?unlock=1 в адресе открывает все карты; состояние: state, level, damage, percent, stars, timeLeft, combo.
// state: 'idle' (челлендж-карта ждёт карточки) | 'intro' | 'playing' | 'free' (песочница) | 'ending' (замедление
// после конца времени) | 'results' | 'levels' (выбор карты поверх прежнего состояния).
// Вид — токены GameHud (--gh-*: графит, сигнальный жёлтый, тёплый белый, Rubik, полосы опасности), запасные значения в CSS.

/** @typedef {{ id: string, ru: string, en: string, time: number, stars: number[], sandbox?: boolean, adhoc?: boolean }} ScoreLevel */

// ====================================================================================================
// Данные
// ====================================================================================================

/**
 * Карты по порядку. time — секунд на раунд (0 — без таймера), stars — пороги 1/2/3 звёзд в % «снесено»
 * (от стоимости карты, GameScore.tune.full). Карты, которых нет в GAME_MAPS, в выборе помечены «Скоро».
 * @type {ScoreLevel[]}
 */
const SCORE_LEVELS = [
    { id: 'test-lab', ru: 'Полигон', en: 'Test Lab', time: 0, stars: [15, 35, 60], sandbox: true },
    { id: 'farm', ru: 'Ферма', en: 'Farm', time: 150, stars: [15, 35, 60] },
    { id: 'suburb', ru: 'Пригород', en: 'Suburb', time: 180, stars: [12, 30, 55] },
    { id: 'gas-station', ru: 'АЗС', en: 'Gas Station', time: 150, stars: [20, 40, 65] },
    { id: 'construction', ru: 'Стройка', en: 'Construction', time: 180, stars: [12, 30, 55] },
    { id: 'factory', ru: 'Завод', en: 'Factory', time: 210, stars: [12, 28, 50] },
    { id: 'docks', ru: 'Порт', en: 'Docks', time: 210, stars: [10, 26, 48] },
    { id: 'downtown', ru: 'Центр города', en: 'Downtown', time: 240, stars: [8, 22, 42] },
    { id: 'village', ru: 'Деревня', en: 'Village', time: 200, stars: [12, 30, 55] },
    { id: 'desert', ru: 'Пустыня', en: 'Desert', time: 200, stars: [12, 28, 50] },
];

/**
 * Цена одного вокселя ($) по ключу материала VoxMat. Земля почти бесплатна — кратеры не фармят очки.
 * Материал без записи стоит 1.
 * @type {Record<string, number>}
 */
const SCORE_VALUE = {
    bedrock: 0, dirt: 0.05, grass: 0.08, sand: 0.05, rock: 0.2, asphalt: 0.4, leaves: 0.4, foam: 0.5,
    plaster: 1.5, plaster2: 1.5, blue: 1.5,
    wood: 2, plank: 2, darkwood: 2.2, lamp: 2, crate: 2.5, roof: 2.5, tile: 2.5, mortar: 2.5,
    brick: 3, brick2: 3, glass: 3,
    concrete: 4, concrete2: 4,
    rust: 5, metal: 6, hazard: 6,
    barrel: 12,
};

/** Числа счёта и раунда (правятся здесь). */
const SCORE_TUNE = {
    bodyShare: 0.3,     // доля цены вокселей оторвавшегося куска: он ещё существует, просто сдвинулся
    full: 0.65,         // какая доля суммы цен всей карты и есть «снесено всё» (100%)
    window: 1.2,        // с: удары чаще этого окна растят комбо
    hitMin: 120,        // $ базовой цены в одном событии, чтобы оно считалось ударом для комбо
    hitGap: 0.25,       // с: не чаще одного удара в комбо (события одного взрыва — один удар)
    step: 0.5,          // прибавка множителя за удар
    maxSteps: 4,        // ×1 + 4·0.5 = ×3
    decay: 2.5,         // шагов комбо в секунду, когда окно кончилось
    popMin: 40,         // $: меньше — «+$» над местом не рисуется
    popEvery: 0.18,     // с: события склеиваются в одну цифру
    popLife: 1.15,      // с жизни цифры
    popPool: 10,        // одновременно цифр на экране
    endSlow: 1.7,       // с замедления между концом времени и итогами
    warnSec: 10,        // с до конца: красный таймер, виньетка, тики
    countUp: 1.2,       // с набегания суммы в итогах
    rate: 9000,         // $/с: сколько базовой цены за раунд успевает хороший игрок (взрывы, обвалы) — для порогов больших карт
    capShare: [0.25, 0.55, 0.85],   // какую долю этого потолка могут требовать 1, 2 и 3 звезды
};

/** Пиксельная звезда для SVG: viewBox 24. */
const SCORE_STAR_PATH = 'M12 1.6l3.1 6.9 7.5.8-5.6 5.1 1.6 7.4L12 18l-6.6 3.8 1.6-7.4L1.4 9.3l7.5-.8z';
const SCORE_LOCK_PATH = 'M7 10V7a5 5 0 0 1 10 0v3h1.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5v-9A1.5 1.5 0 0 1 5.5 10Zm2.6 0h4.8V7a2.4 2.4 0 0 0-4.8 0Z';

const SCORE_CSS = `
#rl-hudlayer,#rl-screens{--k-ink:var(--gh-ink,#15171a);--k-char:var(--gh-char,#1f2226);--k-char2:var(--gh-char2,#2c3036);--k-line:var(--gh-line,#3b4048);--k-steel:var(--gh-steel,#8b929c);--k-paper:var(--gh-paper,#f2ecdb);--k-yel:var(--gh-yel,#ffc61a);--k-yel2:var(--gh-yel2,#ffe07a);--k-yeld:var(--gh-yeld,#a97c00);--k-red:var(--gh-red,#ff5b2e);--k-font:var(--gh-font,'Rubik','Arial Narrow','Segoe UI',system-ui,sans-serif);--k-haz:var(--gh-haz,repeating-linear-gradient(-45deg,#ffc61a 0 9px,#15171a 9px 18px));--k-out:var(--gh-out,0 1px 0 #000,0 -1px 0 #000,1px 0 0 #000,-1px 0 0 #000,1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,0 3px 6px rgba(0,0,0,.5));font-family:var(--k-font);color:var(--k-paper);-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}
#rl-hudlayer *,#rl-screens *{box-sizing:border-box}
#rl-hudlayer [hidden],#rl-screens [hidden]{display:none!important}
#rl-hudlayer{position:fixed;inset:0;z-index:45;pointer-events:none;overflow:hidden}
.gh-paused #rl-hudlayer{visibility:hidden}
#rl-screens{position:fixed;inset:0;z-index:850;pointer-events:none}

/* ---- живой счётчик ---- */
.rl-hin{width:calc(100% / var(--hl-k,1));height:76px;transform:scale(var(--hl-k,1));transform-origin:0 0;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;column-gap:12px;row-gap:7px;align-content:center;align-items:center;padding:12px 12px 8px;background-color:rgba(31,34,38,.9);border:2px solid var(--k-ink);border-radius:4px;box-shadow:inset 0 0 0 2px var(--k-line),4px 4px 0 rgba(0,0,0,.5);position:relative;overflow:hidden}
.rl-hin::before{content:'';position:absolute;left:0;right:0;top:0;height:5px;background:var(--k-haz)}
.rl-m{display:flex;align-items:center;gap:9px;min-width:0}
.rl-mv{font:900 29px/1 var(--k-font);color:var(--k-yel);font-variant-numeric:tabular-nums;letter-spacing:.01em;white-space:nowrap;text-shadow:2px 2px 0 rgba(0,0,0,.6)}
.rl-mv.bump{animation:rl-bump .22s ease-out}
.rl-cb{position:relative;flex:none;padding:3px 8px 4px;font:900 17px/1 var(--k-font);color:var(--k-ink);background:linear-gradient(90deg,var(--k-yel) var(--p,100%),#8a6a00 var(--p,100%));border-radius:3px;box-shadow:0 2px 0 rgba(0,0,0,.5);font-variant-numeric:tabular-nums}
.rl-cb.pop{animation:rl-cpop .3s cubic-bezier(.2,1.8,.4,1)}
.rl-tm{text-align:right;min-width:3.4em}
.rl-time{display:block;font:900 26px/1 var(--k-font);font-variant-numeric:tabular-nums;color:var(--k-paper);text-shadow:2px 2px 0 rgba(0,0,0,.6)}
.rl-time.warn{color:var(--k-red);animation:rl-warn .5s steps(2) infinite}
.rl-tl{display:block;font:800 11px/1.1 var(--k-font);letter-spacing:.14em;text-transform:uppercase;color:var(--k-steel)}
.rl-bar{grid-column:1 / -1;display:flex;align-items:center;gap:9px;min-width:0}
.rl-track{position:relative;flex:1;height:14px;min-width:60px;background:#0c0d0f;border:2px solid var(--k-line);border-radius:2px}
.rl-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:repeating-linear-gradient(-45deg,var(--k-yel) 0 8px,#d29a00 8px 16px);-webkit-mask-image:repeating-linear-gradient(90deg,#000 0 7px,transparent 7px 9px);mask-image:repeating-linear-gradient(90deg,#000 0 7px,transparent 7px 9px);transition:width .2s linear}
.rl-tick{position:absolute;top:50%;width:19px;height:19px;margin:0;transform:translate(-50%,-50%);color:#4b525b;line-height:0}
.rl-tick svg{width:100%;height:100%;fill:currentColor;stroke:var(--k-ink);stroke-width:1.8;stroke-linejoin:round;paint-order:stroke;overflow:visible}
.rl-tick.hit{color:var(--k-yel);animation:rl-tpop .3s cubic-bezier(.2,1.8,.4,1)}
.rl-pc{min-width:3.1em;text-align:right;font:900 15px/1 var(--k-font);font-variant-numeric:tabular-nums;color:var(--k-paper)}
.rl-sb .rl-tick{display:none}
#rl-pops{position:absolute;inset:0;pointer-events:none}
.rl-pop{position:absolute;left:0;top:0;white-space:nowrap;font:900 20px/1 var(--k-font);color:var(--k-yel);text-shadow:var(--k-out);opacity:0;will-change:transform,opacity;font-variant-numeric:tabular-nums}
.rl-pop i{font-style:normal;color:var(--k-paper);margin-left:.3em}
.rl-cflash{position:absolute;left:50%;top:calc(var(--hl-rl-score-y,12px) + var(--hl-rl-score-h,76px) + 14px);transform:translateX(-50%);font:900 clamp(22px,4.2vh,36px)/1 var(--k-font);letter-spacing:.1em;text-transform:uppercase;color:var(--k-yel);text-shadow:var(--k-out);white-space:nowrap;pointer-events:none;animation:rl-cfl .9s ease-out forwards}
.rl-vig{position:absolute;inset:0;pointer-events:none;opacity:0;box-shadow:inset 0 0 140px 20px rgba(255,70,30,.6)}
.rl-vig.on{animation:rl-vig 1s ease-in-out infinite}
.rl-banner{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);max-width:92%;padding:.28em .8em .32em;text-align:center;font:900 clamp(26px,6.4vw,64px)/1.05 var(--k-font);letter-spacing:.07em;text-transform:uppercase;color:var(--k-ink);background:var(--k-yel);border:4px solid var(--k-ink);box-shadow:inset 0 0 0 3px var(--k-yel2),7px 7px 0 rgba(0,0,0,.55);animation:rl-slam .38s cubic-bezier(.2,1.7,.4,1)}

/* ---- экраны ---- */
.rl-screen{--rl-pad:clamp(8px,2vh,20px);position:absolute;inset:0;display:flex;padding:max(var(--rl-pad),env(safe-area-inset-top)) max(var(--rl-pad),env(safe-area-inset-right)) max(var(--rl-pad),env(safe-area-inset-bottom)) max(var(--rl-pad),env(safe-area-inset-left));overflow-x:hidden;overflow-y:auto;pointer-events:auto;font-family:var(--k-font);color:var(--k-paper);-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none;overscroll-behavior:contain;animation:rl-in .18s ease-out;touch-action:pan-y}
.rl-screen::before{content:'';position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(14,15,17,.55),rgba(14,15,17,.86))}
.rl-lv::before{background:linear-gradient(rgba(255,198,26,.05) 1px,transparent 1px) 0 0/44px 44px,linear-gradient(90deg,rgba(255,198,26,.05) 1px,transparent 1px) 0 0/44px 44px,rgba(16,17,19,.95)}
.rl-screen>*{position:relative}
.rl-panel{width:min(100%,520px);margin:auto;background-color:var(--k-char);border:2px solid var(--k-ink);border-radius:4px;box-shadow:inset 0 0 0 2px var(--k-line),6px 6px 0 rgba(0,0,0,.55);text-align:center;overflow:hidden}
.rl-ph{position:relative;padding:22px 22px 6px}
.rl-ph::before{content:'';position:absolute;left:0;right:0;top:0;height:9px;background:var(--k-haz)}
.rl-tag{display:inline-flex;align-items:center;gap:.7em;font:700 12px/1 var(--k-font);letter-spacing:.17em;text-transform:uppercase;color:var(--k-yel)}
.rl-tag::before{content:'';width:.85em;height:.85em;background:var(--k-yel)}
.rl-pb{padding:4px 22px clamp(14px,2.6vh,22px)}
.rl-name{margin:.12em 0 .12em;font:900 clamp(30px,6.4vh,46px)/1.02 var(--k-font);letter-spacing:.07em;text-transform:uppercase;color:var(--k-paper);text-shadow:3px 3px 0 var(--k-yel),5px 5px 0 rgba(0,0,0,.55);overflow-wrap:anywhere}
.rl-goal{margin:6px 0 14px;font:700 clamp(13px,2.3vh,17px)/1.25 var(--k-font);letter-spacing:.08em;text-transform:uppercase;color:var(--k-yel)}
.rl-facts{display:flex;flex-wrap:wrap;justify-content:center;gap:9px;margin-bottom:12px}
.rl-facts:empty{display:none}
.rl-fact{min-width:88px;padding:8px 12px 9px;background:#191b1f;border-radius:3px;box-shadow:inset 0 0 0 2px var(--k-line)}
.rl-fact .k{display:block;margin-bottom:6px;font:700 10px/1 var(--k-font);letter-spacing:.16em;text-transform:uppercase;color:var(--k-steel)}
.rl-fact b{display:block;font:900 24px/1 var(--k-font);font-variant-numeric:tabular-nums;color:var(--k-paper)}
.rl-fact.on b{color:var(--k-yel)}
.rl-sts{display:inline-flex;gap:2px;vertical-align:middle;line-height:0}
.rl-s{width:20px;height:20px;color:#3b4048}
.rl-s svg{display:block;width:100%;height:100%;fill:currentColor;stroke:var(--k-ink);stroke-width:1.6;stroke-linejoin:round;paint-order:stroke;overflow:visible}
.rl-s.on{color:var(--k-yel)}
.rl-fact .rl-sts{margin-bottom:4px}
.rl-fact .rl-s{width:15px;height:15px}
.rl-bestl{margin:0 0 14px;font:700 13px/1.2 var(--k-font);letter-spacing:.08em;text-transform:uppercase;color:#c4c9d1;display:flex;align-items:center;justify-content:center;gap:.7em;flex-wrap:wrap}
.rl-bestl b{color:var(--k-yel);font-weight:900;font-variant-numeric:tabular-nums}
.rl-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:12px 14px;padding-bottom:6px}
.rl-btn{appearance:none;-webkit-appearance:none;border:0;margin:0;display:inline-flex;align-items:center;justify-content:center;gap:.6em;min-height:48px;padding:0 24px;border-radius:4px;background:var(--k-yel);color:var(--k-ink);font:800 clamp(15px,2.3vh,19px)/1.1 var(--k-font);letter-spacing:.07em;text-transform:uppercase;text-align:center;cursor:pointer;box-shadow:0 5px 0 var(--k-yeld),0 7px 0 rgba(0,0,0,.5);transition:transform .06s,box-shadow .06s,filter .12s;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.rl-btn:hover{filter:brightness(1.08)}
.rl-btn:active{transform:translateY(4px);box-shadow:0 1px 0 var(--k-yeld),0 3px 0 rgba(0,0,0,.5)}
.rl-btn:focus-visible{outline:3px solid var(--k-paper);outline-offset:3px}
.rl-btn.alt{background:var(--k-char2);color:var(--k-paper);box-shadow:inset 0 0 0 2px #4b525b,0 5px 0 #0e1012,0 7px 0 rgba(0,0,0,.5)}
.rl-btn.alt:active{box-shadow:inset 0 0 0 2px #4b525b,0 1px 0 #0e1012,0 3px 0 rgba(0,0,0,.5)}
.rl-btn.big{min-height:clamp(54px,9vh,68px);padding:0 clamp(28px,4vw,46px);font-size:clamp(19px,3.4vh,26px);letter-spacing:.09em}
.rl-btn[disabled]{opacity:.45;cursor:not-allowed;filter:none}
.rl-btn svg{width:1.05em;height:1.05em;fill:currentColor}
.rl-hintk{margin-top:12px;font:600 12px/1 var(--k-font);letter-spacing:.1em;text-transform:uppercase;color:var(--k-steel)}
.hl-touch .rl-hintk{display:none}
/* итоги */
.rl-big{margin:.1em 0 0;font:900 clamp(26px,5.6vh,40px)/1 var(--k-font);letter-spacing:.08em;text-transform:uppercase;color:var(--k-paper);text-shadow:3px 3px 0 var(--k-yel),5px 5px 0 rgba(0,0,0,.55)}
.rl-stars{display:flex;justify-content:center;gap:clamp(6px,2vw,14px);margin:clamp(6px,1.6vh,14px) 0 clamp(4px,1vh,10px)}
.rl-st{width:clamp(46px,16vh,78px);aspect-ratio:1;color:#2c3036;transform:rotate(var(--r,0deg)) scale(.82);opacity:.9}
.rl-st:nth-child(2){margin-top:-8px;--r:0deg}
.rl-st:nth-child(1){--r:-9deg}
.rl-st:nth-child(3){--r:9deg}
.rl-st svg{display:block;width:100%;height:100%;fill:currentColor;stroke:var(--k-line);stroke-width:1.2;stroke-linejoin:round;paint-order:stroke;overflow:visible;filter:drop-shadow(0 3px 0 rgba(0,0,0,.5))}
.rl-st.on{color:var(--k-yel);opacity:1;animation:rl-star .55s cubic-bezier(.2,1.8,.4,1) both;animation-delay:var(--d,0s)}
.rl-st.on svg{stroke:var(--k-ink);stroke-width:1.5}
.rl-st.pending{animation:none;color:#2c3036;opacity:.9}
.rl-sc{display:flex;flex-direction:column;align-items:center;gap:6px;margin:2px 0 10px}
.rl-sc .k{font:700 11px/1 var(--k-font);letter-spacing:.17em;text-transform:uppercase;color:var(--k-steel)}
.rl-scv{font:900 clamp(38px,9.4vh,62px)/1 var(--k-font);color:var(--k-yel);font-variant-numeric:tabular-nums;text-shadow:3px 3px 0 rgba(0,0,0,.6)}
.rl-badge{display:inline-block;margin:0 0 10px;padding:6px 14px 7px;font:900 14px/1 var(--k-font);letter-spacing:.12em;text-transform:uppercase;color:var(--k-ink);background:var(--k-yel);border-radius:3px;box-shadow:0 3px 0 var(--k-yeld),0 5px 0 rgba(0,0,0,.4);animation:rl-slam2 .4s cubic-bezier(.2,1.7,.4,1)}
.rl-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px}
.rl-stats>div{padding:8px 6px 9px;background:#191b1f;border-radius:3px;box-shadow:inset 0 0 0 2px var(--k-line)}
.rl-stats span{display:block;margin-bottom:5px;font:700 10px/1.1 var(--k-font);letter-spacing:.12em;text-transform:uppercase;color:var(--k-steel)}
.rl-stats b{display:block;font:900 clamp(15px,2.6vh,20px)/1 var(--k-font);font-variant-numeric:tabular-nums;color:var(--k-paper);white-space:nowrap}
.rl-note{margin:0 0 12px;font:600 13px/1.3 var(--k-font);letter-spacing:.04em;color:#c4c9d1}
/* выбор карты */
.rl-lv{align-items:flex-start}
.rl-lvw{width:min(100%,1000px);margin:auto}
.rl-lvh{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 16px;padding-top:4px}
.rl-lvh .rl-big{margin:0;font-size:clamp(24px,5vh,36px);flex:1 1 auto;text-align:left}
.rl-lvh .rl-tot{font:800 14px/1 var(--k-font);letter-spacing:.1em;text-transform:uppercase;color:var(--k-yel);display:flex;align-items:center;gap:.5em}
.rl-lvh .rl-tot .rl-s{width:20px;height:20px;color:var(--k-yel)}
.rl-back{min-height:42px;padding:0 18px;font-size:14px}
.rl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,208px),1fr));gap:14px;padding:2px 2px 14px}
.rl-lc{position:relative;appearance:none;-webkit-appearance:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;min-height:132px;text-align:left;color:var(--k-paper);font-family:var(--k-font);background-color:var(--k-char);border:2px solid var(--k-line);border-radius:4px;box-shadow:4px 4px 0 rgba(0,0,0,.5);overflow:hidden;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform .08s,box-shadow .08s,border-color .08s}
.rl-lc:hover:not([disabled]){border-color:var(--k-yel);transform:translateY(-2px);box-shadow:4px 6px 0 rgba(0,0,0,.5)}
.rl-lc:active:not([disabled]){transform:translateY(2px)}
.rl-lc:focus-visible{outline:3px solid var(--k-paper);outline-offset:3px}
.rl-lc.cur{border-color:var(--k-yel)}
.rl-lc[disabled]{cursor:not-allowed}
.rl-lc-top{display:flex;align-items:stretch;justify-content:space-between;gap:8px;min-height:30px}
.rl-num{padding:7px 10px 6px;font:900 15px/1 var(--k-font);letter-spacing:.08em;color:var(--k-ink);background:var(--k-yel);font-variant-numeric:tabular-nums}
.rl-lc-st{align-self:center;padding-right:10px;font:800 10px/1 var(--k-font);letter-spacing:.14em;text-transform:uppercase;color:var(--k-yel)}
.rl-lc-name{padding:0 12px;font:900 clamp(20px,3.2vh,26px)/1.05 var(--k-font);letter-spacing:.05em;text-transform:uppercase;overflow-wrap:anywhere}
.rl-lc-meta{padding:0 12px;font:600 12px/1.25 var(--k-font);letter-spacing:.05em;color:#b7bdc6}
.rl-lc-foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px 10px;border-top:2px solid var(--k-line);background:#191b1f}
.rl-lc-foot b{font:900 15px/1 var(--k-font);font-variant-numeric:tabular-nums;color:var(--k-yel);white-space:nowrap}
.rl-lc-foot b.none{color:var(--k-steel);font-weight:700}
.rl-lc.locked .rl-lc-name,.rl-lc.locked .rl-lc-meta,.rl-lc.soon .rl-lc-name,.rl-lc.soon .rl-lc-meta{opacity:.5}
.rl-lc.locked .rl-num,.rl-lc.soon .rl-num{background:#4b525b;color:var(--k-paper)}
.rl-lc.soon{border-style:dashed;border-color:#3b4048;box-shadow:none;background:transparent}
.rl-lc.soon .rl-lc-foot{background:transparent}
.rl-lc-lock{display:flex;align-items:center;gap:7px;color:var(--k-steel);font:700 11px/1.2 var(--k-font);letter-spacing:.04em}
.rl-lc-lock svg{flex:none;width:18px;height:18px;fill:currentColor}
@keyframes rl-in{from{opacity:0}}
@keyframes rl-bump{50%{transform:scale(1.1)}}
@keyframes rl-cpop{0%{transform:scale(.6)}100%{transform:scale(1)}}
@keyframes rl-tpop{0%{transform:translate(-50%,-50%) scale(.5)}100%{transform:translate(-50%,-50%) scale(1)}}
@keyframes rl-warn{50%{opacity:.55}}
@keyframes rl-cfl{0%{opacity:0;transform:translate(-50%,10px) scale(.7)}18%{opacity:1;transform:translate(-50%,0) scale(1.08)}30%{transform:translate(-50%,0) scale(1)}100%{opacity:0;transform:translate(-50%,-26px) scale(1)}}
@keyframes rl-vig{0%,100%{opacity:.15}50%{opacity:.85}}
@keyframes rl-slam{0%{opacity:0;transform:translate(-50%,-50%) scale(1.8)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes rl-slam2{0%{opacity:0;transform:scale(1.7)}100%{opacity:1;transform:scale(1)}}
@keyframes rl-star{0%{opacity:0;transform:rotate(var(--r,0deg)) scale(2.3)}100%{opacity:1;transform:rotate(var(--r,0deg)) scale(1)}}
/* ---- рекорды ---- */
.rl-lbt{list-style:none;margin:4px 0 14px;padding:0;max-height:min(50vh,430px);overflow:auto;text-align:left}
.rl-lbt li{display:grid;grid-template-columns:2.2em 34px minmax(0,1fr) auto;align-items:center;gap:10px;padding:7px 10px;border-bottom:1px solid var(--k-line);font:700 16px/1.2 var(--k-font)}
.rl-lbt li.me{background:rgba(255,198,26,.14);box-shadow:inset 3px 0 0 var(--k-yel)}
.rl-lbt .n{font-weight:900;color:var(--k-yel);text-align:right;font-variant-numeric:tabular-nums}
.rl-lbt img,.rl-lbt i{width:34px;height:34px;border-radius:50%;background:var(--k-char2);object-fit:cover;display:block}
.rl-lbt .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rl-lbt b{font-variant-numeric:tabular-nums;color:var(--k-paper);white-space:nowrap}
.rl-lbin{margin:0 auto 14px}
@media (max-height:470px){
.rl-lbt{max-height:42vh}.rl-lbt li{padding:4px 8px;font-size:14px}
.rl-ph{padding:18px 18px 2px}.rl-pb{padding:2px 18px 12px}.rl-name{font-size:28px}.rl-goal{margin:4px 0 8px;font-size:13px}
.rl-fact{min-width:78px;padding:6px 10px 7px}.rl-fact b{font-size:20px}.rl-facts{margin-bottom:8px}.rl-bestl{margin-bottom:8px}
.rl-hintk{display:none}.rl-btn{min-height:42px}.rl-btn.big{min-height:48px;font-size:19px}
.rl-stars{margin:4px 0 2px}.rl-st{width:44px}.rl-scv{font-size:36px}.rl-stats{margin-bottom:6px}.rl-note{margin-bottom:8px}
.rl-grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,176px),1fr));gap:10px}.rl-lc{min-height:104px}.rl-lc-name{font-size:19px}
}
/* совсем низкое окно (телефон 568×320): результаты целиком без прокрутки */
@media (max-height:340px){.rl-ph{padding:10px 16px 0}.rl-pb{padding-bottom:8px}.rl-big{font-size:22px}.rl-stars{margin:0}.rl-st{width:34px}.rl-scv{font-size:28px}.rl-stats{margin-bottom:4px}.rl-note{margin-bottom:6px}}
@media (max-width:480px){
.rl-grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,148px),1fr));gap:10px}
.rl-lc{min-height:112px}.rl-lc-name{font-size:18px;padding:0 9px}.rl-lc-meta{padding:0 9px;font-size:11px}.rl-lc-foot{padding:7px 9px 8px}.rl-lc-foot b{font-size:13px}.rl-num{font-size:13px;padding:6px 8px 5px}.rl-lc-lock{font-size:10px}
.rl-facts{gap:6px}.rl-fact{min-width:0;flex:1 1 0;padding:6px 3px 7px}.rl-fact b{font-size:18px}.rl-pb{padding-left:14px;padding-right:14px}
}
@media (max-width:420px){.rl-actions .rl-btn{flex:1 1 100%}.rl-panel{width:100%}}
@media (prefers-reduced-motion:reduce){.rl-screen,.rl-banner,.rl-badge,.rl-cb.pop,.rl-tick.hit,.rl-st.on,.rl-mv.bump,.rl-cflash,.rl-time.warn{animation:none}.rl-st.on{opacity:1;transform:rotate(var(--r,0deg))}.rl-vig.on{animation:none;opacity:.35}}
`;

// ====================================================================================================
// Модуль
// ====================================================================================================

/** @satisfies {Record<string, any>} */
const GameScore = {
    levels: SCORE_LEVELS,
    values: SCORE_VALUE,
    tune: SCORE_TUNE,

    /** @type {any} */
    game: null,
    /** @type {ScoreLevel | null} */
    level: null,
    /** idle | intro | playing | free | ending | results | levels */
    state: 'idle',

    // --- раунд ---
    damage: 0,          // $ с комбо
    raw: 0,             // $ без комбо — от него процент
    total: 1,           // стоимость карты (сумма цен вокселей над землёй и всех тел)
    percent: 0,         // 0..100 «снесено»
    stars: 0,           // звёзд по текущему проценту
    /** Пороги звёзд текущей карты, %: таблица, но не выше достижимого за время раунда (_calcStars). */
    th: [15, 35, 60],
    timeLeft: 0,
    combo: 1,
    maxCombo: 1,
    t: 0,               // время игры (с, без пауз)
    _steps: 0,
    _comboT: 0,
    _hitT: -9,
    _endT: 0,
    _endReason: 'time',
    _scrT: 0,           // реальное время с открытия экрана (защита от случайных нажатий)
    _tickSec: -1,
    _ready: false,
    _unlockAll: false,
    _synthOk: false,
    _lastPost: 0,
    _shown: 0,
    _hudOn: false,
    _inputOff: false,

    // --- выбор карты ---
    /** @type {{ state: string, paused: boolean, controls: boolean } | null} */
    _lvPrev: null,

    // --- данные ---
    /** @type {Float32Array} */
    val: new Float32Array(128),

    // --- DOM ---
    /** @type {Record<string, any>} */
    ui: {},
    /** @type {Record<string, any>} */
    scr: {},
    /** @type {HTMLElement | null} */
    hudLayer: null,
    /** @type {HTMLElement | null} */
    screens: null,

    // --- цифры «+$» ---
    /** @type {any[]} */
    _pops: [],
    /** @type {any[]} */
    _popFree: [],
    _pend: { v: 0, x: 0, y: 0, z: 0, m: 1 },
    _popT: 0,
    /** @type {BABYLON.Vector3 | null} */
    _pv: null,
    /** @type {BABYLON.Vector3 | null} */
    _po: null,
    /** @type {{ t: number, to: number, el: any } | null} */
    _cu: null,
    /** @type {any[]} */
    _timers: [],

    // =====================================================================================
    // Запуск
    // =====================================================================================

    /** Game.init зовёт после GameTools и перед GameHud. */
    init(game) {
        if (this._ready) return;
        this.game = game;
        const q = new URLSearchParams(location.search);
        this._unlockAll = q.get('unlock') === '1';
        const go = q.has('go');          // как у GameHud: ?go в адресе — экран «Играть» не нужен, карточку показываю я
        this._buildValues();
        const id = game.map && game.map.id;
        this.level = this.levelById(id) || this._adhoc(game.map);
        try { this.total = Math.max(1, this._scanTotal()); } catch (e) { console.warn('GameScore: стоимость карты:', e); this.total = 1; }
        this._calcStars();
        this._injectCss();
        this._buildHud();
        this._buildScreens();
        this._setLevelUi();
        if (typeof HudLayout !== 'undefined') {
            HudLayout.init({ app: game.app });
            HudLayout.block('rl-score', { dock: 'tc', w: 380, h: 76, el: '#rl-hud', order: 0, minW: 250 });
        }
        if (typeof VoxDestruction !== 'undefined') VoxDestruction.on(e => this._onDamage(e));
        try { if (typeof Platform !== 'undefined' && Platform.ads && game.save) Platform.ads.results = Math.max(Platform.ads.results, game.save.adRounds | 0); } catch (e) { /* без площадки */ }
        this._lastPost = performance.now();
        const sc = typeof VoxRender !== 'undefined' ? VoxRender.scene : null;
        if (sc) sc.onAfterRenderObservable.add(() => this._post());
        else if (game.app) game.app.onFrame(dt => this._post());
        window.addEventListener('keydown', e => this._onKey(e));
        window.addEventListener('lory-language', () => this._langChanged());
        this._resetRound();
        // ?go=1 — игрок выбрал карту: карточка уровня сразу. Песочница без go сразу свободна; челлендж без go ждёт
        // (экран «Играть» GameHud или первый кадр без паузы — update покажет карточку).
        if (go) this.showIntro();
        else this.state = this.level.sandbox ? 'free' : 'idle';
        this._ready = true;
    },

    /** true, пока открыт любой экран GameScore (карточка, замедление конца, итоги, выбор карты). */
    get active() {
        const s = this.state;
        return s === 'intro' || s === 'ending' || s === 'results' || s === 'levels';
    },

    // =====================================================================================
    // Данные: уровни, сохранение, цены
    // =====================================================================================

    levelById(id) { return this.levels.find(l => l.id === id) || null; },

    /** Карта неизвестного id (не из таблицы): песочница с её названием. */
    _adhoc(map) {
        const name = String((map && (map.name || map.id)) || 'Map');
        return { id: String(map && map.id || 'none'), ru: name, en: name, time: 0, stars: [15, 35, 60], sandbox: true, adhoc: true };
    },

    /** Карта есть в GAME_MAPS (иначе в выборе «Скоро»). */
    available(id) {
        const maps = typeof GAME_MAPS !== 'undefined' && Array.isArray(GAME_MAPS) ? GAME_MAPS : [];
        return maps.some(m => m && m.id === id);
    },

    /** Ближайший раньше по списку не-песочный уровень, который есть в игре. */
    _prevChallenge(i) {
        for (let j = i - 1; j >= 0; j--) {
            const l = this.levels[j];
            if (!l.sandbox && this.available(l.id)) return l;
        }
        return null;
    },

    /** Открыта ли карта: песочница и первая карта — всегда; дальше — звезда на предыдущей (?unlock=1 открывает всё). */
    unlocked(id) {
        if (this._unlockAll) return true;
        // с магазином карты открываются за рекламу или деньги (GameShop), а не звёздами
        if (typeof GameShop !== 'undefined' && GameShop.game) return GameShop.owns('map:' + id);
        const i = this.levels.findIndex(l => l.id === id);
        if (i < 0) return false;
        if (this.levels[i].sandbox) return true;
        const p = this._prevChallenge(i);
        return !p || this.starsOf(p.id) >= 1;
    },

    /** Следующая по списку не-песочная карта, которая есть в игре. */
    nextLevel() {
        const i = this.levels.findIndex(l => l.id === (this.level && this.level.id));
        for (let j = i + 1; j < this.levels.length; j++) {
            const l = this.levels[j];
            if (!l.sandbox && this.available(l.id)) return l;
        }
        return null;
    },

    _saved() {
        const s = this.game.save;
        if (!s.levels || typeof s.levels !== 'object') s.levels = {};
        return s.levels;
    },
    bestOf(id) { const r = this._saved()[id]; return { best: (r && r.best) || 0, stars: (r && r.stars) || 0 }; },
    starsOf(id) { return this.bestOf(id).stars; },
    totalStars() { let n = 0; for (const l of this.levels) if (!l.sandbox) n += this.starsOf(l.id); return n; },
    maxStars() { return this.levels.filter(l => !l.sandbox).length * 3; },

    /** Звёзды за процент по порогам текущей карты. */
    starsFor(pct) {
        const th = this.th;
        let n = 0;
        for (let i = 0; i < th.length; i++) if (pct >= th[i]) n = i + 1;
        return n;
    },

    /** Цена вокселя по байту материала (Float32Array 128). */
    _buildValues() {
        this.val.fill(1);
        for (const m of VoxMat.list) {
            const v = SCORE_VALUE[m.key];
            this.val[m.id & 127] = v != null ? v : 1;
        }
    },

    /** Стоимость карты: воксели мира выше земли + тела (чанки без вокселей пропускаются). */
    _scanTotal() {
        const w = this.game.world, val = this.val, data = w.data, n = VOX_CH;
        const G = typeof GameMapBuild !== 'undefined' ? GameMapBuild.GROUND : 20;
        let sum = 0;
        for (let cy = 0; cy < w.cy; cy++) {
            const y0 = cy * n;
            if (y0 + n <= G) continue;
            const ys = Math.max(y0, G), ye = y0 + n;
            for (let cz = 0; cz < w.cz; cz++) for (let cx = 0; cx < w.cx; cx++) {
                if (!w.chunkSolid[cx + cz * w.cx + cy * w.cx * w.cz]) continue;
                for (let y = ys; y < ye; y++) for (let z = cz * n; z < cz * n + n; z++) {
                    const base = (z << w.bx) + (y << w.by) + cx * n;
                    for (let x = 0; x < n; x++) { const v = data[base + x]; if (v) sum += val[v & 127]; }
                }
            }
        }
        if (typeof VoxPhysics !== 'undefined') for (const b of VoxPhysics.bodies) if (!b.dead) sum += this._bodyValue(b);
        return sum;
    },

    /** Сумма цен вокселей тела. */
    _bodyValue(b) {
        const g = b.grid, val = this.val;
        let s = 0;
        for (let i = 0; i < g.length; i++) { const v = g[i]; if (v) s += val[v & 127]; }
        return s;
    },

    /**
     * Пороги звёзд текущей карты: из таблицы, но не выше того, что реально успеть за время раунда, —
     * огромная карта не делает 3 звезды недостижимыми (потолок: SCORE_TUNE.rate × время, доли capShare).
     */
    _calcStars() {
        const L = this.level, T = SCORE_TUNE;
        const th = L.stars.slice();
        if (!L.sandbox && L.time > 0) {
            const cap = T.rate * L.time / (this.total * T.full) * 100;
            for (let i = 0; i < 3; i++) th[i] = Math.max(1, Math.min(th[i], Math.round(cap * T.capShare[i])));
            for (let i = 1; i < 3; i++) if (th[i] <= th[i - 1]) th[i] = th[i - 1] + 1;
        }
        this.th = th.map(v => Math.min(100, v));
    },

    /** Для настройки карт (консоль): стоимость, цена «снесено всё», пороги из таблицы и действующие. */
    info() {
        const L = this.level, T = SCORE_TUNE;
        return {
            id: L.id, total: Math.round(this.total), hundredPercent: Math.round(this.total * T.full),
            table: L.stars.slice(), effective: this.th.slice(), time: L.time,
            ceilingRaw: Math.round(T.rate * L.time), explosionsFor100: Math.round(this.total * T.full / 20000),
        };
    },

    // =====================================================================================
    // Ущерб
    // =====================================================================================

    _counting() { const s = this.state; return s === 'playing' || s === 'free' || s === 'ending'; },

    _onDamage(e) {
        if (!this._counting()) return;
        if (e.type === 'removed') {
            let raw = 0;
            for (const [m, c] of e.counts) raw += this.val[m & 127] * c;
            this._add(raw, e.x, e.y, e.z, e.cause);
        } else if (e.type === 'body' && e.body) {
            const b = e.body;
            this._add(this._bodyValue(b) * SCORE_TUNE.bodyShare, b.x[0], b.x[1], b.x[2], 'body');
        }
    },

    /** Начислить базовую цену raw: комбо растят удары не реже окна, огонь комбо не растит. */
    _add(raw, x, y, z, cause) {
        if (!(raw > 0)) return;
        const T = SCORE_TUNE;
        const fire = cause === 'fire';
        if (!fire && raw >= T.hitMin) {
            const chain = this._comboT > 0 || this._steps > 0;
            this._comboT = T.window;
            if (chain && this.t - this._hitT >= T.hitGap) this._bump();
            this._hitT = this.t;
        }
        const mult = fire ? Math.min(this.combo, 1.5) : this.combo;
        const d = raw * mult;
        this.raw += raw;
        this.damage += d;
        this.percent = Math.min(100, this.raw / (this.total * T.full) * 100);
        this.stars = this.level.sandbox ? 0 : this.starsFor(this.percent);
        const p = this._pend;
        p.v += d; p.x += x * d; p.y += y * d; p.z += z * d; if (mult > p.m) p.m = mult;
    },

    _bump() {
        const T = SCORE_TUNE, before = this.combo;
        this._steps = Math.min(T.maxSteps, Math.floor(this._steps) + 1);
        this._setCombo();
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        if (this.combo > before) this._comboFlash(true);
    },

    _setCombo() { this.combo = 1 + Math.floor(this._steps + 1e-6) * SCORE_TUNE.step; },

    _comboTick(dt) {
        if (this._comboT > 0) { this._comboT -= dt; return; }
        if (this._steps > 0) {
            this._steps = Math.max(0, this._steps - SCORE_TUNE.decay * dt);
            this._setCombo();
        }
    },

    // =====================================================================================
    // Кадр логики (не на паузе)
    // =====================================================================================

    update(dt) {
        if (!this._ready) return;
        this.t += dt;
        const s = this.state;
        if (s === 'idle') { if (!this.level.sandbox) this.showIntro(); return; }
        if (s === 'playing' || s === 'free' || s === 'ending') this._comboTick(dt);
        if (s === 'playing') {
            // обучение не съедает время раунда
            if (typeof Tutorial === 'undefined' || !Tutorial.active) this.timeLeft = Math.max(0, this.timeLeft - dt);
            const sec = Math.ceil(this.timeLeft);
            if (sec !== this._tickSec) {
                this._tickSec = sec;
                if (sec > 0 && sec <= SCORE_TUNE.warnSec) this._sfx('tick', sec <= 3 ? 1.35 : 1);
            }
            if (this.timeLeft <= 0) this._endRound('time');
            else if (this.percent >= 100) this._endRound('all');
        } else if (s === 'ending') {
            this._endT += dt;
            if (this._endT >= SCORE_TUNE.endSlow) this._showResults();
        }
        if (s === 'playing' || s === 'free' || s === 'ending') {
            this._popT -= dt;
            if (this._popT <= 0) { this._popT = SCORE_TUNE.popEvery; this._flushPop(); }
        }
    },

    // =====================================================================================
    // Раунд
    // =====================================================================================

    _resetRound() {
        this.damage = 0; this.raw = 0; this.percent = 0; this.stars = 0;
        this.combo = 1; this.maxCombo = 1; this._steps = 0; this._comboT = 0; this._hitT = -9;
        this.timeLeft = this.level.sandbox ? 0 : this.level.time;
        this._shown = 0; this._tickSec = -1; this._endT = 0;
        this._pend.v = 0; this._pend.x = 0; this._pend.y = 0; this._pend.z = 0; this._pend.m = 1;
        for (const p of this._pops.splice(0)) this._releasePop(p);
    },

    /** Карточка уровня: имя, цель, время, пороги звёзд, рекорд; «Начать» запускает раунд. */
    showIntro() {
        if (!this.level) return;
        if (this.state === 'intro') return;
        this._closeScreen('res');
        this._closeScreen('lv');
        this._lvPrev = null;
        this._resetRound();
        this.state = 'intro';
        Pause.set('manual', true);
        this._menuInput(true);
        this._screen('intro', this._introHtml(), 'rl-intro');
        const go = this.scr.intro.querySelector('.rl-go');
        if (go) go.addEventListener('click', () => this.startRound());
        const lv = this.scr.intro.querySelector('.rl-lvbtn');
        if (lv) lv.addEventListener('click', () => { this._click(); this.openLevels(); });
        this._syncGameplay();
        this._setHud();
        if (go) try { go.focus({ preventScroll: true }); } catch (e) { /* нет фокуса */ }
    },

    /** «Начать»: снять паузу, захватить курсор, пошло время. */
    startRound() {
        if (this.state !== 'intro') return;
        this._closeScreen('intro');
        this._resetRound();
        this.state = this.level.sandbox ? 'free' : 'playing';
        this.game.slowmo = false;
        Pause.set('manual', false);
        this._menuInput(false);
        if (typeof Input !== 'undefined' && Input.capture) Input.capture();     // по жесту (клик «Начать» / Enter)
        this._syncGameplay();
        this._setHud();
        this._funnel('started');
    },

    /** Время вышло или снесено всё: замедление, ввод заморожен, потом итоги. */
    _endRound(reason) {
        if (this.state !== 'playing') return;
        this._flushPop();
        this.state = 'ending';
        this._endReason = reason;
        this._endT = 0;
        this.game.slowmo = true;
        this._freezeInput();
        this._banner(reason === 'all' ? Lang.t('score.allDown') : Lang.t('score.timeUp'));
        this._sfx(reason === 'all' ? 'star' : 'buzz', 1);
    },

    _showResults() {
        if (this.state !== 'ending') return;
        const L = this.level;
        const T = SCORE_TUNE;
        const dmg = Math.round(this.damage);
        const stars = this.stars;
        const prev = this.bestOf(L.id);
        const record = dmg > prev.best && dmg > 0;
        const rec = this._saved();
        rec[L.id] = { best: Math.max(prev.best, dmg), stars: Math.max(prev.stars, stars) };
        this.game.persist();
        try {
            if (typeof Platform !== 'undefined') {
                Platform.submitScore(dmg);
                if (Platform.ads) Platform.ads.roundEnded(stars >= 1, L.id);
            }
        } catch (e) { /* без площадки */ }
        this._lbCache = null;
        this.state = 'results';
        this._scrT = performance.now();
        this._banner(null);
        this.ui.vig.classList.remove('on');
        this._syncGameplay();
        this._setHud();
        this._menuInput(true);
        this._screen('res', this._resultsHtml(dmg, stars, record, prev, rec[L.id]), 'rl-res');
        const el = this.scr.res;
        const on = (sel, fn) => { const b = el.querySelector(sel); if (b) b.addEventListener('click', fn); };
        const next = fn => () => { this._click(); if (typeof Platform !== 'undefined' && Platform.ads) Platform.ads.next(fn); else fn(); };
        on('.rl-retry', next(() => this._go(L.id)));
        on('.rl-nextb', next(() => { const n = this.nextLevel(); if (n) this._go(n.id); }));
        on('.rl-lvbtn', next(() => this.openLevels()));
        on('.rl-lbb', () => { this._click(); this.openRecords(); });
        // звёзды по одной, сумма набегает
        const sts = el.querySelectorAll('.rl-st');
        sts.forEach((s, i) => {
            if (i < stars) this._later(450 + i * 480, () => { s.classList.remove('pending'); s.classList.add('on'); this._sfx('star', 1 + i * 0.22); });
        });
        this._cu = { t: 0, to: dmg, el: el.querySelector('.rl-scv') };
        const badge = el.querySelector('.rl-badge');
        if (badge) this._later(T.countUp * 1000 + 250, () => { badge.hidden = false; this._sfx('star', 1.5); });
        this._funnel(stars >= 1 ? 'completed' : 'failed');
        const first = el.querySelector('.rl-retry');
        if (first) try { first.focus({ preventScroll: true }); } catch (e) { /* нет фокуса */ }
    },

    /** Перейти на карту id: страница перезагружается с ?map=<id>&go=1 (карточка уровня сразу). */
    _go(id) {
        try { if (typeof Platform !== 'undefined' && Platform.ads && this.game.save) this.game.save.adRounds = Platform.ads.results; } catch (e) { /* без площадки */ }
        try {
            const u = new URL(location.href);
            u.searchParams.set('go', '1');
            history.replaceState(null, '', u.toString());
        } catch (e) { /* адрес не меняем */ }
        if (typeof this.game.loadLevel === 'function') this.game.loadLevel(id);
        else { const u = new URL(location.href); u.searchParams.set('map', id); location.href = u.toString(); }
    },

    _funnel(state) {
        try {
            if (typeof Telemetry !== 'undefined' && !this.level.adhoc) Telemetry.progress(state, 'level_' + this.level.id.replace(/-/g, '_'), state === 'started' ? undefined : { stars: this.stars });
        } catch (e) { /* аналитика не мешает игре */ }
    },

    /** Platform.gameplay: идёт ли игровой процесс сейчас (раунд или песочница без экранов). */
    _syncGameplay() {
        const s = this.state;
        const on = s === 'playing' || s === 'free' || s === 'ending';
        try { if (typeof Platform !== 'undefined') Platform.gameplay(on); } catch (e) { /* SDK без GameplayAPI */ }
    },

    // =====================================================================================
    // Ввод и курсор
    // =====================================================================================

    /** Меню: курсор свободен, экранные кнопки касаний скрыты (on) / вернуть управление (off). */
    _menuInput(on) {
        if (typeof Input === 'undefined') return;
        try {
            if (Input.configure) Input.configure({ controls: !on });
            if (on && Input.release) Input.release();
        } catch (e) { /* ввод не готов */ }
    },

    _freezeInput() {
        if (typeof Input === 'undefined' || this._inputOff) return;
        this._inputOff = true;
        try { Input.setEnabled(false); } catch (e) { /* ввод не готов */ }
    },

    _click() { try { if (typeof GameAudio !== 'undefined' && GameAudio.ui) GameAudio.ui('click'); } catch (e) { /* тишина */ } },

    _onKey(e) {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const s = this.state;
        if (s === 'levels' && e.code === 'Escape') { e.preventDefault(); this.closeLevels(); return; }
        if (s === 'intro' && (e.code === 'Enter' || e.code === 'NumpadEnter') && performance.now() - this._scrT > 250) {
            if (this.scr.intro && this.scr.intro.querySelector('.rl-lvbtn:focus')) return;
            e.preventDefault();
            this.startRound();
        }
    },

    // =====================================================================================
    // Выбор карты
    // =====================================================================================

    /** Открыть выбор карты поверх текущего состояния; игра на паузе. closeLevels() вернёт всё как было. */
    openLevels() {
        if (!this._ready || this.state === 'levels' || this.state === 'ending') return;
        const I = typeof Input !== 'undefined' ? Input : null;
        this._lvPrev = { state: this.state, paused: Pause.has('manual'), controls: !!(I && I.controls) };
        this.state = 'levels';
        for (const k of ['intro', 'res']) if (this.scr[k]) this.scr[k].hidden = true;
        Pause.set('manual', true);
        this._menuInput(true);
        this._syncGameplay();
        this._screen('lv', this._levelsHtml(), 'rl-lv');
        const el = this.scr.lv;
        const back = el.querySelector('.rl-back');
        if (back) back.addEventListener('click', () => { this._click(); this.closeLevels(); });
        el.addEventListener('click', ev => {
            const b = /** @type {HTMLElement} */ (ev.target).closest('.rl-lc');
            if (b && b.classList.contains('locked') && typeof GameShop !== 'undefined' && GameShop.game) { this._click(); GameShop.offer('map:' + b.getAttribute('data-id')); return; }
            if (ev.target && /** @type {HTMLElement} */ (ev.target).closest('.rl-shopb') && typeof GameShop !== 'undefined') { this._click(); GameShop.open('maps'); return; }
            if (ev.target && /** @type {HTMLElement} */ (ev.target).closest('.rl-dailyb') && typeof GameRewards !== 'undefined') { this._click(); GameRewards.openDaily(); return; }
            if (ev.target && /** @type {HTMLElement} */ (ev.target).closest('.rl-wheelb') && typeof GameRewards !== 'undefined') { this._click(); GameRewards.openWheel(); return; }
            if (ev.target && /** @type {HTMLElement} */ (ev.target).closest('.rl-lbb')) { this._click(); this.openRecords(); return; }
            if (!b || b.hasAttribute('disabled')) return;
            const id = b.getAttribute('data-id');
            if (id) { this._click(); this._go(id); }
        });
        this._setHud();
        const cur = el.querySelector('.rl-lc.cur:not([disabled])') || el.querySelector('.rl-lc:not([disabled])') || back;
        if (cur) try { /** @type {HTMLElement} */ (cur).focus({ preventScroll: true }); } catch (e) { /* нет фокуса */ }
    },

    /** Закрыть выбор карты и вернуть прежнее состояние, паузу и управление. */
    closeLevels() {
        if (this.state !== 'levels') return;
        this._closeScreen('lv');
        for (const k of ['intro', 'res']) if (this.scr[k]) this.scr[k].hidden = false;
        const p = this._lvPrev || { state: 'idle', paused: false, controls: true };
        this._lvPrev = null;
        this.state = p.state;
        Pause.set('manual', p.paused);
        if (typeof Input !== 'undefined' && Input.configure) { try { Input.configure({ controls: p.controls }); } catch (e) { /* ввод не готов */ } }
        if (!p.paused && (this.state === 'playing' || this.state === 'free') && typeof Input !== 'undefined' && Input.capture) Input.capture();
        this._syncGameplay();
        this._setHud();
    },

    // =====================================================================================
    // Экраны (DOM)
    // =====================================================================================

    _injectCss() {
        if (document.getElementById('rl-score-css')) return;
        const st = document.createElement('style');
        st.id = 'rl-score-css';
        st.textContent = SCORE_CSS;
        document.head.appendChild(st);
    },

    _buildScreens() {
        const r = document.createElement('div');
        r.id = 'rl-screens';
        document.body.appendChild(r);
        this.screens = r;
    },

    /** Показать экран kind ('intro' | 'res' | 'lv'), прежний такой же убрать. */
    _screen(kind, html, cls) {
        this._closeScreen(kind);
        const el = document.createElement('div');
        el.className = 'rl-screen ' + cls;
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.innerHTML = html;
        this.screens.appendChild(el);
        this.scr[kind] = el;
        this._scrT = performance.now();
        return el;
    },

    _closeScreen(kind) {
        const el = this.scr[kind];
        if (el) { el.remove(); this.scr[kind] = null; }
    },

    _later(ms, fn) {
        const id = setTimeout(() => { const i = this._timers.indexOf(id); if (i >= 0) this._timers.splice(i, 1); fn(); }, ms);
        this._timers.push(id);
    },

    _langChanged() {
        if (!this._ready) return;
        this._setLevelUi();
        if (this.state === 'intro') { this.state = 'idle'; this.showIntro(); }
        else if (this.state === 'levels') {
            const p = this._lvPrev;
            this._closeScreen('lv');
            this.state = p ? p.state : 'idle';
            const keep = p;
            this._lvPrev = null;
            this.openLevels();
            if (keep && this._lvPrev) this._lvPrev = keep;
        }
    },

    name(l) { return Lang.code === 'en' ? l.en : l.ru; },

    // ---- HTML-строители ----

    _stars(n, total) {
        let s = '<span class="rl-sts">';
        for (let i = 0; i < (total || 3); i++) s += '<span class="rl-s' + (i < n ? ' on' : '') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + SCORE_STAR_PATH + '"/></svg></span>';
        return s + '</span>';
    },

    _introHtml() {
        const L = /** @type {ScoreLevel} */ (this.level), sb = !!L.sandbox;
        const T = (k, p) => Lang.t(k, p);
        const idx = this.levels.findIndex(l => l.id === L.id);
        const rec = this.bestOf(L.id);
        const tag = sb ? T('score.sandbox') : T('score.map', { n: String(idx + 1).padStart(2, '0') });
        let facts = sb ? '' : '<div class="rl-fact"><span class="k">' + T('score.time') + '</span><b>' + this.fmtTime(L.time) + '</b></div>';
        if (!sb) for (let i = 0; i < 3; i++) {
            facts += '<div class="rl-fact' + (rec.stars > i ? ' on' : '') + '"><span class="k">' + this._stars(i + 1, i + 1) + '</span><b>' + this.th[i] + '%</b></div>';
        }
        const best = rec.best > 0
            ? T('score.best') + ' <b>' + this.fmtMoney(rec.best) + '</b>' + (sb ? '' : this._stars(rec.stars))
            : T('score.noRecord');
        return '<div class="rl-panel"><div class="rl-ph"><span class="rl-tag">' + tag + '</span></div><div class="rl-pb">' +
            '<h2 class="rl-name">' + this._esc(this.name(L)) + '</h2>' +
            '<p class="rl-goal">' + (sb ? T('score.sandboxGoal') : T('score.goal')) + '</p>' +
            '<div class="rl-facts">' + facts + '</div>' +
            '<p class="rl-bestl">' + best + '</p>' +
            '<div class="rl-actions"><button type="button" class="rl-btn big rl-go">' + T('score.start') + '</button>' +
            '<button type="button" class="rl-btn alt rl-lvbtn">' + T('score.levels') + '</button></div>' +
            '<div class="rl-hintk">' + T('score.hintStart') + '</div></div></div>';
    },

    _resultsHtml(dmg, stars, record, prev, now) {
        const L = /** @type {ScoreLevel} */ (this.level), sb = !!L.sandbox;
        const T = (k, p) => Lang.t(k, p);
        const nx = this.nextLevel();
        let st = '';
        for (let i = 0; i < 3; i++) st += '<span class="rl-st pending"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + SCORE_STAR_PATH + '"/></svg></span>';
        let note = '';
        if (!sb && stars === 0) note = T('score.needStar', { pct: this.th[0] });
        else if (!sb && nx && !this.unlocked(nx.id)) note = T('score.nextLocked');
        const pct = this.percent < 10 ? this.percent.toFixed(1) : String(Math.floor(this.percent));
        let btns = '<button type="button" class="rl-btn rl-retry">' + T('score.retry') + '</button>';
        if (nx) btns += '<button type="button" class="rl-btn rl-nextb"' + (this.unlocked(nx.id) ? '' : ' disabled') + '>' + T('score.next') + '</button>';
        btns += '<button type="button" class="rl-btn alt rl-lvbtn">' + T('score.levels') + '</button>' + this._lbBtn();
        return '<div class="rl-panel"><div class="rl-ph"><span class="rl-tag">' + this._esc(this.name(L)) + '</span></div><div class="rl-pb">' +
            '<h2 class="rl-big">' + (this._endReason === 'all' ? T('score.allDown') : T('score.timeUp')) + '</h2>' +
            (sb ? '' : '<div class="rl-stars">' + st + '</div>') +
            '<div class="rl-sc"><span class="k">' + T('score.damage') + '</span><b class="rl-scv">' + this.fmtMoney(0) + '</b></div>' +
            (record ? '<div class="rl-badge" hidden>' + T('score.newRecord') + '</div>' : '') +
            '<div class="rl-stats"><div><span>' + T('score.destroyed') + '</span><b>' + pct + '%</b></div>' +
            '<div><span>' + T('score.bestCombo') + '</span><b>×' + this.maxCombo + '</b></div>' +
            '<div><span>' + T('score.best') + '</span><b>' + this.fmtMoney(now.best) + '</b></div></div>' +
            (note ? '<p class="rl-note">' + note + '</p>' : '') +
            '<div class="rl-actions">' + btns + '</div></div></div>';
    },

    _levelsHtml() {
        const T = (k, p) => Lang.t(k, p);
        let cards = '';
        this.levels.forEach((L, i) => {
            const avail = this.available(L.id), open = avail && this.unlocked(L.id);
            const cur = !!this.level && this.level.id === L.id;
            const rec = this.bestOf(L.id);
            const cls = !avail ? 'soon' : !open ? 'locked' : 'open';
            let stateTxt = '', lock = '';
            if (!avail) stateTxt = T('score.soon');
            else if (!open) {
                stateTxt = T('score.locked');
                const p = this._prevChallenge(i);
                const shop = typeof GameShop !== 'undefined' && GameShop.game;
                lock = '<span class="rl-lc-lock"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + SCORE_LOCK_PATH + '"/></svg><span>' + (shop ? T('score.lockedShop') : (p ? T('score.lockedHint', { name: this._esc(this.name(p)) }) : '')) + '</span></span>';
            } else if (cur) stateTxt = T('score.current');
            const meta = L.sandbox ? T('score.sandbox') + ' · ' + T('score.noTimer') : this.fmtTime(L.time);
            const foot = lock || ((L.sandbox ? '<span class="rl-sts"></span>' : this._stars(rec.stars)) + (rec.best > 0 ? '<b>' + this.fmtMoney(rec.best) + '</b>' : '<b class="none">—</b>'));
            const lockedShop = avail && !open && typeof GameShop !== 'undefined' && GameShop.game;
            cards += '<button type="button" class="rl-lc ' + cls + (cur ? ' cur' : '') + '" data-id="' + L.id + '"' + (open || lockedShop ? '' : ' disabled') + '>' +
                '<span class="rl-lc-top"><span class="rl-num">' + String(i + 1).padStart(2, '0') + '</span><span class="rl-lc-st">' + stateTxt + '</span></span>' +
                '<span class="rl-lc-name">' + this._esc(this.name(L)) + '</span><span class="rl-lc-meta">' + meta + '</span>' +
                '<span class="rl-lc-foot">' + foot + '</span></button>';
        });
        return '<div class="rl-lvw"><div class="rl-lvh"><h2 class="rl-big">' + T('score.pick') + '</h2>' +
            '<span class="rl-tot"><span class="rl-s on"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + SCORE_STAR_PATH + '"/></svg></span>' + T('score.totalStars', { n: this.totalStars(), max: this.maxStars() }) + '</span>' +
            (typeof GameShop !== 'undefined' ? '<button type="button" class="rl-btn alt rl-shopb">' + T('score.shop') + '</button>' : '') +
            (typeof GameRewards !== 'undefined' ? '<button type="button" class="rl-btn alt rl-dailyb">' + T('rlr.daily') + '</button><button type="button" class="rl-btn alt rl-wheelb">' + T('rlr.wheel') + '</button>' : '') +
            this._lbBtn() + '<button type="button" class="rl-btn alt rl-back">' + T('score.back') + '</button></div>' +
            '<div class="rl-grid">' + cards + '</div></div>';
    },

    // =====================================================================================
    // Рекорды площадки
    // =====================================================================================

    /** Есть ли у площадки таблица рекордов (Яндекс, Playgama): только тогда видна кнопка «Рекорды». */
    _lbOk() {
        try {
            if (typeof Platform === 'undefined' || !Platform.adapter || typeof Platform.adapter.leaderboard !== 'function') return false;
            // Playgama: таблицу рисует игра только при leaderboards.type = in_game (native — окно самой площадки)
            if (Platform.name === 'playgama') { const b = /** @type {any} */ (window).bridge; return !!(b && b.leaderboards && b.leaderboards.type === 'in_game'); }
            return true;
        } catch (e) { return false; }
    },
    _lbBtn() { return this._lbOk() ? '<button type="button" class="rl-btn alt rl-lbb">' + Lang.t('score.records') + '</button>' : ''; },
    /** Таблица из прошлого запроса (у Яндекса предел запросов — 20 за 5 минут). @type {{ t: number, list: any[] | null } | null} */
    _lbCache: null,

    /**
     * Окно «Рекорды» поверх экрана: место, аватар, ник и счёт; пусто — «Пока нет лучших игроков»;
     * гостю — кнопка «Войдите в аккаунт» (после входа страница перечитывает сохранение аккаунта).
     */
    async openRecords() {
        if (this.scr.lb || !this._lbOk()) return;
        const T = (k, p) => Lang.t(k, p);
        const el = this._screen('lb', '<div class="rl-panel"><div class="rl-ph"><span class="rl-tag">' + T('score.records') + '</span></div><div class="rl-pb">' +
            '<div class="rl-lbl"><p class="rl-note">' + T('score.lbLoading') + '</p></div>' +
            '<div class="rl-actions"><button type="button" class="rl-btn alt rl-lbx">' + T('score.back') + '</button></div></div></div>', 'rl-lbs');
        const x = el.querySelector('.rl-lbx');
        if (x) { x.addEventListener('click', () => { this._click(); this._closeScreen('lb'); }); try { /** @type {HTMLElement} */ (x).focus({ preventScroll: true }); } catch (e) { /* нет фокуса */ } }
        const c = this._lbCache;
        let list = c && performance.now() - c.t < 60000 ? c.list : undefined;
        if (list === undefined) {
            list = await Platform.leaderboard({ quantityTop: 10, includeUser: true, quantityAround: 3, avatarSize: 'small' });
            this._lbCache = { t: performance.now(), list };
        }
        if (this.scr.lb !== el) return;
        const box = el.querySelector('.rl-lbl');
        if (!box) return;
        let h;
        if (!list) h = '<p class="rl-note">' + T('score.lbErr') + '</p>';
        else if (!list.length) h = '<p class="rl-note">' + T('score.lbEmpty') + '</p>';
        else {
            h = '<ol class="rl-lbt">';
            for (const r of list) {
                const av = r.avatar && /^https:\/\//.test(String(r.avatar)) ? '<img src="' + this._esc(r.avatar) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<i></i>';
                h += '<li' + (r.me ? ' class="me"' : '') + '><span class="n">' + (r.rank | 0) + '</span>' + av + '<span class="nm">' + this._esc(r.name || T('score.lbAnon')) + '</span><b>' + this.fmtMoney(r.score) + '</b></li>';
            }
            h += '</ol>';
        }
        if (Platform.canLogin()) h += '<button type="button" class="rl-btn rl-lbin">' + T('score.lbLogin') + '</button>';
        box.innerHTML = h;
        const lin = box.querySelector('.rl-lbin');
        if (lin) lin.addEventListener('click', async () => {
            this._click();
            if (await Platform.login()) location.reload();
        });
    },

    _esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },

    /** $ 12 480 (неразрывные пробелы). */
    fmtMoney(n) { return '$ ' + String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); },
    fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },

    // =====================================================================================
    // Живой счётчик
    // =====================================================================================

    _buildHud() {
        const layer = document.createElement('div');
        layer.id = 'rl-hudlayer';
        layer.innerHTML =
            '<div id="rl-hud" hidden><div class="rl-hin">' +
            '<div class="rl-m"><span class="rl-mv">$ 0</span><span class="rl-cb" hidden>×1.5</span></div>' +
            '<div class="rl-tm"><span class="rl-time">0:00</span><span class="rl-tl" hidden></span></div>' +
            '<div class="rl-bar"><div class="rl-track"><i class="rl-fill"></i></div><span class="rl-pc">0%</span></div>' +
            '</div></div><div id="rl-pops"></div><div class="rl-vig"></div><div class="rl-banner" hidden></div>';
        document.body.appendChild(layer);
        this.hudLayer = layer;
        const q = (s) => layer.querySelector(s);
        this.ui = {
            hud: q('#rl-hud'), hin: q('.rl-hin'), money: q('.rl-mv'), combo: q('.rl-cb'), time: q('.rl-time'), tl: q('.rl-tl'),
            track: q('.rl-track'), fill: q('.rl-fill'), pc: q('.rl-pc'), pops: q('#rl-pops'), vig: q('.rl-vig'), banner: q('.rl-banner'),
            ticks: [], _money: '', _pc: '', _time: '', _combo: '', _w: -1, _warn: false,
        };
    },

    /** Подписи и риски звёзд под текущую карту. */
    _setLevelUi() {
        const U = this.ui, L = this.level;
        if (!U.hud || !L) return;
        for (const t of U.ticks) t.remove();
        U.ticks = [];
        const sb = !!L.sandbox;
        U.hin.classList.toggle('rl-sb', sb);
        U.tl.hidden = !sb;
        U.tl.textContent = Lang.t('score.sandbox');
        U.time.hidden = sb;
        if (!sb) for (let i = 0; i < 3; i++) {
            const t = document.createElement('b');
            t.className = 'rl-tick';
            t.style.left = this.th[i] + '%';
            t.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + SCORE_STAR_PATH + '"/></svg>';
            U.track.appendChild(t);
            U.ticks.push(t);
        }
    },

    /** Виден ли живой счётчик: идёт раунд / песочница (и под выбором карты, открытым из игры). */
    _live() {
        const s = this.state === 'levels' && this._lvPrev ? this._lvPrev.state : this.state;
        return s === 'playing' || s === 'free' || s === 'ending';
    },

    _setHud() {
        const on = this._live() && this.state !== 'levels';
        const U = this.ui;
        if (!U.hud) return;
        if (on !== this._hudOn) {
            this._hudOn = on;
            U.hud.hidden = !on;
            if (typeof HudLayout !== 'undefined') HudLayout.schedule();
        }
        if (!on) { U.vig.classList.remove('on'); }
    },

    /** Каждый кадр после рендера: счётчик, цифры «+$», набегание суммы итогов. */
    _post() {
        const now = performance.now();
        const dt = Math.min(0.1, Math.max(0, (now - this._lastPost) / 1000));
        this._lastPost = now;
        if (!this._ready) return;
        this._syncHud(dt);
        this._countUp(dt);
        this._updatePops(dt);
    },

    _syncHud(dt) {
        const U = this.ui;
        if (!this._hudOn) return;
        const d = this.damage - this._shown;
        const bumped = d > 0;
        this._shown = Math.abs(d) < 1 ? this.damage : this._shown + d * Math.min(1, dt * 9);
        const m = this.fmtMoney(this._shown);
        if (m !== U._money) {
            U._money = m;
            U.money.textContent = m;
            if (bumped && d > 40 && !U.money.classList.contains('bump')) { U.money.classList.add('bump'); setTimeout(() => U.money.classList.remove('bump'), 230); }
        }
        const pcTxt = (this.percent < 10 ? this.percent.toFixed(1) : String(Math.floor(this.percent))) + '%';
        if (pcTxt !== U._pc) { U._pc = pcTxt; U.pc.textContent = pcTxt; }
        const w = Math.round(this.percent * 10) / 10;
        if (w !== U._w) {
            U._w = w;
            U.fill.style.width = w + '%';
            U.ticks.forEach((t, i) => t.classList.toggle('hit', this.percent >= this.th[i]));
        }
        if (!this.level.sandbox) {
            const tt = this.fmtTime(this.timeLeft);
            if (tt !== U._time) { U._time = tt; U.time.textContent = tt; }
            const warn = this.state === 'playing' && this.timeLeft <= SCORE_TUNE.warnSec;
            if (warn !== U._warn) { U._warn = warn; U.time.classList.toggle('warn', warn); U.vig.classList.toggle('on', warn); }
        }
        const c = this.combo > 1 ? '×' + this.combo : '';
        if (c !== U._combo) {
            const up = c && (!U._combo || this.combo > parseFloat(U._combo.slice(1)));
            U._combo = c;
            U.combo.hidden = !c;
            U.combo.textContent = c;
            if (up) { U.combo.classList.remove('pop'); void U.combo.offsetWidth; U.combo.classList.add('pop'); }
        }
        if (c) U.combo.style.setProperty('--p', Math.round(this._comboT > 0 ? Math.min(1, this._comboT / SCORE_TUNE.window) * 100 : 0) + '%');
    },

    _comboFlash(up) {
        if (!this._hudOn || !up) return;
        const el = document.createElement('div');
        el.className = 'rl-cflash';
        el.textContent = Lang.t('score.combo', { n: this.combo });
        this.hudLayer.appendChild(el);
        setTimeout(() => el.remove(), 950);
    },

    _banner(text) {
        const b = this.ui.banner;
        if (!b) return;
        if (!text) { b.hidden = true; return; }
        b.hidden = false;
        b.textContent = text;
        b.style.animation = 'none';
        void b.offsetWidth;
        b.style.animation = '';
    },

    _countUp(dt) {
        const c = this._cu;
        if (!c) return;
        c.t += dt;
        const u = Math.min(1, c.t / SCORE_TUNE.countUp), e = 1 - Math.pow(1 - u, 3);
        if (c.el) c.el.textContent = this.fmtMoney(c.to * e);
        if (u >= 1) this._cu = null;
    },

    // =====================================================================================
    // Цифры «+$» над местом разрушения
    // =====================================================================================

    _flushPop() {
        const p = this._pend, T = SCORE_TUNE;
        if (p.v < T.popMin) return;
        const v = p.v;
        this._spawnPop(p.x / v, p.y / v + 0.6, p.z / v, v, p.m);
        p.v = 0; p.x = 0; p.y = 0; p.z = 0; p.m = 1;
    },

    _spawnPop(x, y, z, v, mult) {
        if (!this._hudOn) return;
        const T = SCORE_TUNE;
        let p;
        if (this._pops.length >= T.popPool) p = this._pops.shift();
        else p = { el: this._popFree.pop() || this._newPopEl(), x: 0, y: 0, z: 0, age: 0 };
        p.x = x; p.y = y; p.z = z; p.age = 0;
        const size = Math.max(16, Math.min(40, 10 + Math.log10(v) * 6.5));
        p.el.style.fontSize = size.toFixed(0) + 'px';
        p.el.innerHTML = '+' + this.fmtMoney(v) + (mult > 1 ? '<i>×' + mult + '</i>' : '');
        p.el.style.opacity = '0';
        if (!p.el.parentNode) this.ui.pops.appendChild(p.el);
        this._pops.push(p);
    },

    _newPopEl() { const e = document.createElement('div'); e.className = 'rl-pop'; return e; },

    _releasePop(p) { p.el.style.opacity = '0'; p.el.remove(); this._popFree.push(p.el); },

    _updatePops(dt) {
        const pops = this._pops;
        if (!pops.length) return;
        const paused = Pause.active;
        const eng = VoxRender.engine, sc = VoxRender.scene, cam = VoxRender.camera;
        if (!this._pv) { this._pv = new BABYLON.Vector3(); this._po = new BABYLON.Vector3(); }
        const rw = eng.getRenderWidth(), rh = eng.getRenderHeight();
        const cv = eng.getRenderingCanvas();
        const rect = cv.getBoundingClientRect();
        const kx = rect.width / rw, ky = rect.height / rh;
        const vp = cam.viewport.toGlobal(rw, rh), tm = sc.getTransformMatrix();
        const life = SCORE_TUNE.popLife;
        for (let i = pops.length - 1; i >= 0; i--) {
            const p = pops[i];
            if (!paused) p.age += dt;
            if (p.age >= life) { pops.splice(i, 1); this._releasePop(p); continue; }
            this._pv.set(p.x, p.y, p.z);
            BABYLON.Vector3.ProjectToRef(this._pv, BABYLON.Matrix.IdentityReadOnly, tm, vp, this._po);
            const o = this._po;
            if (o.z < 0 || o.z > 1 || o.x < -60 || o.y < -60 || o.x > rw + 60 || o.y > rh + 60) { p.el.style.opacity = '0'; continue; }
            const u = p.age / life;
            const rise = 1 - (1 - u) * (1 - u);
            const op = u < 0.1 ? u / 0.1 : u > 0.62 ? (1 - u) / 0.38 : 1;
            p.el.style.opacity = op.toFixed(2);
            p.el.style.transform = 'translate(' + (rect.left + o.x * kx).toFixed(1) + 'px,' + (rect.top + o.y * ky - rise * 64).toFixed(1) + 'px) translate(-50%,-100%) scale(' + (1 + (1 - u) * 0.18).toFixed(3) + ')';
        }
    },

    // =====================================================================================
    // Звуки (синтез: Sound.makeBuffer; файлов нет)
    // =====================================================================================

    _makeSynth() {
        if (typeof Sound === 'undefined' || !Sound.makeBuffer || !Sound.putBuffer) return;
        const sr = 22050;
        const mk = (name, dur, fn) => {
            const n = Math.floor(sr * dur), a = new Float32Array(n);
            for (let i = 0; i < n; i++) a[i] = fn(i / sr);
            const b = Sound.makeBuffer(a, sr);
            if (b) { Sound.putBuffer(name, b); return true; }
            return false;
        };
        const TAU = Math.PI * 2;
        const ok = mk('rl-star', 0.55, t => (Math.sin(TAU * 880 * t) * 0.6 + Math.sin(TAU * 1320 * t) * 0.3 + Math.sin(TAU * 1760 * t) * 0.15) * Math.exp(-t * 6) * Math.min(1, t * 300));
        if (!ok) return;
        mk('rl-tick', 0.07, t => Math.sin(TAU * 1500 * t) * Math.exp(-t * 55) * 0.7);
        mk('rl-buzz', 0.6, t => (Math.sign(Math.sin(TAU * 110 * t)) * 0.3 + Math.sin(TAU * 165 * t) * 0.25) * Math.exp(-t * 4.5) * Math.min(1, t * 200));
        this._synthOk = true;
    },

    _sfx(kind, rate) {
        try {
            if (typeof Sound === 'undefined' || !Sound.play) return;
            if (!this._synthOk) this._makeSynth();
            if (!this._synthOk) return;
            Sound.play('synth:rl-' + kind, { volume: 0.55, rate: rate || 1 });
        } catch (e) { /* тишина */ }
    },
};
