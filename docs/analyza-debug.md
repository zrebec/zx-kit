# Analýza: debug / telemetria overlay pre zx-kit hry

> **Stav:** návrh / rozhodovací dokument. Nič sa zatiaľ nestavia.
> **Spúšťač:** fotka RetroArch/Batocera „Show Statistics" overlayu (`24.3fps, 41.23ms,
> Font VRAM, Tex VRAM, Known Tex, Max VRAM`) + otázka: *vieme každej hre dať jednotný
> `debugInfo` JSON — RAM, VRAM, FPS, reálne rozlíšenie — alebo si to má každá hra riešiť sama?*
> **Prvý konzument, ak sa to postaví:** Minefield.

---

## 1. Kontext a otázka

Dnes je telemetria v hrách ad-hoc: chaosBunny ukazuje FPS, Minefield počet mín, nikto neukazuje
pamäť, rozlíšenie ani „koľko z frame budgetu hra reálne zožerie". Otázka je, či to povýšiť na
zdieľaný primitív v zx-kit:

1. hra po stlačení klávesy (každá si zvolí vlastnú) zapne debug,
2. na konci každého `requestAnimationFrame` si vypýta aktuálny `debugInfo`,
3. buď si ho vykreslí sama, alebo požiada kit, aby ho vykreslil.

Skôr než navrhnem API, treba oddeliť **čo z toho je v prehliadači vôbec merateľné** od toho, čo
vyzerá ako fotka z Batocery, ale v browseri jednoducho neexistuje. Polovica tej fotky (VRAM)
je v našom prostredí **nemerateľná** a je dôležité to povedať rovno, nie predstierať číslo.

---

## 2. Čo je na tej fotke (a prečo to tak vyzerá)

Overlay na fotke je **RetroArch „Show Statistics"** (Batocera je len frontend nad RetroArch).
Kľúčový detail: tie čísla **nemeria hra (ROM)**. Meria ich **hostiteľ** — emulátor, ktorý vlastní
celý pipeline: spúšťa jadro, robí GL/Vulkan blit, plní audio buffer. NES ROM z roku 1983 netuší,
že beží, ani koľko „Tex VRAM" zaberá — to je textúrová pamäť, ktorú alokoval *renderer RetroArchu*,
nie hra.

To je celé jadro veci: **najpresnejšie metriky vždy pochádzajú z vrstvy POD hrou, nie z hry
samotnej.** A presne tu narážame na strop prehliadača — viď §4.

---

## 3. Ako to riešia „profíci" (a čo si z toho zobrať)

| Nástroj | Kde meria | Ako | Čo z toho vie / nevie |
|---|---|---|---|
| **RetroArch / Batocera** | hostiteľ (emulátor) | vlastní render+audio pipeline | FPS, frame time, VRAM textúr, audio buffer occupancy. Hra o ničom nevie. |
| **Steam overlay / FPS counter** | injektovaná DLL | hookne `Present`/`SwapBuffers` grafického API | presné FPS na swap boundary, bez spolupráce hry. Internú RAM hry nevidí (cudzia alokácia). |
| **RTSS / MSI Afterburner** | hook present + ovládač | NVAPI/ADL senzory z GPU | true FPS + frame-time graf + GPU/VRAM/teploty z hardvéru. Per-proces VRAM je odhad ovládača. |
| **PresentMon / Nvidia FrameView** | OS (ETW eventy) | grafický stack OS hlási present timing | FPS akéhokoľvek procesu bez injektovania. OS = zdroj pravdy. |
| **Browser DevTools (Performance/Memory)** | engine prehliadača | interná inštrumentácia V8/Blink | najpresnejšie, ale **nie programovo dostupné hre** — len pre vývojára. |

**Poznatok č. 1:** Všetci presní merači sedia *pod* hrou (hook API, ovládač, OS, engine).
**Poznatok č. 2:** Nikto z nich nečíta „RAM hry zvnútra hry" — to je v každom modeli súkromná
alokácia procesu, viditeľná len hrubo zvonku.

### Kam v tomto spektre sedí zx-kit?

zx-kit je zvláštny hybrid: je **súčasne hostiteľ aj knižnica vnútri hry**. Vlastní renderer
(Canvas2D) aj audio (Web Audio), takže — na rozdiel od Steam overlayu — **vie inštrumentovať
vlastné draw cally**. Ale **nevlastní herný loop** (ten je v hre) a **nevlastní GPU** (ten je za
sandboxom prehliadača). To presne určuje, čo dokáže a čo nie.

---

## 4. Realita prehliadača: čo sa naozaj dá odmerať

Toto je najdôležitejšia tabuľka v dokumente. Pre každú metriku: dá sa to? ako? aká je
spoľahlivosť a cross-browser dostupnosť? aká je cena?

| Metrika | Merateľné? | Ako | Spoľahlivosť / poznámky |
|---|:---:|---|---|
| **FPS** | ✅ áno | delta medzi `rAF` callbackmi, vyhladené (EMA) | Stropované refresh rate (60/120/144 Hz) a throttlingom skrytého tabu. Pokles deltu predĺži → FPS klesne. Honest. |
| **Frame time (ms)** | ✅ áno | tá istá `rAF` delta | Najúprimnejšie číslo zo všetkých. `41.23 ms ≈ 1000/24.3` ako na fotke. |
| **Work time / CPU load %** | ✅ áno* | `performance.now()` okolo update+render (`beginFrame`/`endFrame`), `/ budget` | *Meria len JS main-thread prácu. **GPU/kompozícia frame nie je v JS viditeľná** — žiadne API. „Load" = headroom voči 16.67 ms. |
| **JS heap (RAM)** | ⚠️ čiastočne | `performance.memory` (`usedJSHeapSize`…) | **Iba Chromium** (nie Firefox/Safari). Hodnoty **hrubé/kvantované**, presné len ak je stránka `crossOriginIsolated` (COOP+COEP hlavičky). Meria celý heap renderera, nie len hru. |
| **JS heap (presne)** | ⚠️ async | `performance.measureUserAgentSpecificMemory()` | Standard-track, ale vyžaduje cross-origin isolation, je **async + drahé** (GC-blízke). Vzorkovať raz za pár sekúnd, nikdy per-frame. |
| **VRAM** | ❌ nie | — | **Žiadne web API neexistuje.** Pre Canvas2D koncept „VRAM hry" nemáme. Náhrada nižšie. |
| **Odhad image-pamäte** | ✅ áno (odhad) | kit sčíta `w·h·4 B` cez canvasy/bitmapy/ImageData, čo sám alokoval | Toto je úprimná náhrada za „VRAM" — **odhad pamäte, o ktorú si knižnica povedala**, jasne označený ako odhad. |
| **„Požadovaná rýchlosť CPU"** | ❌ nie | — | Nedá sa. Náhrada: **frame-budget headroom %** (work ms / budget) — koľko rezervy hra má. |
| **Reálne rozlíšenie** | ✅ áno | `canvas.width/height` (backing), `style`/`getBoundingClientRect` (CSS px), `devicePixelRatio` | Plne dostupné. Kit pozná aj logické 256×192 a `SCALE`. |
| **GPU renderer string** | ⚠️ áno | `WEBGL_debug_renderer_info` cez jednorazový 1×1 WebGL context | Niektoré prehliadače maskujú (Safari, FF resistFingerprinting). Čítať raz. |
| **Draw cally / sprity za frame** | ✅ áno | renderer inkrementuje čítače v `drawSprite`/`drawChar`/`drawBitmap` | Inštrumentuje **najhorúcejšiu cestu** → gate za flag, default vypnuté. |
| **Audio** | ✅ áno | `getAudioContext().sampleRate / state`, počet AY voices | Kit už drží tento stav (`audio.ts`, `ay.ts`). |
| **Long frames (LoAF)** | ⚠️ pokročilé | `PerformanceObserver('long-animation-frame')` | Novší Chromium; hlási frame > 50 ms s atribúciou. Pekné „advanced" pole. |

**Zhrnutie reality:** z fotky vieme úprimne dodať **FPS, frame ms, CPU headroom, rozlíšenie,
odhad image-pamäte, draw counts, audio stav** a *na Chrome* hrubý **JS heap**. **VRAM a
„požadovaný CPU" sú v browseri fikcia** — buď ich nedáme, alebo dáme úprimné náhrady (odhad
image-pamäte, headroom %), nikdy nie vymyslené číslo s nálepkou „VRAM".

---

## 5. Návrh dátového objektu `DebugInfo`

```ts
interface DebugInfo {
  fps: number              // vyhladené, EMA
  frameMs: number          // posledná rAF delta (úprimné číslo)
  workMs: number           // JS update+render čas (beginFrame→endFrame)
  budgetMs: number         // cieľový rozpočet (napr. 1000/60)
  cpuLoad: number          // workMs / budgetMs (0..1+); NIE „rýchlosť CPU"

