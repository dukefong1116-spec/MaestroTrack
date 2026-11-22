/**
 * Femata, the app's mascot: a sixteenth note with a round head.
 *
 * Drawn in code (SVG) from the original drawing, so it is sharp at any size.
 * The body never changes; `mood` swaps the face, and `tone` swaps the
 * shading so Femata does not look the same flat blue everywhere: a sunny rim
 * for celebrations, a glow for dark screens, punchier light for big heroes.
 */
import { useId } from 'react'

export type FemataMood = 'happy' | 'excited' | 'proud' | 'focused' | 'surprised' | 'wink' | 'thinking' | 'sleepy' | 'sad' | 'cool' | 'in-love' | 'celebrate'
export type FemataTone = 'sky' | 'sunrise' | 'glow' | 'pop'

const SHAPE = "<ellipse cx=\"180\" cy=\"497\" rx=\"149\" ry=\"113\" transform=\"rotate(-8 180 497)\"/><path d=\"M250 545L236 389L290 130C296 103 316 81 350 65C372 49 400 43 440 43C475 43 495 46 515 52C555 63 578 78 584 102C590 126 578 148 552 153C530 157 470 159 438 166C412 172 400 186 410 198C418 206 440 204 470 203C540 204 590 214 607 236C621 255 616 276 596 282C580 287 540 286 500 285C440 284 368 282 352 292C344 297 341 303 340 310L313 439Z\"/>"

