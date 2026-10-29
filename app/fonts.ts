import { Archivo, Instrument_Sans, JetBrains_Mono, Fraunces } from "next/font/google";

export const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap", axes: ["wdth"] });
export const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });
export const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });
// Only used inside the video, for the "Editorial" look.
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz", "SOFT"] });

export const fontVars = [archivo.variable, instrument.variable, mono.variable, fraunces.variable].join(" ");

/** Font families as the canvas needs them. */
export const canvasFonts = {
  display: {
    bold: archivo.style.fontFamily,
    clean: instrument.style.fontFamily,
    editorial: fraunces.style.fontFamily,
  },
  body: instrument.style.fontFamily,
  mono: mono.style.fontFamily,
};