  resolution: {
    logical: { w: number; h: number }   // 256×192
    output:  { w: number; h: number }    // backing store px (256·scale …)
    css:     { w: number; h: number }    // zobrazené CSS px
    scale: number                        // SCALE
    dpr: number                          // devicePixelRatio
  }

  memory?: {               // iba Chromium, voliteľné
    usedJsHeapMb: number
    limitJsHeapMb: number
    precise: boolean       // false ak kvantované / nedostupné
  }
  estImageKb?: number      // kit-tracked odhad canvas/bitmap bajtov (≈ „VRAM")

  draws?: { sprites: number; chars: number; bitmaps: number; total: number }
  audio?: { sampleRate: number; state: AudioContextState; voices: number }
  gpu?: string             // WEBGL_debug_renderer_info, vzorkované raz

  custom?: Record<string, string | number>  // hra primieša svoje (míny, skóre…)
}
```

`custom` je dôležité: rieši „minefield ukazuje míny, chaosBunny FPS" bez toho, aby kit musel
poznať doménu hry. Kit dodá rám, hra doplní svoje políčka.

---

## 6. Architektonické možnosti

### A — Status quo: každá hra si to rieši sama

Žiadny kód v kite. Každá hra si meria FPS po svojom.
**+** nula práce, nula povrchu na údržbu, plne v duchu „less is more".
**−** duplicita (každá hra znova píše EMA FPS), nekonzistentné, nikto neukáže pamäť/rozlíšenie,
draw counts a work-time **nedokáže odmerať bez prístupu do renderera** — takže najcennejšie
metriky ostanú navždy mimo.

### B — Tenký pull-only helper (`debug.ts`, len meranie)

Kit dodá `createDebugMonitor()` + `beginFrame`/`endFrame`/`sampleDebug(): DebugInfo`.
**Hra si overlay kreslí sama** (cez `drawText`), sama si drží toggle klávesu.
**+** malý povrch (~1 modul, žiadny rendering), rieši FPS/work/heap/rozlíšenie/audio jednotne,
hra má plnú kontrolu nad vzhľadom.
**−** draw counts vyžadujú inštrumentáciu renderera (ďalší bod), každá hra si stále kreslí overlay
(menšia duplicita).

### C — Plný debug modul + overlay renderer + inštrumentácia renderera

B + `drawDebugOverlay(ctx, info)` (Speccy-štýl cez `drawText`) + čítače priamo v
`drawSprite/drawChar/drawBitmap`.
**+** „zapni jednou klávesou" zážitok, konzistentný overlay naprieč hrami, draw counts zadarmo.
**−** najväčší povrch, dotýka sa **najhorúcejšej cesty renderera** (čítače), overlay je názorová
vec (každá hra ho chce inak umiestnený/štýlovaný), a koliduje s „stabilizácia, nie nové moduly".

### D — Hybrid (odporúčané)

- **Jadro (pull model):** `createDebugMonitor` + `beginFrame`/`endFrame` + `sampleDebug()` →
  `DebugInfo` s FPS, frameMs, workMs, cpuLoad, resolution, audio, a *voliteľne* memory/gpu/heap
  (lazy, vzorkované zriedka).
- **Draw counts za flag:** čítače v rendereri sú **opt-in** (`enableDrawCounters()` / default off),
  takže keď ich nikto nezapne, sú nula-cost a tree-shakeable — drží to `sideEffects:false`.
- **Overlay je voliteľný helper, nie povinnosť:** `drawDebugOverlay(ctx, info, opts?)` existuje pre
  pohodlie, ale hra si rovnako môže vykresliť `info` sama. Toggle klávesu **vlastní hra**.
- **`custom` políčka:** hra primieša doménové metriky.

To presne kopíruje záväznú deľbu zodpovednosti kitu: **kit vlastní primitív merania, hra vlastní
policy** (ktorá klávesa, kde to je, čo navyše ukázať).

---

## 7. Náročnosť, pracnosť, CPU navyše

| | Pracnosť | Povrch API | CPU navyše | Riziko |
|---|:---:|:---:|---|:---:|
| A status quo | 0 | 0 | 0 | žiadne (ale problém nevyrieši) |
| B pull helper | **S** (~1 modul + testy) | malý | zanedbateľné (2× `now()` + EMA/frame) | nízke |
| C plný modul | M | veľký | nízke, ale v hot-path; overlay = pár sprite-ov text/frame | **stredné** (koliduje s roadmapou) |
| D hybrid | **S–M** | malý core, opt-in zvyšok | viď nižšie | nízke |

**CPU navyše po metrikách:**
- FPS/frame/work: **nanosekundy** — 2× `performance.now()` + odčítanie + EMA. Zanedbateľné.
- Draw čítače: integer `++` v hot loope — per-call zanedbateľné, ale je to najhorúcejšia cesta →
  preto **za flag**, default off.
- `performance.memory`: lacný read, ale **vzorkovať max ~1–2× za sek**, nie per-frame.
- `measureUserAgentSpecificMemory()`: **drahé + async** → raz za pár sekúnd.
- Vykreslenie overlayu: `drawText` ide pixel po pixeli cez font (`fillRect`/px) → **najdrahšia
  časť celého debugu**, porovnateľná s pár spritmi. Mitigácia: text refresh throttlovať na ~4 Hz
  (FPS vzorkovať každý frame), prípadne overlay **cachovať cez `cache.ts`** a len blitovať.

---

## 8. Konflikt s roadmapou (úprimne)

CLAUDE.md aj SK working doc hovoria jasne: *„Next: stabilisation, not new modules"*, *„less is
more"*, *„každý modul navyše je ďalší povrch na údržbu"*. Debug modul **nie je** na zozname
zakázaných (`physics`, `particle`, network, multiplayer), ale **je to nový povrch v čase, keď je
prioritou prezentácia a cesta k 1.0**, nie rozširovanie engine.

Dva čestné protiargumenty *za*:
1. Je to **debug/dev nástroj**, nie herná mechanika — tree-shakeable, `sideEffects:false`, keď ho
   hra nezapne, v bundli nie je. Cena „povrchu" je menšia než pri runtime moduloch.
2. **Flagship „kitchen-sink" demo (K5)** by z takého overlayu profitoval — je to presne ten typ
   „pozri, koľko toho beží na 60 fps" marketingu, ktorý K5 chce.

Verdikt tejto sekcie: **nestavať to teraz ako prioritu pred K3/K4/K5**, ale ak sa stavia, tak
**variant D v minimálnej forme**, a ideálne **napojené na K5 demo**, nie ako samostatný cieľ.

---

## 9. Môj názor / odporúčanie

1. **Áno, má zmysel to mať v kite — ale len jadro, a nie teraz s prioritou.** Najcennejšie metriky
   (work-time, draw counts) sa **principiálne nedajú** odmerať mimo renderera, takže „nech si to
   rieši každá hra sama" (variant A) ich navždy odreže. To je jediný silný dôvod, prečo to do kitu
   patrí.
2. **Variant D, minimálna forma.** Začať len `createDebugMonitor` + `beginFrame/endFrame/sampleDebug`
   (FPS, frameMs, workMs, cpuLoad, resolution, audio, `custom`). Memory/GPU/draw-counts/overlay
   pridať až keď ich konkrétna hra alebo K5 demo reálne vyžiada — rovnaká disciplína ako pri zvyšku
   kitu („postav, až keď to hra využije").
3. **VRAM neukazovať.** Žiadne pole `vram`. Namiesto toho `estImageKb` (jasne „odhad") a `cpuLoad`/
   headroom namiesto „požadovaný CPU". Úprimnosť čísel je dôležitejšia než to vyzerať ako Batocera.
4. **Toggle klávesa a vzhľad ostávajú hre.** Kit nesmie zabrať klávesu ani diktovať layout —
   to je policy.
5. **Minefield ako referenčná integrácia**, presne ako pri save/rng — jedna hra to zadrôtuje naplno,
   z toho sa ustáli API, potom (možno) zovšeobecniť overlay helper.

Inými slovami: **nie „každá hra úplne sama"** (stratíme work-time/draw-counts) **a nie „veľký
overlay modul teraz"** (koliduje s roadmapou) — ale **tenký zdieľaný merací primitív + policy v
hre**, postavený keď ho potiahne Minefield alebo K5 demo.

---

## 10. Integračný náčrt (Minefield)

```ts
import { createDebugMonitor, sampleDebug } from 'zx-kit'