/** Faces. {F} face colour, {S} eye shine, {X} extras beside Femata, {ID} unique id. */
const FACES: Record<FemataMood, string> = {
  "happy": "<circle cx=\"118\" cy=\"468\" r=\"23\" fill=\"{F}\"/><circle cx=\"224\" cy=\"460\" r=\"23\" fill=\"{F}\"/><circle cx=\"125\" cy=\"460\" r=\"6.9\" fill=\"{S}\"/><circle cx=\"231\" cy=\"452\" r=\"6.9\" fill=\"{S}\"/><path d=\"M131 512Q183 562 234 509C236 556 210 584 180 580C154 576 138 550 131 512Z\" fill=\"{F}\"/>",
  "excited": "<circle cx=\"118\" cy=\"468\" r=\"27\" fill=\"{F}\"/><circle cx=\"224\" cy=\"460\" r=\"27\" fill=\"{F}\"/><circle cx=\"125\" cy=\"460\" r=\"8.1\" fill=\"{S}\"/><circle cx=\"231\" cy=\"452\" r=\"8.1\" fill=\"{S}\"/><circle cx=\"111\" cy=\"477\" r=\"4.0\" fill=\"{S}\"/><circle cx=\"217\" cy=\"469\" r=\"4.0\" fill=\"{S}\"/><path d=\"M124 504Q183 560 244 498C248 570 216 598 182 594C148 590 128 562 124 504Z\" fill=\"{F}\"/><path d=\"M150 580Q183 556 214 578Q200 595 182 594Q162 593 150 580Z\" fill=\"#FF8FA3\"/><path d=\"M640 70Q665 100 650 135\" fill=\"none\" stroke=\"{X}\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M640 220Q665 250 650 285\" fill=\"none\" stroke=\"{X}\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "proud": "<path d=\"M95 476Q118 446 141 476\" fill=\"none\" stroke=\"{F}\" stroke-width=\"14\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M201 468Q224 438 247 468\" fill=\"none\" stroke=\"{F}\" stroke-width=\"14\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M150 530Q183 556 218 526\" fill=\"none\" stroke=\"{F}\" stroke-width=\"14\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"78\" cy=\"522\" rx=\"24\" ry=\"13\" fill=\"#FF8FA3\" opacity=\".8\"/><ellipse cx=\"270\" cy=\"508\" rx=\"22\" ry=\"12\" fill=\"#FF8FA3\" opacity=\".8\"/><path d=\"M80 266Q80 300 114 300Q80 300 80 334Q80 300 46 300Q80 300 80 266Z\" fill=\"#FFC93C\"/><path d=\"M470 414Q470 440 496 440Q470 440 470 466Q470 440 444 440Q470 440 470 414Z\" fill=\"#FFC93C\"/><path d=\"M540 504Q540 520 556 520Q540 520 540 536Q540 520 524 520Q540 520 540 504Z\" fill=\"#FFC93C\"/>",
  "focused": "<circle cx=\"126\" cy=\"472\" r=\"21\" fill=\"{F}\"/><circle cx=\"232\" cy=\"464\" r=\"21\" fill=\"{F}\"/><circle cx=\"133\" cy=\"464\" r=\"6.3\" fill=\"{S}\"/><circle cx=\"239\" cy=\"456\" r=\"6.3\" fill=\"{S}\"/><path d=\"M90 432L142 444\" fill=\"none\" stroke=\"{F}\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M198 436L250 422\" fill=\"none\" stroke=\"{F}\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M160 548L208 542\" fill=\"none\" stroke=\"{F}\" stroke-width=\"14\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M60 300Q36.0 345.0 60 357.0Q84.0 345.0 60 300Z\" fill=\"#7FD8FF\"/>",
  "surprised": "<circle cx=\"118\" cy=\"468\" r=\"26\" fill=\"{F}\"/><circle cx=\"224\" cy=\"460\" r=\"26\" fill=\"{F}\"/><circle cx=\"125\" cy=\"460\" r=\"7.8\" fill=\"{S}\"/><circle cx=\"231\" cy=\"452\" r=\"7.8\" fill=\"{S}\"/><ellipse cx=\"183\" cy=\"548\" rx=\"20\" ry=\"27\" fill=\"{F}\"/><path d=\"M40 330L70 365\" fill=\"none\" stroke=\"{X}\" stroke-width=\"13\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M0 400L48 408\" fill=\"none\" stroke=\"{X}\" stroke-width=\"13\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M110 290L116 340\" fill=\"none\" stroke=\"{X}\" stroke-width=\"13\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "wink": "<path d=\"M95 470Q118 446 141 470\" fill=\"none\" stroke=\"{F}\" stroke-width=\"14\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"224\" cy=\"460\" r=\"23\" fill=\"{F}\"/><circle cx=\"231\" cy=\"452\" r=\"6.9\" fill=\"{S}\"/><path d=\"M140 520Q183 556 230 514\" fill=\"none\" stroke=\"{F}\" stroke-width=\"14\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M180 540Q182 578 202 576Q216 570 214 534\" fill=\"#FF8FA3\" stroke=\"{F}\" stroke-width=\"9\" stroke-linejoin=\"round\"/>",
  "thinking": "<circle cx=\"110\" cy=\"458\" r=\"21\" fill=\"{F}\"/><circle cx=\"216\" cy=\"450\" r=\"21\" fill=\"{F}\"/><circle cx=\"117\" cy=\"450\" r=\"6.3\" fill=\"{S}\"/><circle cx=\"223\" cy=\"442\" r=\"6.3\" fill=\"{S}\"/><path d=\"M150 552Q166 536 182 552T214 548\" fill=\"none\" stroke=\"{F}\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><text x=\"430\" y=\"560\" font-size=\"170\" font-weight=\"800\" fill=\"{X}\" font-family=\"Avenir Next, Helvetica, Arial, sans-serif\">?</text>",
  "sleepy": "<path d=\"M95 464Q118 486 141 464\" fill=\"none\" stroke=\"{F}\" stroke-width=\"14\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M201 456Q224 478 247 456\" fill=\"none\" stroke=\"{F}\" stroke-width=\"14\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"183\" cy=\"552\" rx=\"17\" ry=\"13\" fill=\"{F}\"/><text x=\"430\" y=\"560\" font-size=\"110\" font-weight=\"800\" fill=\"{X}\" font-family=\"Avenir Next, Helvetica, Arial, sans-serif\">z</text><text x=\"520\" y=\"460\" font-size=\"80\" font-weight=\"800\" fill=\"{X}\" font-family=\"Avenir Next, Helvetica, Arial, sans-serif\">z</text>",
  "sad": "<circle cx=\"118\" cy=\"476\" r=\"21\" fill=\"{F}\"/><circle cx=\"224\" cy=\"468\" r=\"21\" fill=\"{F}\"/><circle cx=\"125\" cy=\"468\" r=\"6.3\" fill=\"{S}\"/><circle cx=\"231\" cy=\"460\" r=\"6.3\" fill=\"{S}\"/><path d=\"M92 440L138 428\" fill=\"none\" stroke=\"{F}\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M204 422L250 432\" fill=\"none\" stroke=\"{F}\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M150 566Q183 536 216 564\" fill=\"none\" stroke=\"{F}\" stroke-width=\"14\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M102 497Q87.6 524.0 102 531.2Q116.4 524.0 102 497Z\" fill=\"#FFFFFF\"/>",
  "cool": "<g transform=\"rotate(-5 172 470)\"><path d=\"M69 456L58 456\" fill=\"none\" stroke=\"{F}\" stroke-width=\"10\" stroke-linecap=\"round\"/><path d=\"M162 452Q172 440 182 452\" fill=\"none\" stroke=\"{F}\" stroke-width=\"11\" stroke-linecap=\"round\"/><path d=\"M70 446H162Q167 446 165 453L156 485Q150 500 133 500H99Q82 500 76 485L67 453Q65 446 70 446Z\" fill=\"url(#{ID}lens)\" stroke=\"{F}\" stroke-width=\"6\" stroke-linejoin=\"round\"/><path d=\"M182 446H274Q279 446 277 453L268 485Q262 500 245 500H211Q194 500 188 485L179 453Q177 446 182 446Z\" fill=\"url(#{ID}lens)\" stroke=\"{F}\" stroke-width=\"6\" stroke-linejoin=\"round\"/><path d=\"M86 476L110 454\" stroke=\"#fff\" stroke-width=\"8\" stroke-linecap=\"round\" opacity=\".85\"/><path d=\"M104 482L118 471\" stroke=\"#fff\" stroke-width=\"6\" stroke-linecap=\"round\" opacity=\".6\"/><path d=\"M198 476L222 454\" stroke=\"#fff\" stroke-width=\"8\" stroke-linecap=\"round\" opacity=\".85\"/><path d=\"M216 482L230 471\" stroke=\"#fff\" stroke-width=\"6\" stroke-linecap=\"round\" opacity=\".6\"/></g><path d=\"M150 541Q190 557 228 524\" fill=\"none\" stroke=\"{F}\" stroke-width=\"13\" stroke-linecap=\"round\"/>",
  "in-love": "<path d=\"M118 493.4C76.4 464.8 99.8 433.6 118 459.6C136.2 433.6 159.6 464.8 118 493.4Z\" fill=\"#FF8FA3\"/><path d=\"M224 485.4C182.4 456.8 205.8 425.6 224 451.6C242.2 425.6 265.6 456.8 224 485.4Z\" fill=\"#FF8FA3\"/><path d=\"M131 512Q183 562 234 509C236 556 210 584 180 580C154 576 138 550 131 512Z\" fill=\"{F}\"/><ellipse cx=\"78\" cy=\"522\" rx=\"24\" ry=\"13\" fill=\"#FF8FA3\" opacity=\".8\"/><ellipse cx=\"270\" cy=\"508\" rx=\"22\" ry=\"12\" fill=\"#FF8FA3\" opacity=\".8\"/>",
  "celebrate": "<path d=\"M95 476Q118 446 141 476\" fill=\"none\" stroke=\"{F}\" stroke-width=\"14\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M201 468Q224 438 247 468\" fill=\"none\" stroke=\"{F}\" stroke-width=\"14\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M124 504Q183 560 244 498C248 570 216 598 182 594C148 590 128 562 124 504Z\" fill=\"{F}\"/><path d=\"M150 580Q183 556 214 578Q200 595 182 594Q162 593 150 580Z\" fill=\"#FF8FA3\"/><ellipse cx=\"78\" cy=\"522\" rx=\"24\" ry=\"13\" fill=\"#FF8FA3\" opacity=\".8\"/><ellipse cx=\"270\" cy=\"508\" rx=\"22\" ry=\"12\" fill=\"#FF8FA3\" opacity=\".8\"/><rect x=\"60\" y=\"250\" width=\"34\" height=\"20\" rx=\"5\" fill=\"#FF8FA3\" transform=\"rotate(30 77 260)\"/><circle cx=\"170\" cy=\"200\" r=\"13\" fill=\"#FFC93C\"/><rect x=\"470\" y=\"400\" width=\"34\" height=\"20\" rx=\"5\" fill=\"#FFC93C\" transform=\"rotate(-25 487 410)\"/><circle cx=\"560\" cy=\"520\" r=\"12\" fill=\"#FF8FA3\"/><rect x=\"420\" y=\"560\" width=\"30\" height=\"18\" rx=\"5\" fill=\"#7FE3A0\" transform=\"rotate(40 435 569)\"/><rect x=\"0\" y=\"330\" width=\"30\" height=\"18\" rx=\"5\" fill=\"#7FE3A0\" transform=\"rotate(-20 15 339)\"/>"
}

interface Tone { top: string; base: string; shade: string; rim: string; shine: number }
const TONES: Record<FemataTone, Tone> = {
  // Everyday: soft sky gradient, blue shadow, pale rim.
  sky: { top: '#7ACDF8', base: '#3DB5F5', shade: '#1F8ED3', rim: '#9EE0FF', shine: 0.75 },
  // Celebrations: a warm golden rim light and a violet-blue shadow.
  sunrise: { top: '#8ED6FF', base: '#3DB5F5', shade: '#4B6FE0', rim: '#FFE08A', shine: 0.85 },
  // Dark screens: brighter top, cool violet shadow, icy rim so it glows.
  glow: { top: '#9BE2FF', base: '#43BBF7', shade: '#5A5FD8', rim: '#D4F6FF', shine: 0.9 },
  // Big heroes (log in): higher contrast, crisp white rim.
  pop: { top: '#A6E4FF', base: '#3DB5F5', shade: '#166FB8', rim: '#FFFFFF', shine: 0.9 },
}

function draw(mood: FemataMood, tone: FemataTone, onDark: boolean, id: string) {
  const t = TONES[tone]
  const face = FACES[mood]
    .split('{F}').join('#111111')
    .split('{S}').join('#FFFFFF')
    .split('{X}').join(onDark ? t.base : '#111111')
    .split('{ID}').join(id)
  return (
    `<defs>` +
    `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="120" y2="620"><stop offset="0" stop-color="${t.top}"/><stop offset="1" stop-color="${t.base}"/></linearGradient>` +
    `<linearGradient id="${id}lens" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A5563"/><stop offset="1" stop-color="#050608"/></linearGradient>` +
    `<clipPath id="${id}c">${SHAPE}</clipPath>` +
    `<mask id="${id}m"><rect x="-100" y="-100" width="900" height="900" fill="#fff"/><g fill="#000" transform="translate(12 12)">${SHAPE}</g></mask>` +
    `</defs>` +
    // shadow along the bottom and right, then the body shifted up-left over it
    `<g clip-path="url(#${id}c)"><rect x="-100" y="-100" width="900" height="900" fill="${t.shade}"/><g fill="url(#${id}g)" transform="translate(-20 -18)">${SHAPE}</g>` +
    // light rim along the top and left
    `<rect x="-100" y="-100" width="900" height="900" fill="${t.rim}" mask="url(#${id}m)"/></g>` +
    // shine
    `<ellipse cx="86" cy="430" rx="34" ry="13" transform="rotate(-28 86 430)" fill="#fff" opacity="${t.shine}"/>` +
    `<ellipse cx="420" cy="66" rx="40" ry="11" transform="rotate(-8 420 66)" fill="#fff" opacity="${t.shine * 0.93}"/>` +
    `<circle cx="46" cy="470" r="7" fill="#fff" opacity="${t.shine}"/>` +
    face
  )
}

interface Props {
  mood?: FemataMood
  tone?: FemataTone
  /** Width in px; the height follows (6:7). */
  size?: number
  /** On a dark backdrop: the extras (sparkles, "?", "z") turn blue instead of black. */
  onDark?: boolean
  className?: string
  style?: React.CSSProperties
  /** Read out by screen readers; leave empty when Femata is decoration. */
  label?: string
}

export default function Femata({ mood = 'happy', tone = 'sky', size = 96, onDark = false, className, style, label }: Props) {
  const id = 'fm' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg
      viewBox="-15 30 700 600"
      width={size}
      height={Math.round(size * 6 / 7)}
      className={className}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: draw(mood, tone, onDark, id) }}
    />
  )
}