const dbg = createDebugMonitor({ canvas, targetFps: 60 })
let showDebug = false
addEventListener('keydown', e => { if (e.key === 'F3') showDebug = !showDebug })

function loop(t: number) {
  beginFrame(dbg, t)
  update(dt)
  render(ctx)
  endFrame(dbg)

  if (showDebug) {
    const info = sampleDebug(dbg, { custom: { mines: mineCount, flags: flagCount } })
    drawText(ctx, `${info.fps.toFixed(1)}fps ${info.frameMs.toFixed(1)}ms`, 1, 1, C.YELLOW, C.BLACK)
    drawText(ctx, `${info.resolution.logical.w}x${info.resolution.logical.h} cpu ${(info.cpuLoad*100|0)}%`, 1, 9, C.YELLOW, C.BLACK)
    // …alebo: drawDebugOverlay(ctx, info)
  }
  requestAnimationFrame(loop)
}
```

---

## 11. Otvorené otázky

- **Jeden modul, alebo rozšíriť existujúci?** `debug.ts` samostatne (čisté) vs. prilepiť meranie k
  niečomu. Hlasujem za samostatný `debug.ts` — single concern.
- **Singleton vs. factory?** Zvyšok kitu s per-instance stavom používa factory (`createCamera`…).
  `createDebugMonitor()` factory sedí lepšie než ďalší modul-level singleton.
- **Postaviť v kite a extrahovať, alebo najprv v Minefielde?** Ako pri Action Replay — buď
  referenčná plná integrácia v Minefielde a potom destilovať, alebo rovno tenké jadro v kite.
- **Naviazať na K5 (kitchen-sink demo) ako spoločný míľnik?** Pravdepodobne áno — debug overlay je
  prirodzená súčasť „pozri, čo všetko beží naraz" dema.
